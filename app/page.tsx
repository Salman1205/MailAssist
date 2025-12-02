"use client"

import { useState, useEffect, useCallback } from "react"
import TopNav from "@/components/top-nav"
import Sidebar from "@/components/sidebar"
import GmailConnect from "@/components/gmail-connect"
import InboxView from "@/components/inbox-view"
import SettingsView from "@/components/settings-view"
import DraftsView from "@/components/drafts-view"
import SyncToast from "@/components/sync-toast"

type View = "inbox" | "sent" | "spam" | "trash" | "drafts" | "settings"

interface UserProfile {
  name?: string
  email?: string
  picture?: string
}

interface SyncStats {
  totalStored: number
  sentWithEmbeddings: number
  completedReplies: number
  pendingReplies: number
  lastSync: number | null
  processing?: boolean
  queued?: number
  processed?: number
  errors?: number
}

export default function Page() {
  const [isConnected, setIsConnected] = useState(false)
  const [activeView, setActiveView] = useState<View>("inbox")
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [draftsVersion, setDraftsVersion] = useState(0)
  const [hasAutoSynced, setHasAutoSynced] = useState(false)

  const [syncStatus, setSyncStatus] = useState<SyncStats | null>(null)
  const [syncInProgress, setSyncInProgress] = useState(false)
  const [syncTarget, setSyncTarget] = useState<number | null>(null)
  const [syncBaseline, setSyncBaseline] = useState(0)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [hideSyncToast, setHideSyncToast] = useState(false)
  const [syncContinueCount, setSyncContinueCount] = useState(0) // Safety counter
  const LOCAL_STORAGE_KEY = "gmail_connected"

  useEffect(() => {
    checkAuthStatus()

    const params = new URLSearchParams(window.location.search)
    if (params.get("auth") === "success") {
      setIsConnected(true)
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, "true")
      } catch {
        // Ignore localStorage errors (e.g. in private mode)
      }
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [])

  const fetchSyncStatus = useCallback(async () => {
    if (!isConnected) return null
    try {
      const response = await fetch("/api/emails/sync", { cache: "no-store" })
      if (!response.ok) return null
      const data: SyncStats = await response.json()
      setSyncStatus(data)
      if (typeof data.processing === "boolean") {
        setSyncInProgress(data.processing)
        if (!data.processing) {
          setSyncTarget(null)
          setSyncBaseline(0)
        } else if (typeof data.queued === "number") {
          setSyncTarget(data.queued)
        }
      }
      return data
    } catch {
      return null
    }
  }, [isConnected])

  const startSync = useCallback(
    async (maxResults = 300) => {
      if (!isConnected) throw new Error("Connect Gmail first to sync emails.")
      setSyncError(null)
      setHideSyncToast(false)

      const response = await fetch(`/api/emails/sync?maxResults=${maxResults}`, { method: "POST" })
      const data = await response.json().catch(() => ({}))

      if (response.status === 202 && data?.processing) {
        setSyncInProgress(true)
        setSyncTarget(data.queued ?? syncTarget ?? maxResults)
        setSyncBaseline(syncStatus?.sentWithEmbeddings ?? 0)
        return
      }

      if (!response.ok) {
        const message = data?.error || "Failed to start sync"
        setSyncInProgress(false)
        setSyncTarget(null)
        setSyncBaseline(0)
        setSyncError(message)
        throw new Error(message)
      }

      const baseline = syncStatus?.sentWithEmbeddings ?? 0
      setSyncBaseline(baseline)
      setSyncTarget(data?.queued ?? maxResults)
      setSyncInProgress(true)
      await fetchSyncStatus()

      // If there are remaining emails, continue syncing automatically
      // Safety: limit to 100 continuation calls to prevent infinite loops
      if (data?.continue && data?.remaining > 0 && syncContinueCount < 100) {
        setSyncContinueCount((prev) => prev + 1)
        // Wait a moment before continuing to avoid rate limits
        setTimeout(() => {
          startSync(maxResults).catch((err) => {
            console.error('Error continuing sync:', err)
            setSyncError(err.message)
            setSyncContinueCount(0) // Reset on error
          })
        }, 1000)
      } else if (!data?.continue) {
        // Reset counter when sync completes
        setSyncContinueCount(0)
      }
    },
    [isConnected, syncStatus, fetchSyncStatus, syncTarget]
  )

  useEffect(() => {
    if (isConnected) {
      fetchProfile()
      fetchSyncStatus()
      if (!hasAutoSynced) {
        setHasAutoSynced(true)
        // Fetch up to 500 emails (enough for most users)
        // The sync will process them in batches of 15 automatically
        startSync(500).catch((err) => setSyncError(err.message))
      }
    } else {
      setUserProfile(null)
      setHasAutoSynced(false)
      setSyncStatus(null)
      setSyncInProgress(false)
      setSyncTarget(null)
      setSyncBaseline(0)
    }
  }, [isConnected, hasAutoSynced, fetchSyncStatus, startSync])

  const shouldPoll = syncInProgress || (syncStatus?.processing ?? false)

  useEffect(() => {
    if (!shouldPoll) return

    const interval = setInterval(() => {
      fetchSyncStatus()
    }, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [shouldPoll, fetchSyncStatus])

  useEffect(() => {
    if (!isConnected) return
    if (syncStatus?.processing && !syncInProgress) {
      setHideSyncToast(false)
      startSync(500).catch((err) => {
        console.error("Error resuming sync:", err)
        setSyncError(err instanceof Error ? err.message : "Failed to resume sync")
      })
    }
  }, [isConnected, syncStatus?.processing, syncInProgress, startSync])

  const checkAuthStatus = async () => {
    try {
      // Only treat the user as "connected" on this device if they have
      // previously completed the OAuth flow in this browser.
      // This prevents other people's logins (on other laptops) from
      // automatically making this browser look logged in.
      const hasLocalConnection =
        typeof window !== "undefined" &&
        window.localStorage.getItem(LOCAL_STORAGE_KEY) === "true"

      if (!hasLocalConnection) {
        setIsConnected(false)
        return
      }

      // If this browser has a local connection flag, verify that the
      // backend tokens are still valid.
      const response = await fetch("/api/emails?type=inbox&maxResults=1")

      if (response.ok) {
        setIsConnected(true)
      } else {
        // If tokens are no longer valid, clear local flag
        setIsConnected(false)
        try {
          window.localStorage.removeItem(LOCAL_STORAGE_KEY)
        } catch {
          // ignore
        }
      }
    } catch {
      setIsConnected(false)
    } finally {
      setCheckingAuth(false)
    }
  }

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/auth/profile")
      if (response.ok) {
        const data = await response.json()
        setUserProfile(data)
      }
    } catch {
      // ignore errors for profile
    }
  }

  const handleConnect = () => {
    // GmailConnect handles redirect
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      setIsConnected(false)
      setActiveView("inbox")
      setSelectedEmail(null)
      setUserProfile(null)
      setDraftsVersion((v) => v + 1)
    }
  }

  const handleDraftGenerated = () => {
    setDraftsVersion((v) => v + 1)
  }

  const renderView = () => {
    switch (activeView) {
      case "settings":
        return (
          <SettingsView
            status={syncStatus}
            syncing={syncStatus?.processing ?? syncInProgress}
            onSync={startSync}
            error={syncError}
          />
        )
      case "drafts":
        return <DraftsView refreshKey={draftsVersion} />
      case "sent":
        return (
          <InboxView
            selectedEmail={selectedEmail}
            onSelectEmail={setSelectedEmail}
            onDraftGenerated={handleDraftGenerated}
            viewType="sent"
          />
        )
      case "spam":
        return (
          <InboxView
            selectedEmail={selectedEmail}
            onSelectEmail={setSelectedEmail}
            onDraftGenerated={handleDraftGenerated}
            viewType="spam"
          />
        )
      case "trash":
        return (
          <InboxView
            selectedEmail={selectedEmail}
            onSelectEmail={setSelectedEmail}
            onDraftGenerated={handleDraftGenerated}
            viewType="trash"
          />
        )
      default:
        return (
          <InboxView
            selectedEmail={selectedEmail}
            onSelectEmail={setSelectedEmail}
            onDraftGenerated={handleDraftGenerated}
            viewType="inbox"
          />
        )
    }
  }

  const renderMobileTabs = () => {
    if (!isConnected) return null

    const tabs: { id: View; label: string }[] = [
      { id: "inbox", label: "Inbox" },
      { id: "sent", label: "Sent" },
      { id: "drafts", label: "Drafts" },
      { id: "settings", label: "Settings" },
    ]

    return (
      <div className="md:hidden border-b border-border">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex-1 py-3 text-sm font-medium ${
                activeView === tab.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const embeddedCount = syncStatus?.sentWithEmbeddings ?? 0
  const pendingCount = syncStatus?.pendingReplies ?? 0
  const processedDisplay = embeddedCount
  const toastTarget = (() => {
    if (pendingCount > 0) {
      return embeddedCount + pendingCount
    }
    if (syncStatus?.queued && syncStatus.queued > 0) {
      return syncStatus.queued
    }
    if (syncTarget && syncTarget > 0) {
      return syncTarget
    }
    return embeddedCount > 0 ? embeddedCount : null
  })()
  
  // Check if sync is complete (not processing and no pending emails)
  const isSyncComplete = !syncStatus?.processing && !syncInProgress && 
    pendingCount === 0 && 
    processedDisplay > 0 &&
    !syncError
  
  // Auto-hide toast after 3 seconds when sync completes
  useEffect(() => {
    if (isSyncComplete && !hideSyncToast) {
      const timer = setTimeout(() => {
        setHideSyncToast(true)
        setSyncInProgress(false)
      }, 3000) // Hide after 3 seconds
      return () => clearTimeout(timer)
    }
  }, [isSyncComplete, hideSyncToast])
  
  const showSyncToast = ((syncStatus?.processing ?? syncInProgress) || syncError || isSyncComplete) && !hideSyncToast

  return (
    <>
      <div className="flex h-screen bg-background text-foreground">
        {isConnected && (
          <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={handleLogout} />
        )}

        <div className="flex flex-col flex-1 min-h-0">
          <TopNav isConnected={isConnected} userProfile={userProfile} onLogout={handleLogout} />
          {renderMobileTabs()}

          <main className="flex-1 overflow-hidden">
            {checkingAuth ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-sm text-muted-foreground">Checking authentication...</div>
              </div>
            ) : !isConnected ? (
              <div className="flex items-center justify-center h-full p-4">
                <GmailConnect onConnect={handleConnect} />
              </div>
            ) : (
              renderView()
            )}
          </main>
        </div>
      </div>

      {showSyncToast && (
        <SyncToast
          syncing={syncInProgress}
          status={syncStatus}
          processed={processedDisplay}
          target={toastTarget}
          error={syncError}
          onDismiss={() => setHideSyncToast(true)}
        />
      )}
    </>
  )
}
