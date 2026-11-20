import { ExternalLink, Info, Phone, X } from 'lucide-react';

interface SafetyHelplinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SafetyHelplinesModal({ isOpen, onClose }: SafetyHelplinesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="helplines-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 text-[#0F172A] shadow-xl transition-colors duration-200 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#2563EB] dark:bg-[#0F172A] dark:text-[#60A5FA]">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="helplines-title"
                className="font-display text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]"
              >
                Digital Safety &amp; Helplines
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Immediate support if harassment escalates or feels unsafe
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#0F172A] dark:hover:text-[#F8FAFC]"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-[#0F172A] dark:text-[#F8FAFC]">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-4 dark:border-[#334155] dark:bg-[#0F172A]">
            <h3 className="font-display text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              India National Cyber Crime Support
            </h3>
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[#64748B] dark:text-[#94A3B8]">
                  <Phone className="h-4 w-4 text-[#2563EB] dark:text-[#60A5FA]" />
                  <span>Cyber Crime Helpline</span>
                </span>
                <span className="font-mono font-semibold text-[#0F172A] tabular-nums dark:text-[#F8FAFC]">
                  1930
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#64748B] dark:text-[#94A3B8]">
                  National Cyber Crime Portal
                </span>
                <a
                  href="https://cybercrime.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#2563EB] hover:underline dark:text-[#60A5FA]"
                >
                  <span>cybercrime.gov.in</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#64748B] dark:text-[#94A3B8]">
                  Women &amp; Child Emergency
                </span>
                <span className="font-mono font-semibold text-[#0F172A] tabular-nums dark:text-[#F8FAFC]">
                  1091 · 1098
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 dark:border-[#334155] dark:bg-[#0F172A]">
            <h3 className="font-display text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Emotional Support &amp; Wellbeing
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
              Online bullying can feel isolating. If you feel overwhelmed, speak with a trusted
              friend, parent, or counselor. In India, Tele-MANAS mental health support is available
              24/7 at{' '}
              <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                14416
              </span>{' '}
              or{' '}
              <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                1800-891-4416
              </span>
              .
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-4 dark:border-[#334155] dark:bg-[#0F172A]">
            <h3 className="font-display text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              Quick Evidence Checklist
            </h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
              <li>Take uncropped screenshots showing usernames, dates, and timestamps.</li>
              <li>Copy the profile URL or message link before blocking the sender.</li>
              <li>Mute, restrict, or block the account to stop ongoing contact immediately.</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA] dark:hover:text-[#0F172A]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
