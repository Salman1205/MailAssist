"use client"

import { useState } from "react"
import EmailList from "@/components/email-list"
import EmailDetail from "@/components/email-detail"

interface InboxViewProps {
  selectedEmail: string | null
  onSelectEmail: (id: string | null) => void
  onDraftGenerated?: () => void
}

export default function InboxView({ selectedEmail, onSelectEmail, onDraftGenerated }: InboxViewProps) {
  const [listLoading, setListLoading] = useState(true)
  const showDetail = Boolean(selectedEmail)

  return (
    <div className="flex flex-col md:flex-row h-full bg-background">
      <div
        className={`border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto ${
          showDetail ? "hidden md:flex md:w-80" : "flex w-full md:w-80"
        } flex-col`}
      >
        <EmailList
          selectedEmail={selectedEmail}
          onSelectEmail={onSelectEmail}
          onLoadingChange={setListLoading}
        />
      </div>

      <div className={`flex-1 overflow-y-auto ${showDetail ? "flex" : "hidden md:flex"}`}>
        {selectedEmail ? (
          <EmailDetail
            emailId={selectedEmail}
            onDraftGenerated={onDraftGenerated}
            onBack={() => onSelectEmail(null)}
          />
        ) : (
          <div className="flex items-center justify-center md:justify-start h-full px-6 md:pl-48 py-10">
            <div className="text-center md:text-left space-y-4 max-w-md">
              <svg
                className="w-16 h-16 text-muted-foreground/30 mx-auto"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M22 4H2v16h20V4zm-2 2v3H4V6h16z" />
              </svg>
              <p className="text-base font-medium text-foreground">
                {listLoading ? "Loading your inbox..." : "Select an email to get started"}
              </p>
              <p className="text-sm text-muted-foreground">
                {listLoading
                  ? "Hang tight while we fetch the latest messages."
                  : "Drafts will use your style once you reply from here."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
