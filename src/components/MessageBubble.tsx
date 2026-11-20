import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Check,
  Copy,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import type { ChatMessage } from '../types/chat';
import type { VoiceOption } from '../hooks/useTextToSpeech';
import { MarkdownProse } from './MarkdownProse';
import { SafetyAnalysisCard } from './SafetyAnalysisCard';
import { SurakshiniLogo } from './SurakshiniLogo';

interface MessageBubbleProps {
  message: ChatMessage;
  isLatestAssistant: boolean;
  isLoading: boolean;
  onFollowUpClick: (prompt: string) => void;
  onPreviewImage: (imageUrl: string, alt: string) => void;
  onRetry?: () => void;
  ttsActiveMessageId: string | null;
  ttsPlaybackState: 'idle' | 'loading' | 'playing' | 'paused';
  ttsProgress: number;
  ttsElapsedSeconds: number;
  ttsDurationSeconds: number;
  ttsVoiceOptions: VoiceOption[];
  ttsSelectedVoiceId: string;
  onSpeakMessage: (message: ChatMessage, overrideVoiceId?: string) => void;
  onReplayMessage: (message: ChatMessage) => void;
  onPauseOrResumeTts: () => void;
  onStopTts: () => void;
  onChangeTtsVoice: (voiceId: string) => void;
}

