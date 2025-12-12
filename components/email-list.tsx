"use client"

import { useEffect, useState } from "react"

interface Email {
  id: string
  from: string
  subject: string
  snippet: string
  date: string
}

interface EmailListProps {
  selectedEmail: string | null
  onSelectEmail: (id: string) => void
  onLoadingChange?: (loading: boolean) => void
  viewType?: "inbox" | "sent" | "spam" | "trash"
}

export default function EmailList({ selectedEmail, onSelectEmail, onLoadingChange, viewType = "inbox" }: EmailListProps) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(20)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    // Reset state and fetch fresh emails whenever the view type changes
    setEmails([])
    setError(null)
    setLimit(20)
    setHasMore(true)
    fetchEmails(20)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewType])

  const fetchEmails = async (newLimit = limit, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)
      onLoadingChange?.(true)
      let url = `/api/emails?maxResults=${newLimit}`
      if (viewType === "sent") {
        url = `/api/emails?type=sent&maxResults=${newLimit}`
      } else if (viewType === "spam") {
        // Use Gmail search query to only retrieve spam (in:spam is the standard Gmail syntax)
        url = `/api/emails?type=inbox&maxResults=${newLimit}&q=in:spam`
      } else if (viewType === "trash") {
        // Use Gmail search query to only retrieve trash (in:trash is the standard Gmail syntax)
        url = `/api/emails?type=inbox&maxResults=${newLimit}&q=in:trash`
      } else {
        // default inbox view; backend already filters out SPAM/TRASH when creating tickets
        url = `/api/emails?type=inbox&maxResults=${newLimit}`
      }

      // Cache strategy:
      // - Initial loads: Use 'no-cache' to revalidate with server (can use stale-while-revalidate)
      // - Load more: Use 'default' to leverage browser cache for faster pagination
      // The API response includes Cache-Control headers (30s cache, 60s stale-while-revalidate)
      const response = await fetch(url, {
        cache: isLoadMore ? 'default' : 'no-cache'
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Not authenticated')
          return
        }
        throw new Error('Failed to fetch emails')
      }

      const data = await response.json()
      setEmails(data.emails || [])
      setLimit(newLimit)
      // If we received at least as many as we asked for, assume there might be more
      setHasMore(Array.isArray(data.emails) && data.emails.length >= newLimit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emails')
      console.error('Error fetching emails:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      onLoadingChange?.(false)
    }
  }

  const handleLoadMore = () => {
    const nextLimit = limit + 20
    fetchEmails(nextLimit, true)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 60) return `${diffMins}m`
      if (diffHours < 24) return `${diffHours}h`
      if (diffDays < 7) return `${diffDays}d`
      return date.toLocaleDateString()
    } catch {
      return dateString
    }
  }

  if (loading && !loadingMore) {
    return (
      <div className="flex items-center justify-center p-8 animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-muted-foreground">Loading emails...</div>
        </div>
      </div>
    )
  }

  if (error && !loadingMore) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-2">
        <div className="text-sm text-destructive">{error}</div>
        <button
          onClick={fetchEmails}
          className="text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (emails.length === 0 && !loadingMore) {
    return (
      <div className="flex items-center justify-center p-8 animate-in fade-in duration-300">
        <div className="text-center space-y-2">
          <div className="text-sm text-muted-foreground">No emails found</div>
          <p className="text-xs text-muted-foreground/70">Try checking another folder</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-2 space-y-2">
      {emails.map((email, index) => (
        <button
          key={email.id}
          onClick={() => onSelectEmail(email.id, {
            subject: email.subject,
            from: email.from,
            to: email.to,
            date: email.date,
            snippet: email.snippet,
            body: email.body,
            threadId: email.threadId,
          })}
          className={`w-full p-4 text-left rounded-lg transition-all duration-300 ease-out border-l-4 animate-in fade-in slide-in-from-left-2 ${
            selectedEmail === email.id 
              ? "border-l-primary bg-primary/10 shadow-md scale-[1.01]" 
              : "border-l-transparent hover:bg-muted/50 hover:shadow-sm hover:scale-[1.005]"
          }`}
          style={{ animationDelay: `${index * 30}ms` }}
        >
          <div className="space-y-2.5">
            <div className="flex justify-between items-start gap-3">
              <h3 className="font-semibold text-foreground text-sm truncate flex-1">
                {email.from.split("<")[0].trim() || email.from}
              </h3>
              <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                {formatDate(email.date)}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground line-clamp-1">
              {email.subject || "(No subject)"}
            </p>
            {email.snippet && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {email.snippet}
              </p>
            )}
          </div>
        </button>
      ))}

      {hasMore && (
        <div className="flex justify-center p-4 pt-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-xs px-4 py-2 rounded-lg border border-border text-primary hover:bg-secondary hover:shadow-sm transition-all duration-300 ease-out hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingMore ? "Loading more..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  )
}
