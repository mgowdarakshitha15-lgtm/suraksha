import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types/chat';

export interface VoiceOption {
  id: string;
  label: string;
  lang: string;
  provider: 'gemini' | 'browser';
  voiceName?: string;
}

const GEMINI_VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'gemini:Kore',
    label: 'Surakshini Neural · Kore (Natural)',
    lang: 'multilingual',
    provider: 'gemini',
    voiceName: 'Kore',
  },
  {
    id: 'gemini:Zephyr',
    label: 'Surakshini Neural · Zephyr (Warm)',
    lang: 'multilingual',
    provider: 'gemini',
    voiceName: 'Zephyr',
  },
  {
    id: 'gemini:Puck',
    label: 'Surakshini Neural · Puck (Clear)',
    lang: 'multilingual',
    provider: 'gemini',
    voiceName: 'Puck',
  },
  {
    id: 'gemini:Charon',
    label: 'Surakshini Neural · Charon (Calm)',
    lang: 'multilingual',
    provider: 'gemini',
    voiceName: 'Charon',
  },
];

const VOICE_PREF_STORAGE_KEY = 'surakshini_selected_voice_v1';

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds natural, conversational spoken text for the AI response.
 * Intentionally omits technical metadata, timestamps, severity labels, and UI labels.
 */