function buildCopyableText(message: ChatMessage): string {
  const parts: string[] = [message.content];
  if (message.hasAnalysis && message.analysis) {
    const a = message.analysis;
    parts.push(
      `\nDetection Result: ${a.detectionResult}`,
      `Category: ${a.categories.join(', ')}`,
      `Severity: ${a.severity}`,
      `Explanation: ${a.explanation}`,
      `Contextual Reasoning: ${a.contextualReasoning}`
    );
    if (a.suggestedSafeResponses.length > 0) {
      parts.push(`Suggested Safe Replies:\n- ${a.suggestedSafeResponses.join('\n- ')}`);
    }
    if (a.recommendedSafetyActions.length > 0) {
      parts.push(`Recommended Actions:\n- ${a.recommendedSafetyActions.join('\n- ')}`);
    }
  }
  return parts.join('\n');
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MessageBubble({
  message,
  isLatestAssistant,
  isLoading,
  onFollowUpClick,
  onPreviewImage,
  onRetry,
  ttsActiveMessageId,
  ttsPlaybackState,
  ttsProgress,
  ttsElapsedSeconds,
  ttsDurationSeconds,
  ttsVoiceOptions,
  ttsSelectedVoiceId,
  onSpeakMessage,
  onReplayMessage,
  onPauseOrResumeTts,
  onStopTts,
  onChangeTtsVoice,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isSpeakingThis = ttsActiveMessageId === message.id && ttsPlaybackState !== 'idle';

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyableText(message));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-end"
      >
        <div className="max-w-[85%] space-y-2 rounded-2xl rounded-br-sm bg-[#2563EB] px-4 py-3 text-white shadow-sm sm:max-w-[75%] dark:bg-[#3B82F6] dark:text-[#F8FAFC]">
          {message.image && (
            <button
              type="button"
              onClick={() => onPreviewImage(message.image!.dataUrl, message.image!.name)}
              className="group block overflow-hidden rounded-xl border border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
              aria-label={`Preview uploaded screenshot ${message.image.name}`}
            >
              <img
                src={message.image.dataUrl}
                alt={message.image.name || 'Uploaded chat screenshot'}
                referrerPolicy="no-referrer"
                className="max-h-64 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.01]"
              />
            </button>
          )}
          {message.content && (
            <p className="whitespace-pre-wrap text-[15px] leading-[1.6]">{message.content}</p>
          )}
        </div>
        <span className="mt-1 px-1 text-[11px] text-[#64748B] tabular-nums dark:text-[#94A3B8]">
          You
          {message.voiceMetadata?.detectedInputType
            ? ` · Voice (${message.voiceMetadata.detectedInputType})`
            : ''}{' '}
          ·{' '}
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </motion.div>
    );
  }

  const clampedProgress = Math.max(0, Math.min(1, ttsProgress));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-3 sm:gap-4"
    >
      <div className="mt-0.5 shrink-0">
        <SurakshiniLogo size={34} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
          <span className="font-display font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            SURAKSHINI AI
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {message.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-xs dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
            <p>{message.content}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2.5 inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-1.5 text-xs font-medium text-rose-800 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-700 dark:bg-rose-900/60 dark:text-rose-100 dark:hover:bg-rose-900"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Try Again</span>
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl rounded-tl-sm border border-[#E2E8F0] bg-[#F1F5F9] px-4 py-3.5 transition-colors duration-200 sm:px-5 sm:py-4 dark:border-[#334155] dark:bg-[#1E293B]">
            <MarkdownProse content={message.content} />
            {message.hasAnalysis && message.analysis && (
              <SafetyAnalysisCard analysis={message.analysis} />
            )}

            {/* Response Actions Bar */}
            <div className="mt-3.5 space-y-2.5 border-t border-[#E2E8F0] pt-3 dark:border-[#334155]">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#0F172A] transition-colors hover:border-[#3B82F6] hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap shrink-0 dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC] dark:hover:border-[#60A5FA] dark:hover:text-[#60A5FA]"
                  aria-label="Copy AI response"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
                      <span className="text-[#2563EB] dark:text-[#60A5FA]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {!isSpeakingThis ? (
                  <button
                    type="button"
                    onClick={() => onSpeakMessage(message)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#2563EB] transition-colors hover:border-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap shrink-0 dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#60A5FA] dark:hover:border-[#60A5FA]"
                    aria-label="Listen to AI response"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Listen</span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-2 py-1 dark:border-[#334155] dark:bg-[#0F172A]">
                    {ttsPlaybackState === 'loading' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#2563EB] dark:text-[#60A5FA]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Preparing AI voice…</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={onPauseOrResumeTts}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#2563EB] transition-colors hover:bg-[#E2E8F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap dark:bg-[#1E293B] dark:text-[#60A5FA] dark:hover:bg-[#334155]"
                        aria-label={
                          ttsPlaybackState === 'paused' ? 'Resume playback' : 'Pause playback'
                        }
                      >
                        {ttsPlaybackState === 'paused' ? (
                          <>
                            <Play className="h-3.5 w-3.5" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="h-3.5 w-3.5" />
                            <span>Pause</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onReplayMessage(message)}
                      className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#E2E8F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:hover:bg-[#334155]"
                      aria-label="Replay AI response"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Replay</span>
                    </button>

                    <button
                      type="button"
                      onClick={onStopTts}
                      className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#64748B] transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap dark:bg-[#1E293B] dark:text-[#94A3B8] dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
                      aria-label="Stop playback"
                    >
                      <Square className="h-3 w-3 fill-current" />
                      <span>Stop</span>
                    </button>
                  </div>
                )}

                <select
                  value={ttsSelectedVoiceId}
                  onChange={(e) => {
                    const nextVoice = e.target.value;
                    onChangeTtsVoice(nextVoice);
                    if (isSpeakingThis) {
                      onSpeakMessage(message, nextVoice);
                    }
                  }}
                  aria-label="Select AI voice"
                  className="min-h-[36px] max-w-[215px] rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-xs text-[#0F172A] transition-colors hover:border-[#3B82F6] focus:border-[#2563EB] focus:outline-none dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC] dark:hover:border-[#60A5FA]"
                >
                  {ttsVoiceOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Playback Progress Indicator */}
              {isSpeakingThis && (
                <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 dark:border-[#334155] dark:bg-[#0F172A]">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#334155]">
                    <div
                      className="h-full rounded-full bg-[#2563EB] transition-all duration-150 dark:bg-[#3B82F6]"
                      style={{
                        width:
                          ttsPlaybackState === 'loading'
                            ? '18%'
                            : `${Math.round(clampedProgress * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-[#2563EB] tabular-nums whitespace-nowrap dark:text-[#60A5FA]">
                    {ttsPlaybackState === 'loading'
                      ? 'Generating…'
                      : ttsDurationSeconds > 0
                        ? `${formatAudioTime(ttsElapsedSeconds)} / ${formatAudioTime(ttsDurationSeconds)}`
                        : `${Math.round(clampedProgress * 100)}%`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {!message.isError &&
          message.followUpPrompts &&
          message.followUpPrompts.length > 0 && (
            <div
              className={`mt-3.5 transition-opacity duration-200 ${
                isLatestAssistant ? 'opacity-100' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div className="mb-2 flex items-center gap-1.5 px-0.5 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                <Sparkles
                  className="h-3.5 w-3.5 shrink-0 text-[#2563EB] dark:text-[#60A5FA]"
                  aria-hidden="true"
                />
                <span>ಮುಂದೆ ಏನು ತಿಳಿಯಲು ಬಯಸುತ್ತೀರಿ?</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {message.followUpPrompts.map((prompt, idx) => (
                  <button
                    key={`${message.id}_fu_${idx}`}
                    type="button"
                    disabled={isLoading}
                    onClick={() => onFollowUpClick(prompt)}
                    className="group inline-flex min-h-[38px] max-w-full items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] px-3.5 py-2 text-left text-xs font-medium text-[#0F172A] shadow-2xs transition-all duration-150 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:bg-[#FFFFFF] hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:hover:border-[#60A5FA] dark:hover:bg-[#111827] dark:hover:text-[#60A5FA]"
                  >
                    <span className="leading-snug">{prompt}</span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 shrink-0 text-[#2563EB] opacity-75 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 dark:text-[#60A5FA]"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
      </div>
    </motion.div>
  );
}
