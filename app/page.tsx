"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import TopNav from "@/components/top-nav"
import Sidebar, { type SidebarView } from "@/components/sidebar"
import GmailConnect from "@/components/gmail-connect"
import InboxView from "@/components/inbox-view"
import SettingsView from "@/components/settings-view"
import DraftsView from "@/components/drafts-view"
import SyncToast from "@/components/sync-toast"
import UserSelector from "@/components/user-selector"
import UserManagement from "@/components/user-management"
import TicketsView from "@/components/tickets-view"
import AISettings from "@/components/ai-settings"
import QuickRepliesView from "@/components/quick-replies-view"
import AnalyticsDashboard from "@/components/analytics-dashboard"
import ComposeView from "@/components/compose-view"

type View = SidebarView

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

function PageContent() {
  const [isConnected, setIsConnected] = useState(false)
  const [activeView, setActiveView] = useState<View>("inbox")
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [draftsVersion, setDraftsVersion] = useState(0)
  const [ticketsVersion, setTicketsVersion] = useState(0)
  const [hasAutoSynced, setHasAutoSynced] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null)
  const [hasAdmin, setHasAdmin] = useState(false)

  const [syncStatus, setSyncStatus] = useState<SyncStats | null>(null)
  const [syncInProgress, setSyncInProgress] = useState(false)
  const [syncTarget, setSyncTarget] = useState<number | null>(null)
  const [syncBaseline, setSyncBaseline] = useState(0)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [hideSyncToast, setHideSyncToast] = useState(false)
  const [syncContinueCount, setSyncContinueCount] = useState(0) // Safety counter
  const LOCAL_STORAGE_KEY = "gmail_connected"
  const [loggingOut, setLoggingOut] = useState(false)
  const [globalSearch, setGlobalSearch] = useState<string>("")
  const [deepLinkTicketId, setDeepLinkTicketId] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    checkAuthStatus()
    checkUserSelection()

    const params = new URLSearchParams(window.location.search)
    if (params.get("auth") === "success") {
      setIsConnected(true)
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, "true")
      } catch {
        // Ignore localStorage errors (e.g. in private mode)
      }
      window.history.replaceState({}, "", window.location.pathname)
      // After Gmail auth, check if user is selected
      checkUserSelection()
    }
  }, [])

  // Listen to ticketId in the URL to deep-link into a specific ticket from notifications
  useEffect(() => {
    const ticketId = searchParams.get("ticketId")
    if (ticketId) {
      setActiveView("tickets")
      setDeepLinkTicketId(ticketId)
    }
  }, [searchParams])

  // Update browser tab title to show current user
  useEffect(() => {
    if (currentUser?.name) {
      document.title = `${currentUser.name} (${currentUser.role}) - MailAssist`
    } else if (isConnected) {
      document.title = "MailAssist"
    } else {
      document.title = "MailAssist - Connect Gmail"
    }
  }, [currentUser, isConnected])

  // Re-check admin status when currentUser changes
  useEffect(() => {
    if (currentUser && isConnected) {
      checkAdminExists()
    }
  }, [currentUser, isConnected])

  const checkAdminExists = async () => {
    try {
      const response = await fetch("/api/users")
      if (response.ok) {
        const data = await response.json()
        const adminExists = data.users?.some((u: any) => u.role === "admin" && u.isActive) || false
        setHasAdmin(adminExists)
      }
    } catch {
      // Ignore errors
    }
  }

  const checkUserSelection = async () => {
    try {
      // Check for admin existence first
      await checkAdminExists()
      
      // First check sessionStorage (per-tab)
      // But verify with API to ensure user belongs to current Gmail account
      if (typeof window !== "undefined") {
        const storedUserId = sessionStorage.getItem("current_user_id")
        const storedUserName = sessionStorage.getItem("current_user_name")
        const storedUserRole = sessionStorage.getItem("current_user_role")
        
        if (storedUserId && storedUserName && storedUserRole) {
          // Verify user still belongs to current account
          const verifyResponse = await fetch("/api/auth/current-user")
          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json()
            if (verifyData.user && verifyData.user.id === storedUserId) {
              // User is valid and belongs to current account
              setCurrentUserId(storedUserId)
              setCurrentUser({
                id: storedUserId,
                name: storedUserName,
                role: storedUserRole,
              })
              setCheckingUser(false)
              return
            }
          }
          // If verification failed, clear sessionStorage
          sessionStorage.removeItem("current_user_id")
          sessionStorage.removeItem("current_user_name")
          sessionStorage.removeItem("current_user_role")
        }
      }
      
      // Fallback: Check API (cookie-based, shared across tabs)
      const response = await fetch("/api/auth/current-user")
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setCurrentUserId(data.user.id)
          setCurrentUser({
            id: data.user.id,
            name: data.user.name,
            role: data.user.role,
          })
          // Store in sessionStorage for this tab
          if (typeof window !== "undefined") {
            sessionStorage.setItem("current_user_id", data.user.id)
            sessionStorage.setItem("current_user_name", data.user.name)
            sessionStorage.setItem("current_user_role", data.user.role)
          }
        }
      } else if (response.status === 403 || response.status === 404) {
        // User doesn't belong to current account or not found - clear sessionStorage
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("current_user_id")
          sessionStorage.removeItem("current_user_name")
          sessionStorage.removeItem("current_user_role")
        }
        setCurrentUserId(null)
        setCurrentUser(null)
      }
      // If 404, no user selected - that's okay, we'll show selector
    } catch {
      // Ignore errors
    } finally {
      setCheckingUser(false)
    }
  }

  const handleUserSelected = async (userId: string) => {
    setCurrentUserId(userId)
    setCheckingUser(false)
    
    // Fetch user details
    try {
      const response = await fetch(`/api/users/${userId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setCurrentUser({
            id: data.user.id,
            name: data.user.name,
            role: data.user.role,
          })
          // Store in sessionStorage for this tab
          if (typeof window !== "undefined") {
            sessionStorage.setItem("current_user_id", data.user.id)
            sessionStorage.setItem("current_user_name", data.user.name)
            sessionStorage.setItem("current_user_role", data.user.role)
          }
          
          // Refresh admin check after user selection
          await checkAdminExists()
          
          // After user selection, navigate to inbox (default view)
          setActiveView("inbox")
        }
      }
    } catch {
      // Ignore errors
    }
  }

  const handleSwitchUser = async (userId: string) => {
    // User switching - update state smoothly without page reload
    setCurrentUserId(userId)
    
    // Fetch user details to update UI
    try {
      const response = await fetch(`/api/users/${userId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          setCurrentUser({
            id: data.user.id,
            name: data.user.name,
            role: data.user.role,
          })
          // Store in sessionStorage for this tab
          if (typeof window !== "undefined") {
            sessionStorage.setItem("current_user_id", data.user.id)
            sessionStorage.setItem("current_user_name", data.user.name)
            sessionStorage.setItem("current_user_role", data.user.role)
          }
          // Refresh admin check after user selection
          await checkAdminExists()
        }
      }
    } catch {
      // Ignore errors
    }
  }

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
    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      // Clear sessionStorage for this tab
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("current_user_id")
        sessionStorage.removeItem("current_user_name")
        sessionStorage.removeItem("current_user_role")
      }
      setIsConnected(false)
      setCurrentUserId(null)
      setCurrentUser(null)
      setActiveView("inbox")
      setSelectedEmail(null)
      setUserProfile(null)
      setDraftsVersion((v) => v + 1)
      // Keep the logging overlay visible briefly to show feedback
      setTimeout(() => setLoggingOut(false), 600)
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
            currentUserId={currentUserId}
          />
        )
      case "users":
        return (
          <div className="p-6">
            <UserManagement currentUserId={currentUserId} />
          </div>
        )
      case "drafts":
        return <DraftsView key={currentUserId || "no-user"} refreshKey={draftsVersion} currentUserId={currentUserId} />
      case "compose":
        return <ComposeView key={currentUserId || "no-user"} currentUserId={currentUserId} onEmailSent={() => setTicketsVersion(v => v + 1)} />
      case "quick-replies":
        return <QuickRepliesView key={currentUserId || "no-user"} currentUserId={currentUserId} />
      case "tickets":
        return (
          <TicketsView
            key={currentUserId || "no-user"}
            currentUserId={currentUserId}
            currentUserRole={currentUser?.role as "admin" | "manager" | "agent" | null}
            globalSearchTerm={globalSearch}
            refreshKey={ticketsVersion}
            initialTicketId={deepLinkTicketId || undefined}
          />
        )
      case "ai-settings":
        return <AISettings />
      case "analytics":
        return (
          <div className="p-6">
            <AnalyticsDashboard currentUserRole={currentUser?.role as "admin" | "manager" | "agent" | null} />
          </div>
        )
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
      { id: "tickets", label: "Tickets" },
      { id: "drafts", label: "Drafts" },
      { id: "settings", label: "Settings" },
    ]

    // Add Team tab for admins
    if (currentUser?.role === "admin") {
      tabs.push({ id: "users", label: "Team" })
    }

    // Add AI tab for admin/manager
    if (currentUser?.role === "admin" || currentUser?.role === "manager") {
      tabs.push({ id: "ai-settings", label: "AI" })
      tabs.push({ id: "analytics", label: "Analytics" })
    }

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
      <div className="flex h-screen bg-background text-foreground overflow-x-hidden">
        {isConnected && (
          <Sidebar 
            activeView={activeView} 
            setActiveView={setActiveView} 
            onLogout={handleLogout}
            currentUser={currentUser}
          />
        )}

        <div className="flex flex-col flex-1 min-h-0">
          <TopNav 
            isConnected={isConnected} 
            userProfile={userProfile} 
            currentUser={currentUser}
            onLogout={handleLogout}
            onSwitchUser={handleSwitchUser}
            onSearch={(query) => {
              // Only update global search term. Do not auto-navigate to Tickets.
              setGlobalSearch(query)
            }}
          />
          {renderMobileTabs()}

          <main className="flex-1 overflow-auto">
            {checkingAuth || checkingUser ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {checkingAuth ? "Checking authentication..." : "Loading..."}
                  </p>
                </div>
              </div>
            ) : !isConnected ? (
              <div className="flex items-center justify-center h-full p-4">
                <GmailConnect onConnect={handleConnect} />
              </div>
            ) : !currentUserId || (!hasAdmin && currentUser && currentUser.role !== "admin") ? (
              <UserSelector 
                onUserSelected={handleUserSelected}
                currentUserId={currentUserId}
              />
            ) : (
              renderView()
            )}
          </main>
        </div>
      </div>

      {loggingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm text-muted-foreground">Logging you out...</p>
          </div>
        </div>
      )}

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

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
      <PageContent />
    </Suspense>
  )
}
