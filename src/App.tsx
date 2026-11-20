import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Eraser,
  ImagePlus,
  Languages,
  Loader2,
  Menu,
  Mic,
  MicOff,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Square,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MessageBubble } from './components/MessageBubble';
import { SafetyHelplinesModal } from './components/SafetyHelplinesModal';
import { Sidebar } from './components/Sidebar';
import { SurakshiniLogo } from './components/SurakshiniLogo';
import { WelcomeView } from './components/WelcomeView';
import {
  useSpeechRecognition,
  type SpeechRecognitionLanguage,
} from './hooks/useSpeechRecognition';
import { useTextToSpeech } from './hooks/useTextToSpeech';
import type {
  ChatImageAttachment,
  ChatMessage,
  Conversation,
  ResponseLanguage,
} from './types/chat';

const STORAGE_KEY = 'surakshini_ai_conversations_v1';
const AUTO_SPEAK_STORAGE_KEY = 'surakshini_auto_speak_v1';
const RESPONSE_LANG_STORAGE_KEY = 'surakshini_response_lang_v1';
const THEME_STORAGE_KEY = 'chatbot-theme';
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

type VoiceAssistantStatus = 'Idle' | 'Listening' | 'Transcribing' | 'Processing' | 'Speaking';
type ThemeMode = 'dark' | 'white';

function formatRecordingTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function loadResponseLanguagePreference(): ResponseLanguage {
  try {
    const saved = localStorage.getItem(RESPONSE_LANG_STORAGE_KEY);
    if (saved === 'kn' || saved === 'kanglish' || saved === 'en') {
      return saved;
    }
    return 'kn';
  } catch {
    return 'kn';
  }
}

