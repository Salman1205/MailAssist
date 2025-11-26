"use client"

import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { X } from "lucide-react"

interface SyncStats {
  totalStored: number
  sentWithEmbeddings: number
  completedReplies: number
  pendingReplies: number
  lastSync: number | null
  processing?: boolean
  queued?: number
  processed?: number
  errors?: number
}

interface SyncToastProps {
  syncing: boolean
  status: SyncStats | null
  processed: number
  target: number | null
  error?: string | null
  onDismiss?: () => void
}

export default function SyncToast({ syncing, status, processed, target, error, onDismiss }: SyncToastProps) {
  // Show toast if syncing, has error, or just completed (pending === 0 and processed > 0)
  const isComplete = !syncing && !error && status?.pendingReplies === 0 && processed > 0
  
  if (!syncing && !error && !isComplete) return null

  const effectiveTarget = target ?? status?.queued ?? null
  const progress = effectiveTarget ? Math.min(1, Math.max(0, processed / effectiveTarget)) : (isComplete ? 1 : 0)

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-xs sm:max-w-sm">
      <Card className="border border-primary/40 bg-card/95 backdrop-blur shadow-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {error ? "Embedding failed" : isComplete ? "Embedding complete!" : syncing ? "Processing your sent emails" : "Embedding complete"}
            </p>
            <p className="text-xs text-muted-foreground">
              {error
                ? error
                : isComplete
                ? `Successfully embedded ${processed} emails.`
                : "We're learning your tone so drafts match how you write."}
            </p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary"
              aria-label="Dismiss sync status"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {!error && (
          <>
            <Progress value={progress * 100} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {processed} embedded
                {status?.pendingReplies !== undefined ? ` · ${status.pendingReplies} pending` : ""}
              </span>
              <span>
                {effectiveTarget
                  ? `${Math.round(progress * 100)}% of ${effectiveTarget}`
                  : `${status?.sentWithEmbeddings ?? 0} total`}
              </span>
            </div>
            {status?.errors ? (
              <div className="text-[11px] text-destructive">Errors: {status.errors}</div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  )
}

