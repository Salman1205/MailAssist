"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft } from "lucide-react"

interface EmailDetailProps {
  emailId: string
  onDraftGenerated?: () => void
  onBack?: () => void
}

interface EmailMessage {
  id: string
  threadId?: string
  subject: string
  from: string
  to: string
  date: string
  body: string
  snippet?: string
  labels?: string[]
}

interface EmailSummary {
  id: string
  threadId?: string
  subject: string
  from: string
  to: string
  date: string
  body: string
  snippet?: string
}

export default function EmailDetail({ emailId, onDraftGenerated, onBack }: EmailDetailProps) {
  const [threadMessages, setThreadMessages] = useState<EmailMessage[]>([])
  const [emailSummary, setEmailSummary] = useState<EmailSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDraft, setShowDraft] = useState(false)
  const [draftText, setDraftText] = useState("")
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const [sendResetTimer, setSendResetTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (sendResetTimer) {
        clearTimeout(sendResetTimer)
      }
    }
  }, [sendResetTimer])

  useEffect(() => {
    if (emailId) {
      // Reset draft/UI state whenever user selects a new email
      setShowDraft(false)
      setDraftText("")
      setCopied(false)
      setGenerating(false)
      setError(null)
      setEmailSummary(null)
      setThreadMessages([])
      fetchThread()
    }
  }, [emailId])

  const fetchThread = async () => {
    try {
      setLoading(true)
      setError(null)

      // 1) Fetch the individual email to get its threadId
      const emailResponse = await fetch(`/api/emails/${emailId}`)
      let threadId = emailId

      if (emailResponse.ok) {
        const emailData = await emailResponse.json()
        const email: EmailSummary = emailData.email
        setEmailSummary(email)
        threadId = email.threadId || email.id
      } else if (emailResponse.status === 404) {
        // If the specific message isn't cached or found, we can still try
        // to load the conversation using the provided id as a thread id.
        console.warn("Email not found, attempting to load conversation with thread id only")
      } else {
        const text = await emailResponse.text().catch(() => "")
        console.error("Failed to fetch email details", text)
        setError("Failed to fetch email details")
      }

      // 2) Fetch the full thread using threadId
      const threadResponse = await fetch(`/api/emails/threads/${encodeURIComponent(threadId)}`)

      if (threadResponse.ok) {
        const threadData = await threadResponse.json()
        setThreadMessages(threadData.thread?.messages || [])
        // Clear any previous transient errors now that we have conversation data
        setError(null)
      } else if (threadResponse.status === 404) {
        setError("Conversation not found")
        return
      } else {
        const text = await threadResponse.text().catch(() => "")
        console.error("Failed to fetch conversation", text)
        setError("Failed to fetch conversation")
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email')
      console.error('Error fetching email:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateDraft = async () => {
    if (!emailId) return
    
    try {
      setGenerating(true)
      setError(null)
      const response = await fetch(`/api/emails/${emailId}/draft`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate draft')
      }

      const data = await response.json()
      setDraftText(data.draft || '')
      setShowDraft(true)
      onDraftGenerated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate draft')
      console.error('Error generating draft:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(draftText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    await handleGenerateDraft()
  }

  const handleSendReply = async () => {
    if (!emailId) return

    if (!draftText.trim()) {
      setError("Draft is empty. Please edit it before sending.")
      return
    }

    setSendSuccess(false)

    try {
      setSending(true)
      setError(null)
      const response = await fetch(`/api/emails/${emailId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ draftText }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to send reply")
      }

      setSendSuccess(true)
      if (sendResetTimer) {
        clearTimeout(sendResetTimer)
      }
      setSendResetTimer(
        setTimeout(() => {
          setSendSuccess(false)
          setSendResetTimer(null)
        }, 3000)
      )
      toast({
        title: "Reply sent",
        description: "Your draft was delivered via Gmail.",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send reply"
      setError(message)
      setSendSuccess(false)
      toast({
        title: "Couldn't send reply",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center md:justify-start h-full px-6 md:pl-48 py-10">
        <div className="text-center md:text-left space-y-4 max-w-md">
          <div className="text-sm text-muted-foreground">Loading email...</div>
        </div>
      </div>
    )
  }

  if (error && threadMessages.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center space-y-2">
        {onBack && (
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="md:hidden self-start -mt-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to inbox
          </Button>
        )}
        <div className="text-sm text-destructive">{error}</div>
        <button
          onClick={fetchThread}
          className="text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (threadMessages.length === 0 && !emailSummary) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">No email selected</div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl h-full">
      {onBack && (
        <div className="md:hidden">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to inbox
          </Button>
        </div>
      )}
      <Card className="border border-border p-6 space-y-4 overflow-hidden">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            {threadMessages[threadMessages.length - 1]?.subject || emailSummary?.subject || "(No subject)"}
          </h2>
        </div>

        <div className="space-y-3 text-sm max-h-[55vh] overflow-auto pr-1">
          {threadMessages.map((msg, index) => (
            <div
              key={msg.id}
              className="mb-4 pb-4 border-b border-border last:border-b-0 last:pb-0"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {index === 0 ? "Conversation started" : "Message"}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {msg.from}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    To: {msg.to}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDate(msg.date)}
                </div>
              </div>
              <div className="mt-3 text-sm text-foreground whitespace-pre-wrap break-words">
                {msg.body || msg.snippet || "No content"}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      <Card className="border border-border p-6 space-y-4">
        <Button
          onClick={handleGenerateDraft}
          disabled={generating || showDraft}
          className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-medium rounded-lg h-11 transition-all disabled:opacity-60"
        >
          {generating ? "Generating..." : showDraft ? "Draft Generated" : "Generate AI Draft"}
        </Button>

        {showDraft && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">Suggested Draft</h3>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                className="w-full h-48 p-3 border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleSendReply}
                disabled={sending || sendSuccess}
                className="rounded-lg h-10 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {sendSuccess ? "Reply sent" : sending ? "Sending..." : "Send Reply"}
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="flex-1 rounded-lg h-10 border-border text-foreground hover:bg-secondary bg-transparent"
                >
                  {copied ? "✓ Copied!" : "Copy Draft"}
                </Button>
                <Button
                  onClick={handleRegenerate}
                  variant="outline"
                  className="flex-1 rounded-lg h-10 border-border text-foreground hover:bg-secondary bg-transparent"
                >
                  Regenerate
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
