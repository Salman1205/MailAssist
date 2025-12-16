"use client"

import { useState, useEffect, useCallback } from "react"
import EmailList from "@/components/email-list"
import EmailDetail from "@/components/email-detail"
import ShopifySidebar from "@/components/shopify-sidebar"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

interface InboxViewProps {
  selectedEmail: string | null
  onSelectEmail: (id: string | null, emailData?: {
    subject?: string
    from?: string
    to?: string
    date?: string
    snippet?: string
    body?: string
    threadId?: string
  }) => void
  onDraftGenerated?: () => void
  viewType?: "inbox" | "sent" | "spam" | "trash"
}

export default function InboxView({ selectedEmail, onSelectEmail, onDraftGenerated, viewType = "inbox" }: InboxViewProps) {
  const [listLoading, setListLoading] = useState(true)
  const [selectedEmailData, setSelectedEmailData] = useState<{
    subject?: string
    from?: string
    to?: string
    date?: string
    snippet?: string
    body?: string
    threadId?: string
  } | null>(null)
  const [showShopifySidebar, setShowShopifySidebar] = useState(false)
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [emailListRefresh, setEmailListRefresh] = useState<(() => void) | null>(null)
  const showDetail = Boolean(selectedEmail)
  
  // Fetch ticket for the selected email
  useEffect(() => {
    const fetchTicket = async () => {
      if (!selectedEmailData?.threadId) {
        setTicketId(null)
        return
      }
      
      try {
        console.log('Fetching ticket for threadId:', selectedEmailData.threadId)
        const response = await fetch(`/api/tickets?threadId=${encodeURIComponent(selectedEmailData.threadId)}`)
        if (response.ok) {
          const data = await response.json()
          const ticket = data.tickets?.[0]
          console.log('Found ticket:', ticket?.id, 'status:', ticket?.status)
          setTicketId(ticket?.id || null)
        } else {
          console.log('No ticket found or error response')
          setTicketId(null)
        }
      } catch (error) {
        console.error('Error fetching ticket:', error)
        setTicketId(null)
      }
    }
    
    fetchTicket()
  }, [selectedEmailData?.threadId])
  
  // Listen for ticket updates from Send & Close
  useEffect(() => {
    const handleTicketUpdate = () => {
      console.log('📨 Inbox received ticket update, silently refreshing list...')
      if (emailListRefresh) {
        emailListRefresh()
      }
    }
    
    window.addEventListener('ticketUpdated', handleTicketUpdate)
    window.addEventListener('ticketsForceRefresh', handleTicketUpdate)
    
    return () => {
      window.removeEventListener('ticketUpdated', handleTicketUpdate)
      window.removeEventListener('ticketsForceRefresh', handleTicketUpdate)
    }
  }, [emailListRefresh])
  
  // Handle email selection with data
  const handleSelectEmail = (id: string | null, emailData?: {
    subject?: string
    from?: string
    to?: string
    date?: string
    snippet?: string
    body?: string
    threadId?: string
  }) => {
    setSelectedEmailData(emailData || null)
    onSelectEmail(id, emailData)
  }

  // When switching between Inbox/Sent/Spam/Trash, clear the current selection
  // so the detail view doesn't show stale data from the previous view.
  useEffect(() => {
    onSelectEmail(null)
  }, [viewType, onSelectEmail])

  // Memoized callback to prevent infinite loops
  const handleRefreshReady = useCallback((refreshFn: () => void) => {
    setEmailListRefresh(() => refreshFn)
  }, [])

  return (
    <div className="flex flex-col md:flex-row h-full bg-muted/20 overflow-hidden">
      <div
        className={`border-b md:border-b-0 md:border-r border-border bg-background overflow-hidden flex flex-col transition-all duration-300 flex-shrink-0 ${
          showDetail ? "hidden md:flex md:w-96" : "flex w-full md:w-96"
        }`}
      >
        <div className="bg-card border-b border-border px-6 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold capitalize text-foreground">{viewType || "Inbox"}</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your messages</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRefreshing(true)
                if (emailListRefresh) {
                  emailListRefresh()
                }
                setTimeout(() => setRefreshing(false), 1000)
              }}
              disabled={refreshing}
              className="h-8 w-8 p-0"
              title="Refresh emails"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <EmailList
            selectedEmail={selectedEmail}
            onSelectEmail={handleSelectEmail}
            onLoadingChange={setListLoading}
            viewType={viewType}
            onRefreshReady={handleRefreshReady}
          />
        </div>
      </div>

      <div className={`flex-1 overflow-hidden flex flex-col ${showDetail ? "flex" : "hidden md:flex"}`}>
        {selectedEmail ? (
          <EmailDetail
            emailId={selectedEmail}
            ticketId={ticketId}
            onDraftGenerated={onDraftGenerated}
            onBack={() => {
              setSelectedEmailData(null)
              onSelectEmail(null)
            }}
            initialEmailData={selectedEmailData || undefined}
            onToggleShopify={(email) => {
              setShowShopifySidebar(!showShopifySidebar)
            }}
            showShopifySidebar={showShopifySidebar}
            hideCloseButton={true}
          />
        ) : (
          <div className="flex items-center justify-center h-full px-8 py-12 bg-muted/10">
            <div className="text-center space-y-5 max-w-md">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 flex items-center justify-center mx-auto border-2 border-primary/20 shadow-lg">
                <svg
                  className="w-12 h-12 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-foreground">Select an email to get started</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Choose a message from the list to view the conversation and generate AI-powered replies</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shopify Sidebar */}
      {showShopifySidebar && selectedEmailData && (
        <div className="w-80 border-l border-border bg-background overflow-hidden flex-shrink-0">
          <ShopifySidebar
            customerEmail={selectedEmailData.from || ''}
            onClose={() => setShowShopifySidebar(false)}
          />
        </div>
      )}
    </div>
  )
}
