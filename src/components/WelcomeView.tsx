import { motion } from 'motion/react';
import { ImagePlus, Languages, MessageSquareText, Sparkles } from 'lucide-react';
import { SurakshiniLogo } from './SurakshiniLogo';

interface WelcomeViewProps {
  onSelectPrompt: (prompt: string) => void;
  onTriggerUpload: () => void;
}

const STARTER_CARDS = [
  {
    id: 'kannada-kanglish',
    title: 'Check Kannada & Kanglish',
    subtitle: 'Understand Kannada script and Kanglish code-mixed chats in full cultural context.',
    prompt:
      'ಈ Kanglish ಮತ್ತು ಕನ್ನಡ ಮೆಸೇಜ್ ಪರಿಶೀಲಿಸಿ: "Avnu nanna bagge group alli full waste tara mathadtidane, ನಿನ್ನ ಮುಖ ನೋಡ್ಕೋ ಮೊದಲು"',
    Icon: Languages,
    type: 'prompt' as const,
  },
  {
    id: 'analyze-message',
    title: 'Analyze a Message',
    subtitle: 'Check a suspicious DM or comment for harassment, threats, or hidden intimidation.',
    prompt:
      'Analyze this message: "Nobody at college even wants you around, just delete your account before everyone sees how pathetic you are."',
    Icon: MessageSquareText,
    type: 'prompt' as const,
  },
  {
    id: 'detect-cyberbullying',
    title: 'Detect Cyberbullying',
    subtitle: 'Distinguish friendly teasing and banter from targeted online bullying.',
    prompt:
      'My friend texted "bro you are literally the worst at Fifa lol uninstall", is this friendly teasing or cyberbullying? Explain the context.',
    Icon: Sparkles,
    type: 'prompt' as const,
  },
  {
    id: 'analyze-screenshot',
    title: 'Analyze Chat Screenshot',
    subtitle: 'Upload or paste any conversation screenshot for instant OCR and safety guidance.',
    prompt: '',
    Icon: ImagePlus,
    type: 'upload' as const,
  },
];

export function WelcomeView({ onSelectPrompt, onTriggerUpload }: WelcomeViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12"
    >
      <div className="flex flex-col items-center text-center">
        <SurakshiniLogo size={56} className="rounded-2xl" />

        <h1
          className="mt-5 font-display text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl dark:text-[#F8FAFC]"
          style={{ textWrap: 'balance' }}
        >
          SURAKSHINI AI
        </h1>

        <p className="mt-2 font-display text-base font-medium text-[#2563EB] sm:text-lg dark:text-[#60A5FA]">
          Making Every Conversation Safer with AI.
        </p>

        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#64748B] sm:text-[15px] dark:text-[#94A3B8]">
          Hello! I&apos;m Surakshini, your AI-powered digital safety companion. Whether it&apos;s a
          suspicious message, online harassment or cyberbullying, I&apos;m here to help you.
        </p>
      </div>

      <div className="mt-8 grid w-full gap-3.5 sm:grid-cols-2">
        {STARTER_CARDS.map((card, index) => {
          const Icon = card.Icon;
          return (
            <motion.button
              key={card.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.04 * index, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => {
                if (card.type === 'upload') {
                  onTriggerUpload();
                } else {
                  onSelectPrompt(card.prompt);
                }
              }}
              className="group flex min-h-[112px] flex-col items-start justify-between rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9] p-4.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3B82F6] hover:bg-[#FFFFFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] dark:border-[#334155] dark:bg-[#1E293B] dark:hover:border-[#60A5FA] dark:hover:bg-[#1E293B]/80"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-display text-sm font-semibold text-[#0F172A] transition-colors group-hover:text-[#2563EB] dark:text-[#F8FAFC] dark:group-hover:text-[#60A5FA]">
                  {card.title}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFFFFF] text-[#2563EB] transition-transform duration-200 group-hover:scale-105 dark:bg-[#0F172A] dark:text-[#60A5FA]">
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                {card.subtitle}
              </p>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
