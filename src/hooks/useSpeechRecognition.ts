import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceTranscriptionMeta } from '../types/chat';

export type SpeechRecognitionLanguage = 'auto' | 'kn-IN' | 'en-IN' | 'en-US';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function getPreferredRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) {
      return type;
    }
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

const DEFAULT_WAVEFORM = Array.from({ length: 12 }, () => 0.22);

interface UseSpeechRecognitionOptions {
  onTranscriptUpdate: (fullText: string, meta?: VoiceTranscriptionMeta | null) => void;
}

export function useSpeechRecognition({ onTranscriptUpdate }: UseSpeechRecognitionOptions) {
  const [isSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hasRecorder = Boolean(navigator.mediaDevices && typeof MediaRecorder !== 'undefined');
    return hasRecorder || Boolean(getSpeechRecognitionCtor());
  });
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechLang, setSpeechLang] = useState<SpeechRecognitionLanguage>('auto');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waveformLevels, setWaveformLevels] = useState<number[]>(DEFAULT_WAVEFORM);
  const [transcriptionMeta, setTranscriptionMeta] = useState<VoiceTranscriptionMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseTextRef = useRef('');
  const finalBrowserTranscriptRef = useRef('');
  const latestBrowserDraftRef = useRef('');
  const activeLangRef = useRef<SpeechRecognitionLanguage>('auto');
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
  onTranscriptUpdateRef.current = onTranscriptUpdate;

  const cleanupAudioHardware = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (timerIdRef.current !== null) {
      window.clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setWaveformLevels(DEFAULT_WAVEFORM);
  }, []);

  const stopBrowserPreviewOnly = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }
  }, []);

  const finalizeTranscription = useCallback(
    async (audioBlob: Blob | null, mimeType: string, browserDraft: string) => {
      const durationMs = Date.now() - recordingStartTimeRef.current;

      if ((!audioBlob || audioBlob.size < 400 || durationMs < 250) && !browserDraft) {
        setError('Recording was too short or silent. Please speak clearly and try again.');
        return;
      }

      setIsTranscribing(true);
      try {
        const audioBase64 = audioBlob && audioBlob.size >= 400 ? await blobToBase64(audioBlob) : undefined;
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: mimeType || audioBlob?.type || 'audio/webm',
            browserDraft,
            voiceLangHint: activeLangRef.current,
          }),
        });

        const data = (await res.json()) as VoiceTranscriptionMeta & { error?: string };
        if (!res.ok) {
          throw new Error(data?.error || 'Could not transcribe your voice input.');
        }

        if (data.isUnclear || !data.normalizedText) {
          setTranscriptionMeta(data);
          setError(
            data.lowConfidenceMessage ||
              'Could not hear clearly. Please repeat your question or type it in the box.'
          );
          if (data.normalizedText) {
            const combined = [baseTextRef.current, data.normalizedText].filter(Boolean).join(' ');
            onTranscriptUpdateRef.current(combined, data);
          }
          return;
        }

        setTranscriptionMeta(data);
        if (data.confidence === 'low' && data.lowConfidenceMessage) {
          setError(data.lowConfidenceMessage);
        }

        const combined = [baseTextRef.current, data.normalizedText].filter(Boolean).join(' ');
        onTranscriptUpdateRef.current(combined, data);
      } catch (err: unknown) {
        if (browserDraft) {
          const fallbackMeta: VoiceTranscriptionMeta = {
            rawTranscription: browserDraft,
            normalizedText: browserDraft,
            detectedInputType: /[\u0C80-\u0CFF]/.test(browserDraft) ? 'Kannada' : 'Kanglish',
            confidence: 'medium',
          };
          setTranscriptionMeta(fallbackMeta);
          const combined = [baseTextRef.current, browserDraft].filter(Boolean).join(' ');
          onTranscriptUpdateRef.current(combined, fallbackMeta);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'Voice recognition failed. Please try again or type your message.'
          );
        }
      } finally {
        setIsTranscribing(false);
      }
    },
    []
  );

  const stopListening = useCallback(() => {
    cancelledRef.current = false;
    stopBrowserPreviewOnly();
    setIsListening(false);
    setInterimTranscript('');

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        cleanupAudioHardware();
      }
    } else {
      cleanupAudioHardware();
      const draft = latestBrowserDraftRef.current.trim();
      if (draft) {
        void finalizeTranscription(null, '', draft);
      }
    }
  }, [cleanupAudioHardware, finalizeTranscription, stopBrowserPreviewOnly]);

  const cancelListening = useCallback(() => {
    cancelledRef.current = true;
    setIsListening(false);
    setInterimTranscript('');
    setRecordingSeconds(0);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Ignore
      }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    cleanupAudioHardware();
    onTranscriptUpdateRef.current(baseTextRef.current, null);
  }, [cleanupAudioHardware]);

  const startListening = useCallback(
    async (existingInputText: string, overrideLang?: SpeechRecognitionLanguage) => {
      if (isTranscribing) return;
      setError(null);
      setTranscriptionMeta(null);

      if (isListening) {
        stopListening();
        return;
      }

      const effectiveLang = overrideLang || speechLang;
      activeLangRef.current = effectiveLang;
      cancelledRef.current = false;

      const trimmedBase = existingInputText.trimEnd();
      baseTextRef.current = trimmedBase;
      finalBrowserTranscriptRef.current = '';
      latestBrowserDraftRef.current = '';
      setInterimTranscript('');
      setRecordingSeconds(0);

      // 1. Acquire microphone permission & live audio stream
      let stream: MediaStream | null = null;
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          mediaStreamRef.current = stream;
        } catch (permErr: unknown) {
          const name = (permErr as { name?: string })?.name || '';
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setError(
              'Microphone permission was denied. Please allow microphone access in your browser settings and try again.'
            );
          } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            setError('No microphone device was found. Please connect a microphone and try again.');
          } else if (name === 'NotReadableError' || name === 'TrackStartError') {
            setError(
              'Your microphone is currently in use by another app. Please close it and try again.'
            );
          } else {
            setError('Unable to access your microphone. Please check your device audio settings.');
          }
          return;
        }
      }

      // 2. Start live AudioContext waveform meter
      if (stream && typeof AudioContext !== 'undefined') {
        try {
          const audioCtx = new AudioContext();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.72;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateWaveform = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            const bars: number[] = [];
            const step = Math.max(1, Math.floor(dataArray.length / 12));
            for (let i = 0; i < 12; i++) {
              const val = dataArray[Math.min(dataArray.length - 1, i * step)] || 0;
              const normalized = Math.max(0.18, Math.min(1, 0.18 + (val / 255) * 0.95));
              bars.push(normalized);
            }
            setWaveformLevels(bars);
            rafIdRef.current = requestAnimationFrame(updateWaveform);
          };
          rafIdRef.current = requestAnimationFrame(updateWaveform);
        } catch {
          // Non-fatal; animated CSS bars still render
        }
      }

      // 3. Start MediaRecorder for reliable server-side Kanglish + Kannada + English ASR
      if (stream && typeof MediaRecorder !== 'undefined') {
        const mimeType = getPreferredRecorderMimeType();
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        audioChunksRef.current = [];

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = () => {
          const wasCancelled = cancelledRef.current;
          const chunks = audioChunksRef.current;
          const recordedMime = recorder.mimeType || mimeType || 'audio/webm';
          const draft = latestBrowserDraftRef.current.trim();

          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
          cleanupAudioHardware();

          if (!wasCancelled) {
            const blob = new Blob(chunks, { type: recordedMime });
            void finalizeTranscription(blob, recordedMime, draft);
          }
        };

        mediaRecorderRef.current = recorder;
        recordingStartTimeRef.current = Date.now();
        recorder.start(250);
        setIsListening(true);

        timerIdRef.current = window.setInterval(() => {
          const secs = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
          setRecordingSeconds(secs);
        }, 250);
      }

      // 4. Optional parallel Web Speech API for real-time live caption preview
      const Ctor = getSpeechRecognitionCtor();
      if (Ctor) {
        try {
          const recognition = new Ctor();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          // Use en-IN for Auto/Kanglish so phonetic Kannada words aren't prematurely coerced into wrong scripts
          recognition.lang = effectiveLang === 'auto' ? 'en-IN' : effectiveLang;

          recognition.onstart = () => {
            if (!mediaRecorderRef.current) {
              recordingStartTimeRef.current = Date.now();
              setIsListening(true);
              timerIdRef.current = window.setInterval(() => {
                const secs = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
                setRecordingSeconds(secs);
              }, 250);
            }
          };

          recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let finalChunk = '';
            let interimChunk = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              const transcript = result[0]?.transcript ?? '';
              if (result.isFinal) {
                finalChunk += transcript;
              } else {
                interimChunk += transcript;
              }
            }
            if (finalChunk) {
              finalBrowserTranscriptRef.current = `${finalBrowserTranscriptRef.current} ${finalChunk}`.trim();
            }
            const spoken = `${finalBrowserTranscriptRef.current} ${interimChunk}`.trim();
            latestBrowserDraftRef.current = spoken;
            setInterimTranscript(spoken);

            // Show live preview in the editable box while speaking
            const combined = [baseTextRef.current, spoken].filter(Boolean).join(' ');
            onTranscriptUpdateRef.current(combined, null);
          };

          recognition.onerror = () => {
            // Live browser preview errors are non-fatal when MediaRecorder is active
          };

          recognition.onend = () => {
            recognitionRef.current = null;
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch {
          // Non-fatal; MediaRecorder handles full capture
        }
      } else if (!stream) {
        setError(
          'Voice input is not supported in this browser. Please type your message below.'
        );
      }
    },
    [cleanupAudioHardware, finalizeTranscription, isListening, isTranscribing, speechLang, stopListening]
  );

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore cleanup errors
        }
      }
      cleanupAudioHardware();
    };
  }, [cleanupAudioHardware]);

  return {
    isSupported,
    isListening,
    isTranscribing,
    speechLang,
    setSpeechLang,
    interimTranscript,
    recordingSeconds,
    waveformLevels,
    transcriptionMeta,
    clearTranscriptionMeta: () => setTranscriptionMeta(null),
    error,
    clearError: () => setError(null),
    startListening,
    stopListening,
    cancelListening,
  };
}