function createEmptyConversation(): Conversation {
  const now = Date.now();
  return {
    id: `conv_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'New Conversation',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function buildConversationTitle(messageText: string, hasImage: boolean): string {
  const cleaned = messageText.replace(/\s+/g, ' ').trim();
  if (!cleaned && hasImage) return 'Screenshot Safety Check';
  if (cleaned.length <= 36) return cleaned;
  return `${cleaned.slice(0, 36).trim()}…`;
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [createEmptyConversation()];
    const parsed = JSON.parse(raw) as Conversation[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createEmptyConversation()];
    }
    return parsed;
  } catch {
    return [createEmptyConversation()];
  }
}

function loadAutoSpeakPreference(): boolean {
  try {
    return localStorage.getItem(AUTO_SPEAK_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadThemePreference(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'white' || saved === 'light') {
      return 'white';
    }
    return 'dark';
  } catch {
    return 'dark';
  }
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => loadThemePreference());
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string>(() => {
    const loaded = loadConversations();
    return loaded[0].id;
  });

  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState<ChatImageAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHasImage, setLoadingHasImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => loadAutoSpeakPreference());
  const [responseLanguage, setResponseLanguage] = useState<ResponseLanguage>(() =>
    loadResponseLanguagePreference()
  );

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isHelplinesOpen, setIsHelplinesOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;

  // Apply theme class on <html> and persist under localStorage key `chatbot-theme`
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage error
    }
  }, [theme]);

  const handleChangeResponseLanguage = (nextLang: ResponseLanguage) => {
    setResponseLanguage(nextLang);
    try {
      localStorage.setItem(RESPONSE_LANG_STORAGE_KEY, nextLang);
    } catch {
      // Ignore storage error
    }
  };

  // Multilingual Kanglish / Kannada / English Voice-to-Text hook (populates inputText for review & editing)
  const {
    isSupported: isSpeechSupported,
    isListening,
    isTranscribing,
    speechLang,
    setSpeechLang,
    interimTranscript,
    recordingSeconds,
    waveformLevels,
    transcriptionMeta,
    clearTranscriptionMeta,
    error: speechError,
    clearError: clearSpeechError,
    startListening,
    stopListening,
    cancelListening,
  } = useSpeechRecognition({
    onTranscriptUpdate: (recognizedText) => {
      setInputText(recognizedText);
    },
  });

  // Text-to-Speech hook (Gemini Neural TTS default + Browser SpeechSynthesis fallback)
  const {
    voiceOptions: ttsVoiceOptions,
    selectedVoiceId: ttsSelectedVoiceId,
    setSelectedVoiceId: setTtsSelectedVoiceId,
    activeMessageId: ttsActiveMessageId,
    playbackState: ttsPlaybackState,
    progress: ttsProgress,
    elapsedSeconds: ttsElapsedSeconds,
    durationSeconds: ttsDurationSeconds,
    usingFallbackNotice,
    ttsError,
    clearTtsError,
    speakMessage,
    replayMessage,
    pauseOrResume: pauseOrResumeTts,
    stop: stopTts,
  } = useTextToSpeech();

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? conversations[0];

  const voiceAssistantStatus: VoiceAssistantStatus = isListening
    ? 'Listening'
    : isTranscribing
      ? 'Transcribing'
      : isLoading || ttsPlaybackState === 'loading'
        ? 'Processing'
        : ttsPlaybackState === 'playing' || ttsPlaybackState === 'paused'
          ? 'Speaking'
          : 'Idle';

  const handleToggleAutoSpeak = () => {
    setAutoSpeak((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTO_SPEAK_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      try {
        const trimmed = conversations.map((conv) => ({
          ...conv,
          messages: conv.messages.map((m) => ({
            ...m,
            image: undefined,
          })),
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        // Ignore storage errors silently
      }
    }
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages.length, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [inputText]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
        setIsHelplinesOpen(false);
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const readImageFile = (file: File) => {
    setAttachmentError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setAttachmentError('Please upload a PNG, JPEG, WebP, or GIF screenshot.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setAttachmentError('Screenshot is too large. Please keep images under 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64Part = result.split(',')[1] || '';
      if (!base64Part) {
        setAttachmentError('Could not read the selected image.');
        return;
      }
      setAttachment({
        name: file.name || 'screenshot.png',
        mimeType: file.type,
        dataUrl: result,
        base64Data: base64Part,
      });
    };
    reader.onerror = () => {
      setAttachmentError('Failed to read the selected file.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readImageFile(file);
    }
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          readImageFile(file);
          return;
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      readImageFile(file);
    }
  };

  const handleNewConversation = () => {
    stopTts();
    if (isListening) stopListening();
    if (activeConversation && activeConversation.messages.length === 0) {
      textareaRef.current?.focus();
      return;
    }
    const fresh = createEmptyConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setInputText('');
    setAttachment(null);
    setAttachmentError(null);
    textareaRef.current?.focus();
  };

  const handleClearCurrentConversation = () => {
    stopTts();
    if (isListening) stopListening();
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, title: 'New Conversation', updatedAt: Date.now(), messages: [] }
          : c
      )
    );
    setInputText('');
    setAttachment(null);
    setAttachmentError(null);
    textareaRef.current?.focus();
  };

  const handleDeleteConversation = (id: string) => {
    stopTts();
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const fresh = createEmptyConversation();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) {
        setActiveId(remaining[0].id);
      }
      return remaining;
    });
  };

  const sendMessage = async (overrideText?: string, overrideImage?: ChatImageAttachment | null) => {
    if (isLoading || isTranscribing) return;
    stopTts();
    if (isListening) stopListening();

    const textToSend = (overrideText !== undefined ? overrideText : inputText).trim();
    const imageToSend = overrideImage !== undefined ? overrideImage : attachment;

    if (!textToSend && !imageToSend) return;

    const targetConvId = activeConversation.id;
    const priorMessages = activeConversation.messages.filter((m) => !m.isError);
    const activeVoiceMetadata =
      overrideText === undefined && transcriptionMeta
        ? transcriptionMeta
        : undefined;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: textToSend,
      createdAt: Date.now(),
      voiceMetadata: activeVoiceMetadata,
      image: imageToSend
        ? {
            name: imageToSend.name,
            mimeType: imageToSend.mimeType,
            dataUrl: imageToSend.dataUrl,
          }
        : undefined,
    };

    if (overrideText === undefined) {
      setInputText('');
      clearTranscriptionMeta();
    }
    if (overrideImage === undefined) {
      setAttachment(null);
    }
    setAttachmentError(null);

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id !== targetConvId) return conv;
        const isFirst = conv.messages.length === 0;
        return {
          ...conv,
          title: isFirst ? buildConversationTitle(textToSend, Boolean(imageToSend)) : conv.title,
          updatedAt: Date.now(),
          messages: [...conv.messages, userMsg],
        };
      })
    );

    setIsLoading(true);
    setLoadingHasImage(Boolean(imageToSend));

    try {
      const historyPayload = priorMessages.map((m) => ({
        role: m.role,
        content: m.content,
        hasAnalysis: m.hasAnalysis,
        analysis: m.analysis
          ? {
              detectionResult: m.analysis.detectionResult,
              severity: m.analysis.severity,
              categories: m.analysis.categories,
              extractedText: m.analysis.extractedText,
              explanation: m.analysis.explanation,
            }
          : undefined,
        voiceMetadata: m.voiceMetadata,
        followUpPrompts: m.followUpPrompts,
        hadImage: Boolean(m.image),
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyPayload,
          message: textToSend,
          responseLanguage,
          preferredLanguage: responseLanguage,
          voiceMetadata: activeVoiceMetadata,
          image: imageToSend
            ? {
                mimeType: imageToSend.mimeType,
                data: imageToSend.base64Data,
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Something went wrong while contacting SURAKSHINI AI.');
      }

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        content: data.reply || 'I have reviewed your message.',
        createdAt: Date.now(),
        responseLanguage: data.responseLanguage || responseLanguage,
        hasAnalysis: Boolean(data.hasAnalysis && data.analysis),
        analysis: data.hasAnalysis ? data.analysis : undefined,
        followUpPrompts: Array.isArray(data.followUpPrompts) ? data.followUpPrompts : [],
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === targetConvId
            ? {
                ...conv,
                updatedAt: Date.now(),
                messages: [...conv.messages, assistantMsg],
              }
            : conv
        )
      );

      if (autoSpeakRef.current) {
        speakMessage(assistantMsg);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unable to reach SURAKSHINI AI right now. Please try again.';

      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: errorMessage,
        createdAt: Date.now(),
        isError: true,
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === targetConvId
            ? {
                ...conv,
                updatedAt: Date.now(),
                messages: [...conv.messages, errorMsg],
              }
            : conv
        )
      );
    } finally {
      setIsLoading(false);
      setLoadingHasImage(false);
    }
  };

  const handleRetryLastTurn = () => {
    if (!activeConversation || isLoading) return;
    const msgs = activeConversation.messages;
    const lastUserIndex = [...msgs].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return;
    const actualUserIdx = msgs.length - 1 - lastUserIndex;
    const lastUserMsg = msgs[actualUserIdx];

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, messages: c.messages.slice(0, actualUserIdx) }
          : c
      )
    );

    const retryAttachment: ChatImageAttachment | null = lastUserMsg.image
      ? {
          name: lastUserMsg.image.name,
          mimeType: lastUserMsg.image.mimeType,
          dataUrl: lastUserMsg.image.dataUrl,
          base64Data: lastUserMsg.image.dataUrl.split(',')[1] || '',
        }
      : null;

    void sendMessage(lastUserMsg.content, retryAttachment);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleMicToggle = () => {
    if (ttsPlaybackState !== 'idle') {
      stopTts();
    }
    if (isListening) {
      stopListening();
    } else {
      void startListening(inputText);
    }
  };

  const handleSpeechLanguageChange = (nextLang: SpeechRecognitionLanguage) => {
    setSpeechLang(nextLang);
    if (isListening) {
      stopListening();
      setTimeout(() => {
        void startListening(inputText, nextLang);
      }, 150);
    }
  };

  const messages = activeConversation?.messages ?? [];
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  const canSend = (inputText.trim().length > 0 || Boolean(attachment)) && !isLoading;

  return (
    <div
      className="flex h-dvh w-full overflow-hidden bg-[#FFFFFF] text-[#0F172A] transition-colors duration-200 dark:bg-[#0F172A] dark:text-[#F8FAFC]"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      {/* Left Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeConversation.id}
        isOpenMobile={isMobileSidebarOpen}
        isCollapsedDesktop={isDesktopSidebarCollapsed}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onSelectConversation={(id) => {
          stopTts();
          setActiveId(id);
        }}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenHelplines={() => setIsHelplinesOpen(true)}
      />

      {/* Main Conversational Viewport */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#FFFFFF] transition-colors duration-200 dark:bg-[#0F172A]">
        {/* Header with Top-Right Dark Mode / White Mode Toggle */}
        <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[#E2E8F0] bg-[#FFFFFF] px-3 transition-colors duration-200 sm:gap-4 sm:px-5 dark:border-[#334155] dark:bg-[#111827]">
          <div className="flex min-w-0 items-center gap-2">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] lg:hidden dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-[#F8FAFC]"
              aria-label="Open conversations menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop collapse/expand sidebar */}
            <button
              type="button"
              onClick={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
              className="hidden min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] lg:flex dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-[#F8FAFC]"
              aria-label={isDesktopSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isDesktopSidebarCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>

            <span className="truncate font-display text-sm font-semibold text-[#0F172A] sm:text-base dark:text-[#F8FAFC]">
              {messages.length === 0 ? 'SURAKSHINI AI' : activeConversation.title}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearCurrentConversation}
                className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#0F172A] transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap sm:px-3 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:hover:border-rose-700 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
                aria-label="Clear current conversation"
              >
                <Eraser className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">Clear Chat</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNewConversation}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap sm:px-3.5 dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA] dark:hover:text-[#0F172A]"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">New Chat</span>
            </button>

            {/* Compact Dark Mode / White Mode Toggle in Top-Right Corner */}
            <div
              role="group"
              aria-label="Theme mode"
              className="inline-flex items-center rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-0.5 transition-colors duration-200 dark:border-[#334155] dark:bg-[#1E293B]"
            >
              <button
                type="button"
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
                aria-label="Dark Mode"
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap ${
                  theme === 'dark'
                    ? 'bg-[#3B82F6] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
                }`}
              >
                <Moon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('white')}
                aria-pressed={theme === 'white'}
                aria-label="White Mode"
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap ${
                  theme === 'white'
                    ? 'bg-[#2563EB] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
                }`}
              >
                <Sun className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">White</span>
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Chat Stream or Welcome View */}
        <main className="chat-scroll relative z-10 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex min-h-full items-center justify-center">
              <WelcomeView
                onSelectPrompt={(prompt) => void sendMessage(prompt, null)}
                onTriggerUpload={() => fileInputRef.current?.click()}
              />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isLatestAssistant={msg.id === lastAssistantId}
                  isLoading={isLoading}
                  onFollowUpClick={(prompt) => void sendMessage(prompt, null)}
                  onPreviewImage={(url, alt) => setLightboxImage({ url, alt })}
                  onRetry={msg.isError ? handleRetryLastTurn : undefined}
                  ttsActiveMessageId={ttsActiveMessageId}
                  ttsPlaybackState={ttsPlaybackState}
                  ttsProgress={ttsProgress}
                  ttsElapsedSeconds={ttsElapsedSeconds}
                  ttsDurationSeconds={ttsDurationSeconds}
                  ttsVoiceOptions={ttsVoiceOptions}
                  ttsSelectedVoiceId={ttsSelectedVoiceId}
                  onSpeakMessage={speakMessage}
                  onReplayMessage={replayMessage}
                  onPauseOrResumeTts={pauseOrResumeTts}
                  onStopTts={stopTts}
                  onChangeTtsVoice={setTtsSelectedVoiceId}
                />
              ))}

              {/* Typing / Analyzing Indicator */}
              {isLoading && (
                <div className="flex items-start gap-3 sm:gap-4" aria-live="polite">
                  <div className="mt-0.5 shrink-0">
                    <SurakshiniLogo size={34} />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm border border-[#E2E8F0] bg-[#F1F5F9] px-4 py-3 dark:border-[#334155] dark:bg-[#1E293B]">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1" aria-hidden="true">
                        <span className="typing-dot-1 h-2 w-2 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />
                        <span className="typing-dot-2 h-2 w-2 rounded-full bg-[#3B82F6]" />
                        <span className="typing-dot-3 h-2 w-2 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />
                      </div>
                      <span className="text-xs font-medium text-[#2563EB] dark:text-[#60A5FA]">
                        {loadingHasImage
                          ? 'Reading screenshot and analyzing context…'
                          : 'Surakshini is analyzing…'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Bottom Composer + Voice Assistant Bar */}
        <footer className="relative z-20 shrink-0 border-t border-[#E2E8F0] bg-[#FFFFFF] px-3 pb-3 pt-2.5 transition-colors duration-200 sm:px-6 sm:pb-4 dark:border-[#334155] dark:bg-[#111827]">
          <div className="mx-auto w-full max-w-3xl">
            {/* Voice, TTS, or Attachment Notices */}
            {(speechError || ttsError || usingFallbackNotice || attachmentError) && (
              <div
                className={`mb-2.5 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-xs shadow-2xs ${
                  speechError || ttsError || attachmentError
                    ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                }`}
              >
                <span>{speechError || ttsError || attachmentError || usingFallbackNotice}</span>
                <button
                  type="button"
                  onClick={() => {
                    clearSpeechError();
                    clearTtsError();
                    setAttachmentError(null);
                  }}
                  className="flex min-h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label="Dismiss notice"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Voice Assistant & Response Language Panel */}
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9] px-3.5 py-2 transition-colors duration-200 dark:border-[#334155] dark:bg-[#1E293B]">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {voiceAssistantStatus === 'Listening' ? (
                  <div
                    className="flex h-6 items-center gap-0.5 rounded-lg bg-[#FFFFFF] px-2 dark:bg-[#0F172A]"
                    aria-hidden="true"
                  >
                    {waveformLevels.map((lvl, idx) => (
                      <span
                        key={idx}
                        className="w-1 rounded-full bg-[#2563EB] transition-all duration-75 dark:bg-[#60A5FA]"
                        style={{ height: `${Math.round(4 + lvl * 16)}px` }}
                      />
                    ))}
                  </div>
                ) : voiceAssistantStatus === 'Speaking' ? (
                  <div className="flex h-5 items-center gap-1" aria-hidden="true">
                    <span className="mic-bar-1 h-3 w-1 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />
                    <span className="mic-bar-2 h-5 w-1 rounded-full bg-[#3B82F6]" />
                    <span className="mic-bar-3 h-4 w-1 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />
                    <span className="mic-bar-4 h-5 w-1 rounded-full bg-[#3B82F6]" />
                    <span className="mic-bar-5 h-3 w-1 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />
                  </div>
                ) : voiceAssistantStatus === 'Transcribing' ? (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FFFFFF] text-[#2563EB] dark:bg-[#0F172A] dark:text-[#60A5FA]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </div>
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FFFFFF] text-[#2563EB] dark:bg-[#0F172A] dark:text-[#60A5FA]">
                    <Mic className="h-3.5 w-3.5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-display font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {voiceAssistantStatus === 'Listening'
                        ? 'Listening…'
                        : voiceAssistantStatus === 'Transcribing'
                          ? 'Understanding Kanglish speech…'
                          : `Voice Assistant: ${voiceAssistantStatus}`}
                    </span>
                    {voiceAssistantStatus === 'Listening' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-rose-600 tabular-nums dark:text-rose-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                        {formatRecordingTimer(recordingSeconds)}
                      </span>
                    )}
                    {voiceAssistantStatus === 'Listening' && interimTranscript && (
                      <span className="truncate text-[11px] text-[#2563EB] dark:text-[#60A5FA]">
                        · &ldquo;{interimTranscript}&rdquo;
                      </span>
                    )}
                  </div>
                  {voiceAssistantStatus === 'Listening' && (
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      Speak naturally in Kanglish, ಕನ್ನಡ, or English, then click Stop to review.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isListening && (
                  <>
                    <button
                      type="button"
                      onClick={stopListening}
                      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap dark:bg-[#3B82F6]"
                    >
                      <Square className="h-3 w-3 fill-current" />
                      <span>Stop</span>
                    </button>
                    <button
                      type="button"
                      onClick={cancelListening}
                      className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#64748B] transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 whitespace-nowrap dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#94A3B8] dark:hover:border-rose-700 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
                  </>
                )}

                {!isListening && voiceAssistantStatus === 'Speaking' && (
                  <button
                    type="button"
                    onClick={stopTts}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 whitespace-nowrap"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    <span>Stop Voice</span>
                  </button>
                )}

                {/* 3-Way Response Language Preference: ಕನ್ನಡ | Kanglish | English */}
                <div
                  role="group"
                  aria-label="Response language preference"
                  className="inline-flex items-center rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-0.5 dark:border-[#334155] dark:bg-[#0F172A]"
                >
                  <span
                    className="hidden items-center px-1.5 text-[#64748B] sm:inline-flex dark:text-[#94A3B8]"
                    title="Response Language"
                  >
                    <Languages className="h-3.5 w-3.5" />
                  </span>
                  {(
                    [
                      { id: 'kn', label: 'ಕನ್ನಡ' },
                      { id: 'kanglish', label: 'Kanglish' },
                      { id: 'en', label: 'English' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleChangeResponseLanguage(opt.id)}
                      aria-pressed={responseLanguage === opt.id}
                      className={`min-h-[28px] rounded-md px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        responseLanguage === opt.id
                          ? 'bg-[#2563EB] text-white dark:bg-[#3B82F6]'
                          : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {isSpeechSupported && (
                  <select
                    value={speechLang}
                    onChange={(e) =>
                      handleSpeechLanguageChange(e.target.value as SpeechRecognitionLanguage)
                    }
                    aria-label="Voice input mode"
                    className="min-h-[32px] rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2 py-1 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC] dark:focus:border-[#60A5FA]"
                  >
                    <option value="auto">Mic: Auto (Kanglish / ಕನ್ನಡ / EN)</option>
                    <option value="kn-IN">Mic: ಕನ್ನಡ (Kannada)</option>
                    <option value="en-IN">Mic: Kanglish / Indian EN</option>
                    <option value="en-US">Mic: English (US)</option>
                  </select>
                )}

                <button
                  type="button"
                  role="switch"
                  aria-checked={autoSpeak}
                  onClick={handleToggleAutoSpeak}
                  className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap ${
                    autoSpeak
                      ? 'border-[#2563EB] bg-[#2563EB] text-white dark:border-[#3B82F6] dark:bg-[#3B82F6]'
                      : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] hover:border-[#3B82F6] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC] dark:hover:border-[#60A5FA]'
                  }`}
                >
                  {autoSpeak ? (
                    <Volume2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5 shrink-0 text-[#64748B] dark:text-[#94A3B8]" />
                  )}
                  <span className="hidden sm:inline">Auto Speak</span>
                </button>
              </div>
            </div>

            {/* Transcription Preview Card (Editable in Input Box Before Submission) */}
            {transcriptionMeta && !isListening && !isTranscribing && (
              <div className="mb-2 flex items-center justify-between gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] px-3 py-1.5 text-xs dark:border-[#334155] dark:bg-[#1E293B]">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-[#2563EB]/12 px-2 py-0.5 text-[11px] font-semibold text-[#2563EB] dark:bg-[#3B82F6]/20 dark:text-[#60A5FA]">
                    {transcriptionMeta.detectedInputType}
                  </span>
                  <span className="truncate text-[#64748B] dark:text-[#94A3B8]">
                    {transcriptionMeta.kannadaRepresentation
                      ? `Understood: ${transcriptionMeta.kannadaRepresentation}`
                      : `Heard: "${transcriptionMeta.rawTranscription}"`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearTranscriptionMeta}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-black/5 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-white/10 dark:hover:text-[#F8FAFC]"
                  aria-label="Dismiss transcription preview"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Attached Screenshot Preview Card */}
            {attachment && (
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9] p-2.5 shadow-xs dark:border-[#334155] dark:bg-[#1E293B]">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    referrerPolicy="no-referrer"
                    className="h-14 w-14 shrink-0 rounded-xl border border-[#E2E8F0] object-cover dark:border-[#334155]"
                  />
                  <div className="min-w-0">
                    <p className="max-w-[200px] truncate font-display text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {attachment.name}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      Chat screenshot attached · Ready for Gemini analysis
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={isLoading || isTranscribing}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] disabled:opacity-50 whitespace-nowrap dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA] dark:hover:text-[#0F172A]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Analyze Screenshot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B] transition-colors hover:bg-rose-50 hover:text-rose-700 dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
                    aria-label="Remove attached screenshot"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Main Composer Box */}
            <div className="flex items-end gap-1.5 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-2 shadow-sm transition-colors duration-200 focus-within:border-[#2563EB] focus-within:ring-3 focus-within:ring-[#3B82F6]/20 dark:border-[#334155] dark:bg-[#1E293B] dark:focus-within:border-[#60A5FA]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload chat screenshot"
              />

              {/* Upload Screenshot Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isTranscribing}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] disabled:opacity-50 dark:text-[#94A3B8] dark:hover:bg-[#0F172A] dark:hover:text-[#60A5FA]"
                aria-label="Upload screenshot"
                title="Upload chat screenshot"
              >
                <ImagePlus className="h-5 w-5" />
              </button>

              {/* Microphone Voice-to-Text Button */}
              <button
                type="button"
                onClick={handleMicToggle}
                disabled={isLoading || isTranscribing}
                className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] disabled:opacity-50 ${
                  isListening
                    ? 'animate-pulse bg-rose-600 text-white shadow-sm hover:bg-rose-700'
                    : isSpeechSupported
                      ? 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#2563EB] dark:text-[#94A3B8] dark:hover:bg-[#0F172A] dark:hover:text-[#60A5FA]'
                      : 'text-[#64748B]/60 hover:bg-[#F1F5F9] dark:text-[#94A3B8]/50 dark:hover:bg-[#0F172A]'
                }`}
                aria-label={isListening ? 'Stop voice recording' : 'Speak in Kanglish, Kannada, or English'}
                title={
                  isListening
                    ? 'Stop voice recording'
                    : 'Speak in Kanglish, ಕನ್ನಡ, or English'
                }
              >
                {isTranscribing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
                ) : isListening ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>

              {/* Editable Message / Transcript Textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputText(val);
                  if (!val.trim()) clearTranscriptionMeta();
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Speak or type in Kanglish, ಕನ್ನಡ, or English — or paste a chat/screenshot…"
                className="max-h-[168px] min-h-[44px] flex-1 resize-none bg-transparent py-2.5 pl-1 text-[15px] leading-relaxed text-[#0F172A] placeholder:text-[#64748B] focus:outline-none dark:text-[#F8FAFC] dark:placeholder:text-[#94A3B8]"
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!canSend || isTranscribing}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-sm transition-colors hover:bg-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#64748B] disabled:shadow-none dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA] dark:hover:text-[#0F172A] dark:disabled:bg-[#334155] dark:disabled:text-[#94A3B8]"
                aria-label="Send message"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 px-1 text-center text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Understands spoken &amp; typed Kanglish, ಕನ್ನಡ, and English · Edit transcripts before sending
            </p>
          </div>
        </footer>

        {/* Drag-and-drop overlay */}
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[#0F172A]/60 p-6 backdrop-blur-xs">
            <div className="rounded-2xl border-2 border-dashed border-[#3B82F6] bg-[#FFFFFF] px-8 py-6 text-center shadow-2xl dark:border-[#60A5FA] dark:bg-[#1E293B]">
              <ImagePlus className="mx-auto h-9 w-9 text-[#2563EB] dark:text-[#60A5FA]" />
              <p className="mt-2 font-display text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Drop screenshot to analyze
              </p>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                PNG, JPEG, WebP, or GIF up to 10 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Safety Helplines Modal */}
      <SafetyHelplinesModal
        isOpen={isHelplinesOpen}
        onClose={() => setIsHelplinesOpen(false)}
      />

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/80 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -right-2 -top-2 flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full bg-[#FFFFFF] text-[#0F172A] shadow-lg hover:bg-[#F1F5F9] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:hover:bg-[#334155]"
              aria-label="Close image preview"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.alt}
              referrerPolicy="no-referrer"
              className="max-h-[85vh] w-auto rounded-2xl border border-[#E2E8F0] object-contain shadow-2xl dark:border-[#334155]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