export function buildSpeakableMessageText(message: ChatMessage): string {
  const parts: string[] = [];

  if (message.content) {
    parts.push(stripMarkdownForSpeech(message.content));
  }

  if (message.hasAnalysis && message.analysis) {
    const a = message.analysis;
    if (a.explanation) {
      parts.push(stripMarkdownForSpeech(a.explanation));
    }
    if (a.contextualReasoning) {
      parts.push(stripMarkdownForSpeech(a.contextualReasoning));
    }
    if (a.suggestedSafeResponses && a.suggestedSafeResponses.length > 0) {
      parts.push(`Here is a safe reply you can consider: ${a.suggestedSafeResponses[0]}`);
    }
    if (a.recommendedSafetyActions && a.recommendedSafetyActions.length > 0) {
      parts.push(`To stay safe, you can: ${a.recommendedSafetyActions.slice(0, 2).join('. ')}`);
    }
  }

  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function detectLanguageHint(message: ChatMessage, text: string): 'en' | 'kn' | 'kanglish' {
  if (/[\u0C80-\u0CFF]/.test(text)) {
    return 'kn';
  }
  if (message.responseLanguage === 'kanglish') {
    return 'kanglish';
  }
  if (message.responseLanguage === 'kn') {
    return 'kn';
  }
  const detected = message.analysis?.detectedLanguage?.toLowerCase() || '';
  if (detected.includes('kanglish') || detected.includes('romanized')) {
    return 'kanglish';
  }
  if (detected.includes('kannada')) {
    return 'kn';
  }
  if (/\b(andre|bagge|dalli|alli|nanage|nanna|neenu|kodi|heli|madi|agutte|madutte|ondu|enu|hege|illa|houdu|idya)\b/i.test(text)) {
    return 'kanglish';
  }
  return 'en';
}

function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const sentences = text.match(/[^.!?।\n]+[.!?।\n]*/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    if (sentence.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      // Split overly long sentence by words
      const words = sentence.split(/\s+/);
      let wordBuf = '';
      for (const word of words) {
        if ((wordBuf + ' ' + word).trim().length > maxChars) {
          if (wordBuf) chunks.push(wordBuf.trim());
          wordBuf = word;
        } else {
          wordBuf = (wordBuf + ' ' + word).trim();
        }
      }
      if (wordBuf) chunks.push(wordBuf.trim());
      continue;
    }

    if ((current + ' ' + sentence).trim().length > maxChars) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current = (current + ' ' + sentence).trim();
    }
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

function loadSavedVoiceId(): string {
  try {
    return localStorage.getItem(VOICE_PREF_STORAGE_KEY) || 'gemini:Kore';
  } catch {
    return 'gemini:Kore';
  }
}

export function useTextToSpeech() {
  const [isSpeechSynthesisSupported] = useState<boolean>(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window
  );
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceIdState] = useState<string>(() => loadSavedVoiceId());
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<'idle' | 'loading' | 'playing' | 'paused'>(
    'idle'
  );
  const [progress, setProgress] = useState<number>(0); // 0 to 1
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [usingFallbackNotice, setUsingFallbackNotice] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const playbackRunIdRef = useRef<number>(0);
  const lastMessageRef = useRef<ChatMessage | null>(null);
  // Cache generated audio Blob URLs per `${messageId}::${voiceId}` for instant Replay
  const audioCacheRef = useRef<Map<string, string[]>>(new Map());
  const browserPausedRef = useRef<boolean>(false);

  const setSelectedVoiceId = useCallback((voiceId: string) => {
    setSelectedVoiceIdState(voiceId);
    try {
      localStorage.setItem(VOICE_PREF_STORAGE_KEY, voiceId);
    } catch {
      // Ignore storage error
    }
  }, []);

  // Load browser SpeechSynthesis voices (for browser mode or fallback)
  useEffect(() => {
    if (!isSpeechSynthesisSupported) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const sorted = [...voices].sort((a, b) => {
          const score = (v: SpeechSynthesisVoice) => {
            if (v.lang.toLowerCase().startsWith('kn')) return 0;
            if (v.lang === 'en-IN') return 1;
            if (v.lang.startsWith('en')) return 2;
            return 3;
          };
          return score(a) - score(b);
        });
        setBrowserVoices(sorted);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, [isSpeechSynthesisSupported]);

  const stop = useCallback(() => {
    playbackRunIdRef.current += 1;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (isSpeechSynthesisSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel errors
      }
    }
    browserPausedRef.current = false;

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    setActiveMessageId(null);
    setPlaybackState('idle');
    setProgress(0);
    setElapsedSeconds(0);
    setDurationSeconds(0);
  }, [isSpeechSynthesisSupported]);

  // Revoke cached blob URLs only on unmount
  useEffect(() => {
    const cache = audioCacheRef.current;
    return () => {
      stop();
      for (const urls of cache.values()) {
        for (const u of urls) {
          URL.revokeObjectURL(u);
        }
      }
      cache.clear();
    };
  }, [stop]);

  const speakWithBrowser = useCallback(
    (
      runId: number,
      messageId: string,
      text: string,
      voiceId: string,
      languageHint: 'en' | 'kn' | 'kanglish'
    ) => {
      if (!isSpeechSynthesisSupported) {
        setTtsError(
          'Speech playback is not supported in this browser. Please check your browser audio support.'
        );
        setActiveMessageId(null);
        setPlaybackState('idle');
        return;
      }

      const chunks = splitTextIntoChunks(text, 220);
      setActiveMessageId(messageId);
      setPlaybackState('playing');
      setProgress(0);
      setElapsedSeconds(0);
      setDurationSeconds(0);

      const pickVoice = () => {
        if (voiceId.startsWith('browser:') && voiceId !== 'browser:auto') {
          const chosen = browserVoices.find((v) => `browser:${v.name}` === voiceId);
          if (chosen) return chosen;
        }
        if (languageHint === 'kn') {
          return (
            browserVoices.find((v) => v.lang.toLowerCase().startsWith('kn')) ||
            browserVoices.find((v) => v.lang === 'en-IN') ||
            null
          );
        }
        return (
          browserVoices.find((v) => v.lang === 'en-IN') ||
          browserVoices.find((v) => v.lang === 'en-US') ||
          browserVoices.find((v) => v.lang.startsWith('en')) ||
          null
        );
      };

      const selectedBrowserVoice = pickVoice();
      if (languageHint === 'kn' && !selectedBrowserVoice?.lang.toLowerCase().startsWith('kn')) {
        setUsingFallbackNotice(
          'Browser fallback active: no local Kannada system voice was detected, so pronunciation may be limited.'
        );
      }

      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }

      let chunkIndex = 0;

      const speakNextChunk = () => {
        if (playbackRunIdRef.current !== runId) return;
        if (chunkIndex >= chunks.length) {
          setActiveMessageId(null);
          setPlaybackState('idle');
          setProgress(0);
          return;
        }

        const chunkText = chunks[chunkIndex];
        const utterance = new SpeechSynthesisUtterance(chunkText);
        if (selectedBrowserVoice) {
          utterance.voice = selectedBrowserVoice;
          utterance.lang = selectedBrowserVoice.lang;
        } else {
          utterance.lang = languageHint === 'kn' ? 'kn-IN' : 'en-IN';
        }
        utterance.rate = 0.98;
        utterance.pitch = 1.02;

        utterance.onstart = () => {
          if (playbackRunIdRef.current !== runId) return;
          setPlaybackState('playing');
          setProgress(chunkIndex / chunks.length);
        };

        utterance.onpause = () => {
          if (playbackRunIdRef.current !== runId) return;
          setPlaybackState('paused');
        };

        utterance.onresume = () => {
          if (playbackRunIdRef.current !== runId) return;
          setPlaybackState('playing');
        };

        utterance.onend = () => {
          if (playbackRunIdRef.current !== runId) return;
          chunkIndex += 1;
          setProgress(chunkIndex / chunks.length);
          speakNextChunk();
        };

        utterance.onerror = (ev) => {
          if (playbackRunIdRef.current !== runId) return;
          if (ev.error !== 'interrupted' && ev.error !== 'canceled') {
            setTtsError('Browser voice playback failed. Please try another voice option.');
          }
          setActiveMessageId(null);
          setPlaybackState('idle');
          setProgress(0);
        };

        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          setTtsError('Unable to start browser speech playback.');
          setActiveMessageId(null);
          setPlaybackState('idle');
        }
      };

      speakNextChunk();
    },
    [browserVoices, isSpeechSynthesisSupported]
  );

  const speakWithGemini = useCallback(
    async (
      runId: number,
      message: ChatMessage,
      text: string,
      voiceId: string,
      voiceName: string,
      languageHint: 'en' | 'kn' | 'kanglish'
    ) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setActiveMessageId(message.id);
      setPlaybackState('loading');
      setProgress(0);
      setElapsedSeconds(0);
      setDurationSeconds(0);
      setTtsError(null);
      setUsingFallbackNotice(null);

      const cacheKey = `${message.id}::${voiceId}::${text.length}`;
      const chunks = splitTextIntoChunks(text, 1200);

      const fetchChunkAudioUrl = async (chunkText: string): Promise<string> => {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunkText, voiceName, languageHint }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.audioBase64) {
          throw new Error(data?.error || 'Could not generate natural speech audio.');
        }

        const byteChars = atob(data.audioBase64);
        const byteNumbers = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: data.mimeType || 'audio/wav' });
        return URL.createObjectURL(blob);
      };

      try {
        let chunkUrls = audioCacheRef.current.get(cacheKey);

        if (!chunkUrls || chunkUrls.length === 0) {
          // Fetch first chunk immediately so playback starts fast
          const firstUrl = await fetchChunkAudioUrl(chunks[0]);
          if (playbackRunIdRef.current !== runId) {
            URL.revokeObjectURL(firstUrl);
            return;
          }
          chunkUrls = [firstUrl];

          // Pre-fetch remaining chunks in background for seamless multi-chunk long responses
          if (chunks.length > 1) {
            Promise.all(chunks.slice(1).map((c) => fetchChunkAudioUrl(c)))
              .then((restUrls) => {
                if (playbackRunIdRef.current === runId) {
                  const full = [firstUrl, ...restUrls];
                  audioCacheRef.current.set(cacheKey, full);
                  chunkUrls = full;
                } else {
                  restUrls.forEach((u) => URL.revokeObjectURL(u));
                }
              })
              .catch(() => {
                // Remaining chunk errors handled cleanly if reached
              });
          } else {
            audioCacheRef.current.set(cacheKey, chunkUrls);
          }
        }

        const playChunkAt = async (idx: number) => {
          if (playbackRunIdRef.current !== runId) return;

          // Wait briefly or fetch chunk if background prefetch hasn't populated it yet
          let url = chunkUrls?.[idx];
          if (!url && idx < chunks.length) {
            setPlaybackState('loading');
            url = await fetchChunkAudioUrl(chunks[idx]);
            if (playbackRunIdRef.current !== runId) {
              URL.revokeObjectURL(url);
              return;
            }
            if (chunkUrls) {
              chunkUrls[idx] = url;
              audioCacheRef.current.set(cacheKey, chunkUrls);
            }
          }

          if (!url) {
            setActiveMessageId(null);
            setPlaybackState('idle');
            setProgress(0);
            return;
          }

          const audio = new Audio(url);
          audioRef.current = audio;

          audio.ontimeupdate = () => {
            if (playbackRunIdRef.current !== runId) return;
            const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
            setElapsedSeconds(audio.currentTime || 0);
            setDurationSeconds(dur);
            if (dur > 0) {
              const chunkFraction = audio.currentTime / dur;
              setProgress((idx + chunkFraction) / chunks.length);
            }
          };

          audio.onended = () => {
            if (playbackRunIdRef.current !== runId) return;
            if (idx + 1 < chunks.length) {
              void playChunkAt(idx + 1);
            } else {
              setActiveMessageId(null);
              setPlaybackState('idle');
              setProgress(0);
              setElapsedSeconds(0);
              setDurationSeconds(0);
            }
          };

          audio.onerror = () => {
            if (playbackRunIdRef.current !== runId) return;
            setTtsError('Audio playback failed. Switching to browser voice.');
            stop();
          };

          await audio.play();
          if (playbackRunIdRef.current === runId) {
            setPlaybackState('playing');
          }
        };

        await playChunkAt(0);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        if (playbackRunIdRef.current !== runId) return;

        // Graceful fallback to browser SpeechSynthesis
        if (isSpeechSynthesisSupported) {
          setUsingFallbackNotice(
            'Neural voice is currently unavailable; playing with browser voice fallback.'
          );
          speakWithBrowser(runId, message.id, text, 'browser:auto', languageHint);
        } else {
          setTtsError(
            err instanceof Error ? err.message : 'Unable to play natural voice response.'
          );
          setActiveMessageId(null);
          setPlaybackState('idle');
        }
      }
    },
    [isSpeechSynthesisSupported, speakWithBrowser, stop]
  );

  const speakMessage = useCallback(
    (message: ChatMessage, overrideVoiceId?: string) => {
      setTtsError(null);
      setUsingFallbackNotice(null);
      const voiceToUse = overrideVoiceId || selectedVoiceId;
      const speakableText = buildSpeakableMessageText(message);
      if (!speakableText) return;

      const languageHint = detectLanguageHint(message, speakableText);
      lastMessageRef.current = message;

      stop();
      const runId = playbackRunIdRef.current;

      if (voiceToUse.startsWith('gemini:')) {
        const voiceName = voiceToUse.replace('gemini:', '');
        void speakWithGemini(runId, message, speakableText, voiceToUse, voiceName, languageHint);
      } else {
        speakWithBrowser(runId, message.id, speakableText, voiceToUse, languageHint);
      }
    },
    [selectedVoiceId, speakWithBrowser, speakWithGemini, stop]
  );

  const replayMessage = useCallback(
    (message: ChatMessage) => {
      speakMessage(message);
    },
    [speakMessage]
  );

  const pauseOrResume = useCallback(() => {
    if (!activeMessageId) return;

    if (audioRef.current) {
      if (audioRef.current.paused) {
        void audioRef.current.play();
        setPlaybackState('playing');
      } else {
        audioRef.current.pause();
        setPlaybackState('paused');
      }
      return;
    }

    if (isSpeechSynthesisSupported) {
      if (playbackState === 'paused' || browserPausedRef.current) {
        window.speechSynthesis.resume();
        browserPausedRef.current = false;
        setPlaybackState('playing');
      } else if (playbackState === 'playing') {
        window.speechSynthesis.pause();
        browserPausedRef.current = true;
        setPlaybackState('paused');
      }
    }
  }, [activeMessageId, isSpeechSynthesisSupported, playbackState]);

  const voiceOptions: VoiceOption[] = [
    ...GEMINI_VOICE_OPTIONS,
    {
      id: 'browser:auto',
      label: 'Browser Fallback (Auto)',
      lang: 'auto',
      provider: 'browser',
    },
    ...browserVoices
      .filter((v) => v.lang.toLowerCase().startsWith('en') || v.lang.toLowerCase().startsWith('kn'))
      .slice(0, 10)
      .map((v) => ({
        id: `browser:${v.name}`,
        label: `${v.name} (${v.lang})`,
        lang: v.lang,
        provider: 'browser' as const,
      })),
  ];

  return {
    isSupported: isSpeechSynthesisSupported || true,
    voiceOptions,
    selectedVoiceId,
    setSelectedVoiceId,
    activeMessageId,
    playbackState,
    progress,
    elapsedSeconds,
    durationSeconds,
    usingFallbackNotice,
    ttsError,
    clearTtsError: () => {
      setTtsError(null);
      setUsingFallbackNotice(null);
    },
    speakMessage,
    replayMessage,
    pauseOrResume,
    stop,
  };
}
