import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Info,
  OctagonAlert,
} from 'lucide-react';
import type { SafetyAnalysis, SeverityLevel } from '../types/chat';

interface SafetyAnalysisCardProps {
  analysis: SafetyAnalysis;
}

function getSeverityDisplay(severity: SeverityLevel) {
  switch (severity) {
    case 'Critical':
      return {
        label: 'Severity: Critical',
        textClass: 'text-rose-700 dark:text-rose-300',
        bgClass: 'bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:border-rose-800',
        Icon: OctagonAlert,
      };
    case 'High':
      return {
        label: 'Severity: High',
        textClass: 'text-red-700 dark:text-red-300',
        bgClass: 'bg-red-50 border-red-200 dark:bg-red-950/60 dark:border-red-800',
        Icon: OctagonAlert,
      };
    case 'Medium':
      return {
        label: 'Severity: Medium',
        textClass: 'text-amber-700 dark:text-amber-300',
        bgClass: 'bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:border-amber-800',
        Icon: AlertTriangle,
      };
    case 'Low':
      return {
        label: 'Severity: Low',
        textClass: 'text-[#2563EB] dark:text-[#60A5FA]',
        bgClass: 'bg-[#FFFFFF] border-[#E2E8F0] dark:bg-[#0F172A] dark:border-[#334155]',
        Icon: Info,
      };
    default:
      return {
        label: 'Severity: None',
        textClass: 'text-[#0F172A] dark:text-[#F8FAFC]',
        bgClass: 'bg-[#FFFFFF] border-[#E2E8F0] dark:bg-[#0F172A] dark:border-[#334155]',
        Icon: CheckCircle2,
      };
  }
}

export function SafetyAnalysisCard({ analysis }: SafetyAnalysisCardProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const severityInfo = getSeverityDisplay(analysis.severity);
  const SeverityIcon = severityInfo.Icon;

  const isBorderline =
    analysis.detectionResult.toLowerCase().includes('borderline') ||
    analysis.detectionResult.toLowerCase().includes('potential');

  const ResultIcon = !analysis.isHarmful
    ? CheckCircle2
    : isBorderline
      ? AlertTriangle
      : OctagonAlert;

  const resultTone = !analysis.isHarmful
    ? 'text-[#2563EB] dark:text-[#60A5FA]'
    : isBorderline
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-rose-700 dark:text-rose-300';

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => {
        setCopiedIndex((current) => (current === index ? null : current));
      }, 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 transition-colors duration-200 sm:p-5 dark:border-[#334155] dark:bg-[#0F172A]">
      {/* Header Row: Detection Result + Explicit Severity */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className={`flex items-center gap-2 font-display text-sm font-semibold ${resultTone}`}>
            <ResultIcon className="h-4 w-4 shrink-0" />
            <span>{analysis.detectionResult}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <span>Language: {analysis.detectedLanguage}</span>
            {analysis.categories && analysis.categories.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>Category: {analysis.categories.join(', ')}</span>
              </>
            )}
          </div>
        </div>

        <div
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${severityInfo.bgClass} ${severityInfo.textClass}`}
        >
          <SeverityIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{severityInfo.label}</span>
        </div>
      </div>

      {/* Extracted Text */}
      {analysis.extractedText && analysis.extractedText.trim().length > 0 && (
        <div className="mt-4 border-t border-[#E2E8F0] pt-3.5 dark:border-[#334155]">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
            <FileText className="h-3.5 w-3.5 shrink-0 text-[#2563EB] dark:text-[#60A5FA]" />
            <span>Text Read from Content</span>
          </div>
          <p className="whitespace-pre-wrap rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] px-3.5 py-2.5 text-sm leading-relaxed text-[#0F172A] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC]">
            {analysis.extractedText}
          </p>
        </div>
      )}

      {/* Simple Explanation & Contextual Reasoning */}
      <div className="mt-4 grid gap-4 border-t border-[#E2E8F0] pt-4 sm:grid-cols-2 dark:border-[#334155]">
        <div>
          <h5 className="font-display text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Explanation
          </h5>
          <p className="mt-1 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
            {analysis.explanation}
          </p>
        </div>
        <div>
          <h5 className="font-display text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Contextual Reasoning
          </h5>
          <p className="mt-1 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
            {analysis.contextualReasoning}
          </p>
        </div>
      </div>

      {/* Suggested Safe Responses */}
      {analysis.suggestedSafeResponses && analysis.suggestedSafeResponses.length > 0 && (
        <div className="mt-4 border-t border-[#E2E8F0] pt-4 dark:border-[#334155]">
          <h5 className="font-display text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Suggested Safe Replies
          </h5>
          <div className="mt-2 space-y-2">
            {analysis.suggestedSafeResponses.map((replyText, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] px-3.5 py-2.5 dark:border-[#334155] dark:bg-[#1E293B]"
              >
                <p className="text-sm leading-relaxed text-[#0F172A] dark:text-[#F8FAFC]">
                  {replyText}
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy(replyText, idx)}
                  className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-xs font-medium text-[#0F172A] transition-colors hover:border-[#3B82F6] hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#F8FAFC] dark:hover:border-[#60A5FA] dark:hover:text-[#60A5FA]"
                  aria-label="Copy suggested response"
                >
                  {copiedIndex === idx ? (
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Safety Actions */}
      {analysis.recommendedSafetyActions && analysis.recommendedSafetyActions.length > 0 && (
        <div className="mt-4 border-t border-[#E2E8F0] pt-4 dark:border-[#334155]">
          <h5 className="font-display text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            Recommended Actions
          </h5>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
            {analysis.recommendedSafetyActions.map((action, idx) => (
              <li key={idx}>{action}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
