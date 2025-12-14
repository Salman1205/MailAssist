"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, ChevronDown, ChevronUp, Sparkles, Loader2, Mail, ShoppingBag } from "lucide-react"

interface EmailDetailProps {
  emailId: string
  onDraftGenerated?: () => void
  onBack?: () => void
  onToggleShopify?: (email: string) => void
  showShopifySidebar?: boolean
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

export default function EmailDetail({ emailId, onDraftGenerated, onBack, initialEmailData, onToggleShopify, showShopifySidebar }: EmailDetailProps) {
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
  const [conversationSummary, setConversationSummary] = useState<string>("")
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const draftAutoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (sendResetTimer) {
        clearTimeout(sendResetTimer)
      }
      if (draftAutoSaveTimerRef.current) {
        clearTimeout(draftAutoSaveTimerRef.current)
      }
    }
  }, [sendResetTimer])

  // Autosave draft text to localStorage
  useEffect(() => {
    if (!emailId || !draftText || !showDraft) return
    
    if (draftAutoSaveTimerRef.current) {
      clearTimeout(draftAutoSaveTimerRef.current)
    }
    
    draftAutoSaveTimerRef.current = setTimeout(() => {
      try {
        setAutoSaving(true)
        localStorage.setItem(`draft_${emailId}`, draftText)
        setTimeout(() => setAutoSaving(false), 500)
      } catch {
        // Ignore localStorage errors
      }
    }, 1000)
    
    return () => {
      if (draftAutoSaveTimerRef.current) {
        clearTimeout(draftAutoSaveTimerRef.current)
      }
    }
  }, [draftText, emailId, showDraft])

  useEffect(() => {
    if (emailId) {
      // CRITICAL UX FIX: Clear previous email content immediately
      setThreadMessages([])
      setEmailSummary(null)
      
      // Reset draft/UI state whenever user selects a new email
      setShowDraft(false)
      setDraftMinimized(false)
      setDraftText("")
      setDraftId(null)
      setCopied(false)
      setGenerating(false)
      setError(null)
      setConversationSummary("")
      setSummaryExpanded(false)
      
      // Try to load autosaved draft from localStorage
      try {
        const saved = localStorage.getItem(`draft_${emailId}`)
        if (saved && !draftText) {
          setDraftText(saved)
        }
      } catch {
        // Ignore localStorage errors
      }
      
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
    if (sending) return // Prevent double-submit

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
      
      // Clear draft UI and autosaved data after successful send
      try {
        localStorage.removeItem(`draft_${emailId}`)
      } catch {
        // Ignore localStorage errors
      }
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
      <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
        {/* Header skeleton */}
        <div className="border-b border-border px-6 py-5 bg-card">
          <div className="h-6 bg-muted rounded w-1/3 animate-pulse mb-3" />
          <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
        </div>
        
        {/* Messages skeleton */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="border border-border rounded-xl p-5 bg-card">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="h-5 bg-muted rounded w-1/3 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-20 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-full animate-pulse" />
                  <div className="h-4 bg-muted rounded w-5/6 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-4/5 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error && threadMessages.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center space-y-3">
        {onBack && (
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="md:hidden self-start -mt-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
        <div className="text-sm font-medium text-destructive">{error}</div>
        <Button
          onClick={fetchThread}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          Retry
        </Button>
      </div>
    )
  }

  if (threadMessages.length === 0 && !emailSummary) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <Mail className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <div className="text-sm font-medium text-muted-foreground">No email selected</div>
          <p className="text-xs text-muted-foreground/70">Select an email to view the conversation</p>
        </div>
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
    <div className="h-full flex flex-col bg-muted/20 overflow-hidden">
      {onBack && (
        <div className="md:hidden px-4 pt-3 pb-2 flex-shrink-0 bg-background border-b border-border">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="h-8 text-xs -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </div>
      )}
      
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Card className="mx-4 md:mx-6 mt-4 mb-3 flex-1 flex flex-col overflow-hidden max-w-full shadow-lg">
          <div className="px-6 py-5 border-b border-border flex-shrink-0 overflow-hidden bg-card">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h2 className="text-xl font-bold text-foreground line-clamp-2 break-words flex-1">
                {threadMessages[threadMessages.length - 1]?.subject || emailSummary?.subject || "(No subject)"}
              </h2>
              {threadMessages.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!conversationSummary) {
                      setGeneratingSummary(true)
                      try {
                        const summary = threadMessages.map(m => `${m.from}: ${(m.body || m.subject || "").substring(0, 200)}`).join("\n\n")
                        const response = await fetch("/api/ai/summarize", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ conversation: summary })
                        })
                        if (response.ok) {
                          const data = await response.json()
                          setConversationSummary(data.summary)
                          setSummaryExpanded(true)
                        } else {
                          setConversationSummary("Unable to generate summary at this time.")
                          setSummaryExpanded(true)
                        }
                      } catch (err) {
                        setConversationSummary("Error generating summary.")
                        setSummaryExpanded(true)
                      } finally {
                        setGeneratingSummary(false)
                      }
                    } else {
                      setSummaryExpanded(!summaryExpanded)
                    }
                  }}
                  className="h-8 px-3 text-xs flex-shrink-0"
                  disabled={generatingSummary}
                >
                  {generatingSummary ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Summarizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      {conversationSummary ? (summaryExpanded ? "Hide Summary" : "Show Summary") : "Summarize"}
                    </>
                  )}
                </Button>
              )}
            </div>
            {conversationSummary && summaryExpanded && (
              <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-md">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-foreground/90 leading-relaxed">
                    {conversationSummary}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-6 py-4">
            <div className="space-y-6 max-w-full">
              {threadMessages.length > 0 ? (
                threadMessages.map((msg, index) => (
                  <div
                    key={msg.id}
                    className="pb-6 border-b border-border last:border-b-0 last:pb-0 overflow-hidden"
                  >
                    <div className="flex justify-between items-start gap-4 mb-3 min-w-0">
                      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                        {/* Clickable Avatar for Shopify */}
                        {onToggleShopify && (
                          <button
                            onClick={() => onToggleShopify(msg.from)}
                            className="flex-shrink-0 transition-colors duration-200 cursor-pointer group"
                            title="View Shopify customer info"
                          >
                            <Avatar className="h-10 w-10 border-2 border-border group-hover:border-primary transition-colors">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                                {msg.from.split("<")[0].trim()
                                  ? msg.from.split("<")[0].trim()
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()
                                  : msg.from.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                        )}
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 mb-1.5 min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">
                              {msg.from.split("<")[0].trim() || msg.from}
                            </div>
                            {index === 0 && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">Original</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            To: {msg.to.split("<")[0].trim() || msg.to}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                        {formatDate(msg.date)}
                      </div>
                    </div>
                    <div className="text-sm text-foreground/90 leading-relaxed overflow-hidden break-words">
                      {msg.body && msg.body.trim() ? (
                        // Check if it looks like HTML (more comprehensive check)
                        /<[^>]*(div|p|span|html|table|tr|td|br|img|a|b|i|em|strong|blockquote|pre|code|ul|ol|li|h[1-6])[\s>]/i.test(msg.body) ? (
                          <div 
                            className="prose prose-sm max-w-none 
                              prose-headings:font-semibold prose-headings:text-foreground
                              prose-p:text-foreground prose-p:leading-relaxed
                              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                              prose-ul:text-foreground prose-ol:text-foreground
                              prose-li:text-foreground prose-li:leading-relaxed
                              prose-code:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                              prose-pre:bg-muted prose-pre:text-foreground
                              prose-blockquote:text-muted-foreground prose-blockquote:border-primary
                              prose-img:rounded-lg overflow-hidden break-words"
                            dangerouslySetInnerHTML={{ __html: msg.body }}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap break-words">
                            {msg.body}
                          </div>
                        )
                      ) : (
                        <div className="text-muted-foreground italic">
                          No content
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                // Fallback: show emailSummary if we have it but no thread messages yet
                emailSummary ? (
                  <div className="pb-4 border-b border-border/50 last:border-b-0">
                    <div className="flex justify-between items-start gap-3 mb-3">
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
                    <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                      {emailSummary.body || emailSummary.snippet || "Loading content..."}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Loading content...</div>
                )
              )}
            </div>
          </div>
        </Card>

        {error && (
          <div className="mx-4 md:mx-6 mb-3 px-4 py-3 text-sm font-medium text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        <Card className="mx-4 md:mx-6 mb-4 flex-shrink-0 overflow-hidden">
          <div className="p-6 space-y-4">
            {onToggleShopify && emailSummary && (
              <Button
                variant={showShopifySidebar ? "default" : "outline"}
                size="sm"
                onClick={() => onToggleShopify(emailSummary.from)}
                className="w-full gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                {showShopifySidebar ? "Hide" : "Show"} Shopify Info
              </Button>
            )}
            <Button
              onClick={handleGenerateDraft}
              disabled={generating || showDraft}
              className="w-full h-11 text-base font-semibold shadow-md hover:shadow-lg"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating draft...
                </>
              ) : showDraft ? (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Draft generated
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate AI draft
                </>
              )}
            </Button>

            {showDraft && (
              <div className="space-y-4 pt-4 border-t border-border animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    AI-Generated Draft
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraftMinimized(!draftMinimized)}
                    className="h-9 px-3 hover:bg-accent/10"
                    title={draftMinimized ? "Expand draft" : "Minimize draft"}
                  >
                    {draftMinimized ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {draftMinimized ? (
                  <div className="text-sm text-muted-foreground italic py-3 px-4 bg-muted/30 rounded-lg">
                    Draft minimized - click to expand
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="relative">
                      <textarea
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        onKeyDown={(e) => {
                          // Escape to minimize
                          if (e.key === 'Escape') {
                            setDraftMinimized(true)
                            e.preventDefault()
                          }
                          // Ctrl/Cmd+Enter to send
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            handleSendReply()
                            e.preventDefault()
                          }
                        }}
                        className="w-full min-h-[200px] p-4 border-2 border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                        placeholder="Edit your draft here... (Esc to minimize, Ctrl+Enter to send)"
                        aria-label="Email draft editor"
                      />
                      {autoSaving && (
                        <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                          Saving...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!draftMinimized && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Button
                      onClick={handleSendReply}
                      disabled={sending || sendSuccess}
                      className={`w-full h-11 text-base font-semibold shadow-md transition-all duration-300 ease-out hover:shadow-lg disabled:cursor-not-allowed ${
                        sendSuccess 
                          ? "bg-green-600 text-white hover:bg-green-600" 
                          : "disabled:opacity-50"
                      }`}
                    >
                      {sendSuccess ? "✓ Reply sent!" : sending ? "Sending..." : "Send Reply"}
                    </Button>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={handleCopy}
                        variant="outline"
                        className="h-10 text-sm font-medium hover:bg-accent/10 hover:border-primary/50 transition-all duration-200"
                      >
                        {copied ? "✓ Copied!" : "Copy Draft"}
                      </Button>
                      <Button
                        onClick={handleRegenerate}
                        variant="outline"
                        disabled={generating}
                        className="h-10 text-sm font-medium hover:bg-accent/10 hover:border-primary/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generating ? "Regenerating..." : "Regenerate"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
