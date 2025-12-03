"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Shield } from "lucide-react"

interface PromoteAdminDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPromoted: () => void
}

export default function PromoteAdminDialog({ open, onOpenChange, onPromoted }: PromoteAdminDialogProps) {
  const [promoting, setPromoting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handlePromote = async () => {
    try {
      setPromoting(true)
      setError(null)
      setSuccess(false)

      const response = await fetch("/api/users/promote-first-admin", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to promote user to admin")
      }

      setSuccess(true)
      setTimeout(() => {
        onPromoted()
        onOpenChange(false)
        // Reload page to refresh user role
        window.location.reload()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to promote user")
    } finally {
      setPromoting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Promote First User to Admin
          </DialogTitle>
          <DialogDescription>
            You need admin access to manage users. This will promote the first user account to admin role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                User successfully promoted to admin! Refreshing...
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will promote the first user account (oldest by creation date) to admin role. 
                You'll need to refresh the page after promotion.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={promoting || success}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePromote}
            disabled={promoting || success}
          >
            {promoting ? "Promoting..." : success ? "Success!" : "Promote to Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


