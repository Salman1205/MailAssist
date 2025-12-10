"use client"

import { Sparkles } from 'lucide-react'

export type SidebarView =
  | "inbox"
  | "sent"
  | "spam"
  | "trash"
  | "drafts"
  | "settings"
  | "users"
  | "tickets"
  | "ai-settings"
  | "quick-replies"

interface SidebarProps {
  activeView: SidebarView
  setActiveView: (view: SidebarView) => void
  onLogout?: () => void
  currentUser?: { id: string; name: string; role: string } | null
}

const NAV_ITEMS = [
  { id: "inbox", label: "Inbox", icon: InboxIcon },
  { id: "sent", label: "Sent", icon: SentIcon },
  { id: "spam", label: "Spam", icon: SpamIcon },
  { id: "trash", label: "Trash", icon: TrashIcon },
  { id: "tickets", label: "Tickets", icon: TicketIcon },
  { id: "drafts", label: "Drafts", icon: DraftIcon },
  { id: "quick-replies", label: "Quick Replies", icon: QuickRepliesIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const

const ADMIN_NAV_ITEMS = [
  { id: "users", label: "Team", icon: UsersIcon },
] as const

const AI_NAV_ITEMS = [
  { id: "ai-settings", label: "AI Customization", icon: SparklesIcon },
] as const

export default function Sidebar({ activeView, setActiveView, onLogout, currentUser }: SidebarProps) {
  const isAdmin = currentUser?.role === "admin"
  const isManager = currentUser?.role === "manager"
  return (
    <aside className="hidden md:flex w-60 bg-card border-r border-border flex-col">
      <nav className="flex-1 px-3 py-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left font-medium transition-all ${
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-secondary"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{item.label}</span>
            </button>
          )
        })}
        
        {isAdmin && (
          <>
            <div className="h-px bg-border my-2" />
            {ADMIN_NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id
              const Icon = item.icon

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left font-medium transition-all ${
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </button>
              )
            })}
          </>
        )}

        {(isAdmin || isManager) && (
          <>
            <div className="h-px bg-border my-2" />
            {AI_NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id
              const Icon = item.icon

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left font-medium transition-all ${
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{item.label}</span>
                </button>
              )
            })}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-foreground hover:bg-secondary transition-all font-medium"
        >
          <LogoutIcon className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </aside>
  )
}

function InboxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 7l1.68-3.36A2 2 0 0 1 6.48 2h11.04a2 2 0 0 1 1.8 1.64L21 7v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7z" />
      <path d="M3 13h5l2 3h4l2-3h5" />
    </svg>
  )
}

function SentIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M4 4l16 8-16 8 4-8-4-8z" />
    </svg>
  )
}

function SpamIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <polygon points="7 2 17 2 22 7 22 17 17 22 7 22 2 17 2 7 7 2" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  )
}

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function DraftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .66.39 1.26 1 1.51h.09c.61.24 1.3.1 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09c.24.61.9 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function TicketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 8h18" />
      <path d="M8 12h8" />
    </svg>
  )
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Sparkles className="w-5 h-5" {...props} />
}

function QuickRepliesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h8" />
      <path d="M8 14h6" />
    </svg>
  )
}

function LogoutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  )
}
