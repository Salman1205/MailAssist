"use client"

import { useEffect, useState, useCallback } from "react"

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
  onRefreshReady?: (refreshFn: () => void) => void
}

export default function EmailList({ selectedEmail, onSelectEmail, onLoadingChange, viewType = "inbox", onRefreshReady }: EmailListProps) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(20)
  const [hasMore, setHasMore] = useState(true)

  const fetchEmails = async (newLimit = limit, isLoadMore = false, silent = false) => {
    try {
      if (!silent) {
        if (isLoadMore) {
          setLoadingMore(true)
        } else {
          setLoading(true)
        }
        onLoadingChange?.(true)
      }
      setError(null)
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
      if (!silent) {
        setLoading(false)
        setLoadingMore(false)
        onLoadingChange?.(false)
      }
    }
  }

  // Memoized refresh function to prevent infinite loops (silent refresh)
  const handleRefresh = useCallback(() => {
    fetchEmails(limit, false, true)
  }, [limit])

  // Expose refresh function to parent component
  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(handleRefresh)
    }
  }, [onRefreshReady, handleRefresh])

  // Auto-poll for new emails every 30 seconds (silent refresh)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      console.log('Auto-polling for new emails...')
      fetchEmails(limit, false, true)
    }, 30000) // 30 seconds

    return () => clearInterval(pollInterval)
  }, [limit])

  // Reset and fetch when viewType changes
  useEffect(() => {
    setEmails([])
    setError(null)
    setLimit(20)
    setHasMore(true)
    fetchEmails(20)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewType])

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
      <div className="p-4 space-y-3 animate-in fade-in duration-300">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border border-border/50 rounded-xl p-4 bg-card">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="h-5 bg-muted rounded w-1/3 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-16 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error && !loadingMore) {
    return (
      <div className="flex items-center justify-center p-12 animate-in fade-in duration-300">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-destructive/15 via-destructive/10 to-destructive/5 flex items-center justify-center mx-auto shadow-lg border-2 border-destructive/20">
            <svg className="w-12 h-12 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-3">
            <div className="text-base font-bold text-destructive">Failed to load emails</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
            <button
              onClick={() => fetchEmails()}
              className="text-sm text-primary hover:underline font-semibold mt-2"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (emails.length === 0 && !loadingMore) {
    return (
      <div className="flex items-center justify-center p-12 animate-in fade-in duration-300">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 flex items-center justify-center mx-auto shadow-lg border-2 border-primary/20">
            <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="space-y-3">
            <div className="text-base font-bold text-foreground">No emails found</div>
            <p className="text-sm text-muted-foreground leading-relaxed">Try checking another folder or refresh the page</p>
          </div>
        </div>
      </div>
    )
  }

  const getInitials = (from: string) => {
    const name = from.split("<")[0].trim() || from;
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (from: string) => {
    const colors = [
      "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-green-500",
      "bg-yellow-500", "bg-red-500", "bg-indigo-500", "bg-teal-500"
    ];
    const hash = from.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="p-4 space-y-3 overflow-x-hidden max-w-full">
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
          className={`w-full text-left rounded-xl transition-all duration-200 ease-out border animate-in fade-in slide-in-from-left-2 group relative overflow-hidden ${
            selectedEmail === email.id 
              ? "border-primary/50 bg-accent/15 shadow-lg ring-2 ring-primary/30 border-l-4" 
              : "border-border/50 hover:border-primary/40 hover:bg-accent/5 hover:shadow-md bg-card"
          }`}
          style={{ animationDelay: `${index * 20}ms` }}
        >
          <div className="flex gap-4 p-4 relative z-10">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${
              getAvatarColor(email.from)
            } shadow-md`}>
              {getInitials(email.from)}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-base truncate transition-colors ${
                    selectedEmail === email.id ? "text-primary" : "text-foreground group-hover:text-primary"
                  }`}>
                    {email.from.split("<")[0].trim() || email.from}
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground font-medium">
                    {formatDate(email.date)}
                  </span>
                  {selectedEmail === email.id && (
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-sm shadow-primary/50" />
                  )}
                </div>
              </div>
              
              {/* Subject and snippet */}
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-foreground line-clamp-1 leading-snug">
                  {email.subject || "(No subject)"}
                </p>
                {email.snippet && (
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {email.snippet}
                  </p>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}

      {hasMore && (
        <div className="flex justify-center p-4 pt-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-sm px-8 py-3 rounded-xl border-2 border-border/60 bg-card text-primary hover:bg-accent/10 hover:border-primary/60 hover:shadow-lg transition-colors duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
          >
            {loadingMore ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Loading more...
              </div>
            ) : (
              "Load more emails"
            )}
          </button>
        </div>
      )}
    </div>
  )
}
