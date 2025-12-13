"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Copy, ExternalLink, Mail, Clock, FileText, Sparkles, AlertCircle, Check } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

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
  currentUserId: string | null
}

export default function DraftsView({ refreshKey, currentUserId }: DraftsViewProps) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadDrafts()
  }, [refreshKey, currentUserId])

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

  const handleCopy = (text: string, draftId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(draftId)
    toast({ 
      title: "Copied to clipboard",
      description: "Draft text has been copied"
    })
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatTimeAgo = (dateString: string) => {
    const diff = Date.now() - new Date(dateString).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    const minutes = Math.floor(diff / (1000 * 60))
    return minutes > 0 ? `${minutes}m ago` : 'Just now'
  }

  if (loading) {
    return (
      <div className="h-full w-full overflow-y-auto bg-gradient-to-br from-muted/20 via-background to-muted/30">
        <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-24 w-full" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-muted/20 via-background to-muted/30">
        <Card className="p-8 max-w-md mx-4 shadow-lg border-[var(--status-urgent)]/30">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--status-urgent-bg)] flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-[var(--status-urgent)]" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Failed to load drafts</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={loadDrafts} className="shadow-sm">
              Try again
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted/20 via-background to-muted/30">
        <Card className="p-12 max-w-md mx-4 shadow-lg">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">No drafts yet</h3>
              <p className="text-sm text-muted-foreground">
                Generate AI-powered replies from your inbox and they'll appear here for review.
              </p>
            </div>
            <Badge variant="secondary" className="mt-2">
              <Sparkles className="w-3 h-3 mr-1" />
              AI-generated drafts
            </Badge>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-gradient-to-br from-muted/20 via-background to-muted/30">
      <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">AI Drafts</h1>
                <p className="text-sm text-muted-foreground">
                  {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'} ready for review
                </p>
              </div>
            </div>
          </div>
          <Button onClick={loadDrafts} variant="outline" size="sm" className="shadow-sm">
            Refresh
          </Button>
        </div>

        <div className="grid gap-4">
          {drafts.map((draft, index) => (
            <Card 
              key={draft.id} 
              className="overflow-hidden shadow-md border-border/60 hover:shadow-lg transition-all duration-200 hover:scale-[1.01]"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b border-border/50 pb-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <h3 className="font-semibold text-base break-words line-clamp-2">
                        {draft.subject || "(No subject)"}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      To: {draft.to || "Unknown recipient"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Generated
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(draft.createdAt)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4 pb-8">
                {draft.originalBody && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Mail className="w-3 h-3" />
                      Original message
                    </p>
                    <div className="bg-muted/40 rounded-lg p-4 text-sm text-muted-foreground max-h-32 overflow-y-auto border border-border/30">
                      <p className="whitespace-pre-wrap break-words line-clamp-4">
                        {draft.originalBody}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-medium text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-primary flex items-center justify-center">
                      <Sparkles className="w-2.5 h-2.5 text-white" />
                    </div>
                    AI-suggested reply
                  </div>
                  <div className="relative">
                    <div className="bg-background border-2 border-primary/20 rounded-lg p-4 text-sm leading-relaxed max-h-64 overflow-y-auto shadow-sm">
                      <p className="whitespace-pre-wrap break-words font-mono">
                        {draft.draftText}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-6 mt-6 border-t border-border/30">
                  <Button
                    className="flex-1 shadow-sm bg-primary hover:bg-primary/90 hover:shadow-md transition-all"
                    onClick={() => handleCopy(draft.draftText, draft.id)}
                  >
                    {copiedId === draft.id ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy draft
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 shadow-sm hover:shadow-md transition-all"
                    onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${draft.emailId}`, "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View in Gmail
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}



























