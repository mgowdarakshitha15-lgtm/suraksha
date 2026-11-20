import { LifeBuoy, MessageSquare, Plus, Trash2, X } from 'lucide-react';
import type { Conversation } from '../types/chat';
import { SurakshiniLogo } from './SurakshiniLogo';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  isOpenMobile: boolean;
  isCollapsedDesktop: boolean;
  onCloseMobile: () => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onOpenHelplines: () => void;
}

function formatDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function Sidebar({
  conversations,
  activeId,
  isOpenMobile,
  isCollapsedDesktop,
  onCloseMobile,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenHelplines,
}: SidebarProps) {
  const sidebarContent = (
    <div className="relative flex h-full w-[276px] flex-col overflow-hidden bg-[#F8FAFC] text-[#0F172A] transition-colors duration-200 dark:bg-[#111827] dark:text-[#F8FAFC]">
      {/* Brand Lockup */}
      <div className="relative flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3.5 dark:border-[#334155]">
        <div className="flex min-w-0 items-center gap-2.5">
          <SurakshiniLogo size={32} className="shrink-0" />
          <div className="min-w-0">
            <span className="block truncate font-display text-sm font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              SURAKSHINI AI
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCloseMobile}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] lg:hidden dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-[#F8FAFC]"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="relative p-3.5">
        <button
          type="button"
          onClick={() => {
            onNewConversation();
            onCloseMobile();
          }}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] whitespace-nowrap dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA] dark:hover:text-[#0F172A]"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Conversation History */}
      <div className="sidebar-scroll relative flex-1 overflow-y-auto px-2.5 py-1">
        <p className="px-2.5 pb-2 text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
          Conversations
        </p>

        {conversations.length === 0 ? (
          <p className="px-2.5 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Your conversation history appears here.
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conv) => {
              const isActive = conv.id === activeId;
              const msgCount = conv.messages.length;
              return (
                <li key={conv.id} className="group relative flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectConversation(conv.id);
                      onCloseMobile();
                    }}
                    className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 pr-10 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] ${
                      isActive
                        ? 'border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] shadow-2xs dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC]'
                        : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#1E293B]/60 dark:hover:text-[#F8FAFC]'
                    }`}
                  >
                    <MessageSquare
                      className={`h-4 w-4 shrink-0 ${
                        isActive
                          ? 'text-[#2563EB] dark:text-[#60A5FA]'
                          : 'text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{conv.title}</span>
                      <span className="block truncate text-[11px] text-[#64748B] tabular-nums dark:text-[#94A3B8]">
                        {msgCount === 0
                          ? 'New chat'
                          : `${msgCount} ${msgCount === 1 ? 'message' : 'messages'} · ${formatDateLabel(conv.updatedAt)}`}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="absolute right-1.5 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#64748B] opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] dark:text-[#94A3B8] dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
                    aria-label={`Delete conversation ${conv.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Bottom Utility */}
      <div className="relative space-y-2.5 border-t border-[#E2E8F0] p-3.5 dark:border-[#334155]">
        <button
          type="button"
          onClick={onOpenHelplines}
          className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 text-left text-xs font-medium text-[#0F172A] transition-colors hover:border-[#3B82F6] hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:hover:border-[#60A5FA] dark:hover:text-[#60A5FA]"
        >
          <LifeBuoy className="h-4 w-4 shrink-0 text-[#2563EB] dark:text-[#60A5FA]" />
          <span>Safety Helplines &amp; Reporting</span>
        </button>

        <p className="px-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
          ಕನ್ನಡ · Kanglish · English
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-[#E2E8F0] transition-all duration-200 lg:block dark:border-[#334155] ${
          isCollapsedDesktop ? 'w-0 overflow-hidden border-r-0' : 'w-[276px]'
        }`}
        aria-label="Conversation history"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[#0F172A]/65 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full shadow-2xl">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
