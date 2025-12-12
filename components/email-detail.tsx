"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react"

interface EmailDetailProps {
  emailId: string
  onDraftGenerated?: () => void
  onBack?: () => void
  // Optional initial email data for instant display
  initialEmailData?: {
    subject?: string
    from?: string
    to?: string
    date?: string
    snippet?: string
    body?: string
    threadId?: string
  }
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

export default function EmailDetail({ emailId, onDraftGenerated, onBack, initialEmailData }: EmailDetailProps) {
  const [threadMessages, setThreadMessages] = useState<EmailMessage[]>([])
  const [emailSummary, setEmailSummary] = useState<EmailSummary | null>(
    initialEmailData ? {
      id: emailId,
      threadId: initialEmailData.threadId,
      subject: initialEmailData.subject || '',
      from: initialEmailData.from || '',
      to: initialEmailData.to || '',
      date: initialEmailData.date || '',
      body: initialEmailData.body || initialEmailData.snippet || '',
      snippet: initialEmailData.snippet,
    } : null
  )
  const [loading, setLoading] = useState(!initialEmailData) // Don't show loading if we have initial data
  const [loadingFullContent, setLoadingFullContent] = useState(false)
  const [showDraft, setShowDraft] = useState(false)
  const [draftMinimized, setDraftMinimized] = useState(false)
  const [draftText, setDraftText] = useState("")
  const [draftId, setDraftId] = useState<string | null>(null)
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
      setDraftMinimized(false)
      setDraftText("")
      setDraftId(null)
      setCopied(false)
      setGenerating(false)
      setError(null)
      
      // Set initial email data immediately if provided
      if (initialEmailData) {
        setEmailSummary({
          id: emailId,
          threadId: initialEmailData.threadId,
          subject: initialEmailData.subject || '',
          from: initialEmailData.from || '',
          to: initialEmailData.to || '',
          date: initialEmailData.date || '',
          body: initialEmailData.body || initialEmailData.snippet || '',
          snippet: initialEmailData.snippet,
        })
        // Show initial message if we have snippet/body
        if (initialEmailData.snippet || initialEmailData.body) {
          setThreadMessages([{
            id: emailId,
            threadId: initialEmailData.threadId,
            subject: initialEmailData.subject || '',
            from: initialEmailData.from || '',
            to: initialEmailData.to || '',
            date: initialEmailData.date || '',
            body: initialEmailData.body || initialEmailData.snippet || '',
            snippet: initialEmailData.snippet,
          }])
        }
        setLoading(false)
        setLoadingFullContent(true) // Show subtle indicator that we're loading full content
      } else {
        setEmailSummary(null)
        setThreadMessages([])
        setLoading(true)
        setLoadingFullContent(false)
      }
      
      fetchThread()
    }
  }, [emailId, initialEmailData])

  const fetchThread = async () => {
    try {
      if (!initialEmailData) {
        setLoading(true)
      }
      setError(null)

      // OPTIMIZED: Fetch email and thread in parallel for faster loading
      // Use initial threadId if available, otherwise fetch email first
      const initialThreadId = initialEmailData?.threadId || emailId

      // Fetch both email and thread in parallel
      const [emailResponse, threadResponse] = await Promise.all([
        fetch(`/api/emails/${emailId}`).catch(() => ({ ok: false, status: 500 })),
        fetch(`/api/emails/threads/${encodeURIComponent(initialThreadId)}`).catch(() => ({ ok: false, status: 500 }))
      ])

      // Process email response
      if (emailResponse.ok) {
        try {
          const emailData = await emailResponse.json()
          const email: EmailSummary = emailData.email
          setEmailSummary(email)
        } catch (e) {
          // Ignore JSON parse errors, thread will have the data
        }
      }

      // Process thread response (this is what we really need)
      if (threadResponse.ok) {
        try {
          const threadData = await threadResponse.json()
          const messages = threadData.thread?.messages || []
          setThreadMessages(messages)
          setError(null)
          
          // Update emailSummary from first message if we don't have it
          if (messages.length > 0 && !emailSummary) {
            const firstMessage = messages[0]
            setEmailSummary({
              id: firstMessage.id,
              threadId: firstMessage.threadId,
              subject: firstMessage.subject,
              from: firstMessage.from,
              to: firstMessage.to,
              date: firstMessage.date,
              body: firstMessage.body,
              snippet: firstMessage.snippet,
            })
          }
        } catch (e) {
          console.error('Error parsing thread data:', e)
        }
      } else {
        // If thread fetch failed, try with email's threadId
        if (emailResponse.ok) {
          try {
            const emailData = await emailResponse.json()
            const email: EmailSummary = emailData.email
            const threadId = email.threadId || email.id
            
            if (threadId !== initialThreadId) {
              // Retry with correct threadId
              const retryResponse = await fetch(`/api/emails/threads/${encodeURIComponent(threadId)}`)
              if (retryResponse.ok) {
                const threadData = await retryResponse.json()
                setThreadMessages(threadData.thread?.messages || [])
                setEmailSummary(email)
                setError(null)
              } else {
                setError("Conversation not found")
              }
            } else {
              setError("Conversation not found")
            }
          } catch (e) {
            setError("Failed to load conversation")
          }
        } else {
          setError("Failed to load email")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email')
      console.error('Error fetching email:', err)
    } finally {
      setLoading(false)
      setLoadingFullContent(false)
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
      setDraftId(data.draftId || null)
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
    if (!emailId) return
    
    try {
      setGenerating(true)
      setError(null)
      const response = await fetch(`/api/emails/${emailId}/draft?regenerate=true`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to regenerate draft')
      }

      const data = await response.json()
      setDraftText(data.draft || '')
      setDraftId(data.draftId || null)
      setShowDraft(true)
      onDraftGenerated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate draft')
      console.error('Error regenerating draft:', err)
    } finally {
      setGenerating(false)
    }
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
        body: JSON.stringify({ draftText, draftId: draftId || null }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to send reply")
      }

      setSendSuccess(true)
      
      // Clear draft UI after successful send
      setDraftText("")
      setDraftId(null)
      setShowDraft(false)
      setDraftMinimized(false)
      
      if (sendResetTimer) {
        clearTimeout(sendResetTimer)
      }
      setSendResetTimer(
        setTimeout(() => {
          setSendSuccess(false)
          setSendResetTimer(null)
        }, 5000) // Show success for 5 seconds instead of 3
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
      <div className="flex items-center justify-center h-full w-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
    <div className="p-4 md:p-6 space-y-4 h-full overflow-y-auto">
      {onBack && (
        <div className="md:hidden mb-2">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="h-8 text-xs -ml-2 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </div>
      )}
      <Card className="border border-border p-4 md:p-5 space-y-3 overflow-hidden">
        <div className="pb-2 border-b border-border/50">
          <h2 className="text-lg md:text-xl font-semibold text-foreground line-clamp-2">
            {threadMessages[threadMessages.length - 1]?.subject || emailSummary?.subject || "(No subject)"}
          </h2>
        </div>

        <div className="space-y-2 text-sm flex-1 overflow-y-auto pr-1">
          {threadMessages.length > 0 ? (
            threadMessages.map((msg, index) => (
              <div
                key={msg.id}
                className="pb-3 border-b border-border/50 last:border-b-0 last:pb-0 animate-in fade-in slide-in-from-left-2"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        {index === 0 ? "Started" : "Message"}
                      </div>
                      <div className="text-xs font-semibold text-foreground truncate">
                        {msg.from.split("<")[0].trim() || msg.from}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      To: {msg.to.split("<")[0].trim() || msg.to}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                    {formatDate(msg.date)}
                  </div>
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {msg.body || msg.snippet || "No content"}
                </div>
              </div>
            ))
          ) : (
            // Fallback: show emailSummary if we have it but no thread messages yet
            emailSummary ? (
              <div className="pb-3 border-b border-border/50 last:border-b-0">
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-xs font-medium text-muted-foreground">Message</div>
                      <div className="text-xs font-semibold text-foreground truncate">
                        {emailSummary.from.split("<")[0].trim() || emailSummary.from}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      To: {emailSummary.to.split("<")[0].trim() || emailSummary.to}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                    {formatDate(emailSummary.date)}
                  </div>
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {emailSummary.body || emailSummary.snippet || "Loading content..."}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Loading content...</div>
            )
          )}
        </div>
      </Card>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      <Card className="border border-border p-4 md:p-5 space-y-3">
        <Button
          onClick={handleGenerateDraft}
          disabled={generating || showDraft}
          className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-medium rounded-lg h-10 transition-all duration-300 ease-out hover:scale-105 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? "Generating..." : showDraft ? "Draft Generated" : "Generate AI Draft"}
        </Button>

        {showDraft && (
          <div className="space-y-3 pt-3 border-t border-border animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-foreground">Suggested Draft</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraftMinimized(!draftMinimized)}
                className="h-8 px-3 transition-all duration-300 ease-out hover:scale-105 hover:shadow-sm flex items-center gap-1.5"
                title={draftMinimized ? "Expand draft" : "Minimize draft"}
              >
                {draftMinimized ? (
                  <>
                    <ChevronDown className="w-4 h-4 transition-transform duration-300 ease-out" />
                    <span className="text-xs">Expand</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4 transition-transform duration-300 ease-out" />
                    <span className="text-xs">Minimize</span>
                  </>
                )}
              </Button>
            </div>
            {draftMinimized ? (
              <div className="text-xs text-muted-foreground italic py-2 animate-in fade-in duration-300">
                Draft minimized - click expand button above to view
              </div>
            ) : (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="w-full h-40 p-3 border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300"
                />
              </div>
            )}

            {!draftMinimized && (
              <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Button
                  onClick={handleSendReply}
                  disabled={sending || sendSuccess}
                  className={`rounded-lg h-9 transition-all duration-300 ease-out hover:scale-105 hover:shadow-md disabled:cursor-not-allowed text-sm ${
                    sendSuccess 
                      ? "bg-green-600 text-white hover:bg-green-600" 
                      : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  }`}
                >
                  {sendSuccess ? "✓ Reply sent!" : sending ? "Sending..." : "Send Reply"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopy}
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-lg h-9 border-border text-foreground hover:bg-secondary bg-transparent transition-all duration-300 ease-out hover:scale-105 hover:shadow-sm text-xs"
                  >
                    {copied ? "✓ Copied!" : "Copy Draft"}
                  </Button>
                  <Button
                    onClick={handleRegenerate}
                    variant="outline"
                    size="sm"
                    disabled={generating}
                    className="flex-1 rounded-lg h-9 border-border text-foreground hover:bg-secondary bg-transparent transition-all duration-300 ease-out hover:scale-105 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                  >
                    {generating ? "Regenerating..." : "Regenerate"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
