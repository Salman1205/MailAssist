"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import { CheckCircle2, Shield, Zap } from "lucide-react"

interface GmailConnectProps {
  onConnect: () => void
}

const FEATURES = [
  {
    title: "Your unique tone",
    description: "Drafts automatically match your voice, sign-offs, and cadence.",
    icon: CheckCircle2,
  },
  {
    title: "Privacy first",
    description: "Your data stays encrypted and scoped to your Gmail account.",
    icon: Shield,
  },
  {
    title: "Instant workflow",
    description: "Reply directly from MailAssist with edits that stick.",
    icon: Zap,
  },
]

export default function GmailConnect({ onConnect }: GmailConnectProps) {
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    try {
      setConnecting(true)
      onConnect?.()
      const response = await fetch("/api/auth/gmail")

      if (!response.ok) {
        throw new Error("Failed to get auth URL")
      }

      const { authUrl } = await response.json()
      window.location.href = authUrl
    } catch (error) {
      console.error("Error connecting Gmail:", error)
      alert("Failed to connect Gmail. Please try again.")
      setConnecting(false)
    }
  }

  return (
    <div className="w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-16">
        <div className="rounded-3xl border border-border bg-card/95 shadow-2xl backdrop-blur flex flex-col gap-10 lg:flex-row lg:items-center p-6 sm:p-10">
          <div className="flex-1 space-y-6 text-center lg:text-left">
            <Logo size="large" showText />
            <div className="inline-flex items-center justify-center rounded-full bg-primary/15 px-4 py-1 text-xs font-semibold text-primary lg:justify-start">
              Built for recruiters & founders
            </div>
            <div className="space-y-4">
              <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">
                Write replies that sound exactly like you—on any device.
              </h1>
              <p className="text-base text-muted-foreground sm:text-lg">
                MailAssist learns from your sent mail, drafts thoughtful replies, and lets you send them without leaving
                the app. No templates. No uncanny tone shifts.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
              <div className="rounded-2xl bg-secondary/60 px-5 py-3 text-left">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Embeddings generated</p>
                <p className="text-2xl font-semibold text-foreground">500+</p>
              </div>
              <div className="rounded-2xl bg-secondary/60 px-5 py-3 text-left">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg setup time</p>
                <p className="text-2xl font-semibold text-foreground">~3 min</p>
              </div>
            </div>
            <div className="space-y-2">
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full sm:w-auto sm:min-w-[220px] h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-base shadow-sm disabled:opacity-60"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Connect Gmail Account
              </Button>
              <p className="text-xs text-muted-foreground sm:text-sm">No credit card. OAuth with your Google account.</p>
            </div>
          </div>

          <div className="flex-1 w-full">
            <div className="rounded-2xl border border-border bg-background/80 p-6 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
              <div className="mt-4 space-y-4 rounded-xl border border-dashed border-border/60 p-4 text-left">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Thread</p>
                  <p className="font-semibold text-foreground">“Reminder for tomorrow’s onsite”</p>
                </div>
                <div className="rounded-lg bg-secondary/70 p-3 text-sm text-muted-foreground">
                  “Got it—see you at 10am! I’ll bring the updated figures so we can finalize the offer.”
                </div>
                <div className="rounded-lg bg-primary/10 p-3 text-xs text-primary">
                  Embedding 42 of 179 sent emails…
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, description, icon: Icon }) => (
            <div key={title} className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
