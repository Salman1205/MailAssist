"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

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

interface SettingsViewProps {
  status: SyncStats | null
  syncing: boolean
  onSync: (maxResults?: number) => Promise<void>
  error?: string | null
}

export default function SettingsView({ status, syncing, onSync, error }: SettingsViewProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const formatLastSync = () => {
    if (!status?.lastSync) return "Never"
    return new Date(status.lastSync).toLocaleString()
  }

  const handleSyncClick = async () => {
    setMessage(null)
    setLocalError(null)
    try {
      await onSync(500)
      setMessage("Sync started in the background. Keep the tab open while we learn your tone.")
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to start sync")
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Card className="border border-border p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Account Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Keep your sent emails synchronized so AI drafts match your exact tone.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Emails embedded</p>
            <p className="text-2xl font-semibold text-foreground mt-2">
              {status?.sentWithEmbeddings ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Replies pending</p>
            <p className="text-2xl font-semibold text-foreground mt-2">
              {status?.pendingReplies ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Last sync</p>
            <p className="text-sm font-medium text-foreground mt-2">
              {formatLastSync()}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleSyncClick}
            disabled={syncing}
            className="w-full sm:w-auto"
          >
            {syncing ? "Syncing..." : "Sync Sent Emails"}
          </Button>

          {message && (
            <div className="text-sm text-emerald-600 bg-emerald-600/10 border border-emerald-200 rounded-md px-3 py-2">
              {message}
            </div>
          )}

          {(error || localError) && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error || localError}
            </div>
          )}
        </div>
      </Card>

      <Card className="border border-border p-6 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">How syncing works</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li>We fetch your sent emails securely via Gmail OAuth.</li>
          <li>Each email is stored locally and converted into an embedding vector.</li>
          <li>When you generate drafts, we compare the new email to your historical tone.</li>
          <li>You can re-run the sync anytime to capture new sent emails.</li>
        </ul>
      </Card>
    </div>
  )
}

