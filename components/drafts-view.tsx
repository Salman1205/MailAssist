"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface Draft {
  id: string
  emailId: string
  subject: string
  from: string
  to: string
  originalBody: string
  draftText: string
  createdAt: string
}

interface DraftsViewProps {
  refreshKey: number
}

export default function DraftsView({ refreshKey }: DraftsViewProps) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDrafts()
  }, [refreshKey])

  const loadDrafts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/drafts", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to load drafts")
      }
      const data = await response.json()
      setDrafts(data.drafts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drafts")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Loading drafts...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3">
        <div className="text-sm text-destructive">{error}</div>
        <Button variant="outline" onClick={loadDrafts}>
          Retry
        </Button>
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-base font-semibold text-foreground">No drafts yet</p>
          <p className="text-sm text-muted-foreground">
            Generate a reply from the inbox and it will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 overflow-y-auto h-full">
      {drafts.map((draft) => (
        <Card key={draft.id} className="p-4 space-y-3 border border-border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{draft.subject || "(No subject)"}</p>
              <p className="text-xs text-muted-foreground">To: {draft.to || "Unknown recipient"}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(draft.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="bg-muted/40 rounded-md p-3 text-xs text-muted-foreground whitespace-pre-wrap">
            {draft.originalBody || "No original message available."}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Suggested Reply</p>
            <textarea
              className="w-full h-40 p-3 border border-border rounded-md bg-input text-sm text-foreground resize-none"
              value={draft.draftText}
              readOnly
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="flex-1"
              onClick={() => handleCopy(draft.draftText)}
            >
              Copy Draft
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${draft.emailId}`, "_blank")}
            >
              View Thread
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
























