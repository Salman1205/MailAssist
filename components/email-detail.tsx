"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface EmailDetailProps {
  emailId: string
  onDraftGenerated?: () => void
}

interface Email {
  id: string
  subject: string
  from: string
  to: string
  date: string
  body: string
  snippet?: string
}

export default function EmailDetail({ emailId, onDraftGenerated }: EmailDetailProps) {
  const [email, setEmail] = useState<Email | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDraft, setShowDraft] = useState(false)
  const [draftText, setDraftText] = useState("")
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (emailId) {
      // Reset draft/UI state whenever user selects a new email
      setShowDraft(false)
      setDraftText("")
      setCopied(false)
      setGenerating(false)
      setError(null)
      fetchEmail()
    }
  }, [emailId])

  const fetchEmail = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/emails/${emailId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Email not found')
        } else {
          throw new Error('Failed to fetch email')
        }
        return
      }
      
      const data = await response.json()
      setEmail(data.email)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center md:justify-start h-full px-6 md:pl-48 py-10">
        <div className="text-center md:text-left space-y-4 max-w-md">
          <div className="text-sm text-muted-foreground">Loading email...</div>
        </div>
      </div>
    )
  }

  if (error && !email) {
    return (
      <div className="p-6 flex flex-col items-center justify-center space-y-2">
        <div className="text-sm text-destructive">{error}</div>
        <button
          onClick={fetchEmail}
          className="text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!email) {
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
      <Card className="border border-border p-6 space-y-4 overflow-hidden">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            {email.subject || '(No subject)'}
          </h2>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex gap-4">
            <span className="font-medium text-muted-foreground w-12">From:</span>
            <span className="text-foreground">{email.from}</span>
          </div>
          <div className="flex gap-4">
            <span className="font-medium text-muted-foreground w-12">To:</span>
            <span className="text-foreground">{email.to}</span>
          </div>
          <div className="flex gap-4">
            <span className="font-medium text-muted-foreground w-12">Date:</span>
            <span className="text-foreground">{formatDate(email.date)}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-border overflow-auto max-h-[55vh] pr-1">
          <p className="text-foreground leading-relaxed text-sm whitespace-pre-wrap break-words">
            {email.body || email.snippet || 'No content'}
          </p>
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

            <div className="flex gap-3">
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
        )}
      </Card>
    </div>
  )
}
