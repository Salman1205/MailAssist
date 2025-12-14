"use client"

import { useState, useEffect } from "react"
import EmailList from "@/components/email-list"
import EmailDetail from "@/components/email-detail"
import ShopifySidebar from "@/components/shopify-sidebar"

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
  const showDetail = Boolean(selectedEmail)
  
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

  return (
    <div className="flex flex-col md:flex-row h-full bg-muted/20 overflow-hidden">
      <div
        className={`border-b md:border-b-0 md:border-r border-border bg-background overflow-hidden flex flex-col transition-all duration-300 flex-shrink-0 ${
          showDetail ? "hidden md:flex md:w-96" : "flex w-full md:w-96"
        }`}
      >
        <div className="bg-card border-b border-border px-6 py-5 flex-shrink-0">
          <h2 className="text-xl font-bold capitalize text-foreground">{viewType || "Inbox"}</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your messages</p>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <EmailList
            selectedEmail={selectedEmail}
            onSelectEmail={handleSelectEmail}
            onLoadingChange={setListLoading}
            viewType={viewType}
          />
        </div>
      </div>

      <div className={`flex-1 overflow-hidden flex flex-col ${showDetail ? "flex" : "hidden md:flex"}`}>
        {selectedEmail ? (
          <EmailDetail
            emailId={selectedEmail}
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
