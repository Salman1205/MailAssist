"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import UserManagement from "@/components/user-management"
import PromoteAdminDialog from "@/components/promote-admin-dialog"

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

interface SettingsViewProps {
  status: SyncStats | null
  syncing: boolean
  onSync: (maxResults?: number) => Promise<void>
  error?: string | null
  currentUserId?: string | null
}

export default function SettingsView({ status, syncing, onSync, error, currentUserId }: SettingsViewProps) {
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasAdmin, setHasAdmin] = useState(false)
  const [showPromoteDialog, setShowPromoteDialog] = useState(false)

  useEffect(() => {
    if (currentUserId) {
      fetch(`/api/users/${currentUserId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setCurrentUser(data.user)
            setIsAdmin(data.user.role === "admin")
          }
        })
        .catch(() => {})
      
      // Check if any admin exists
      fetch("/api/users")
        .then((res) => res.json())
        .then((data) => {
          const adminExists = (data.users || []).some((u: any) => u.role === "admin" && u.isActive)
          setHasAdmin(adminExists)
        })
        .catch(() => {})
    }
  }, [currentUserId])
  const [message, setMessage] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const formatLastSync = () => {
    if (!status?.lastSync) return "Never"
    return new Date(status.lastSync).toLocaleString()
  }

  const handleSyncClick = async () => {
    setMessage(null)
    setLocalError(null)
    try {
      await onSync(500)
      setMessage("Sync started in the background. Keep the tab open while we learn your tone.")
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to start sync")
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Card className="border border-border p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Account Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Keep your sent emails synchronized so AI drafts match your exact tone.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Emails embedded</p>
            <p className="text-2xl font-semibold text-foreground mt-2">
              {status?.sentWithEmbeddings ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Replies pending</p>
            <p className="text-2xl font-semibold text-foreground mt-2">
              {status?.pendingReplies ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Last sync</p>
            <p className="text-sm font-medium text-foreground mt-2">
              {formatLastSync()}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleSyncClick}
            disabled={syncing}
            className="w-full sm:w-auto"
          >
            {syncing ? "Syncing..." : "Sync Sent Emails"}
          </Button>

          {message && (
            <div className="text-sm text-emerald-600 bg-emerald-600/10 border border-emerald-200 rounded-md px-3 py-2">
              {message}
            </div>
          )}

          {(error || localError) && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error || localError}
            </div>
          )}
        </div>
      </Card>

      <Card className="border border-border p-6 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">How syncing works</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li>We fetch your sent emails securely via Gmail OAuth.</li>
          <li>Each email is stored locally and converted into an embedding vector.</li>
          <li>When you generate drafts, we compare the new email to your historical tone.</li>
          <li>You can re-run the sync anytime to capture new sent emails.</li>
        </ul>
      </Card>

      {isAdmin ? (
        <UserManagement currentUserId={currentUserId || null} />
      ) : !hasAdmin ? (
        <Card className="border border-border">
          <CardHeader>
            <CardTitle>Need Admin Access?</CardTitle>
            <CardDescription>
              No admin user exists. Promote the first user to admin to manage team members and settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowPromoteDialog(true)}>
              Promote First User to Admin
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              You need admin access to manage users. Contact an admin to change your role.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <PromoteAdminDialog
        open={showPromoteDialog}
        onOpenChange={setShowPromoteDialog}
        onPromoted={() => {
          // Reload page to refresh user role
          window.location.reload()
        }}
      />
    </div>
  )
}

