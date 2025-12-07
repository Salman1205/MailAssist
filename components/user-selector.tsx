"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { User } from "lucide-react"
import PromoteAdminDialog from "@/components/promote-admin-dialog"

interface User {
  id: string
  name: string
  email?: string | null
  role: "admin" | "manager" | "agent"
  isActive: boolean
}

interface UserSelectorProps {
  onUserSelected: (userId: string) => void
  onCreateNew?: () => void
  currentUserId?: string | null
}

export default function UserSelector({ onUserSelected, onCreateNew, currentUserId }: UserSelectorProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  // Default to admin if no users exist, otherwise default to agent
  const [newUserRole, setNewUserRole] = useState<"admin" | "manager" | "agent">(
    users.length === 0 ? "admin" : "agent"
  )
  const [creating, setCreating] = useState(false)
  const [showPromoteDialog, setShowPromoteDialog] = useState(false)
  const [hasAdmin, setHasAdmin] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    // Check if any admin exists
    const adminExists = users.some(u => u.role === "admin" && u.isActive)
    setHasAdmin(adminExists)
    
    // If no users exist, default role to admin for first user
    if (users.length === 0 && newUserRole !== "admin") {
      setNewUserRole("admin")
    }
    
    // Find current user if currentUserId is provided
    if (currentUserId && users.length > 0) {
      const user = users.find(u => u.id === currentUserId)
      setCurrentUser(user || null)
    }
  }, [users, newUserRole, currentUserId])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/auth/select-user")
      if (!response.ok) {
        throw new Error("Failed to fetch users")
      }
      const data = await response.json()
      setUsers(data.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectUser = async (userId: string) => {
    try {
      const response = await fetch("/api/auth/select-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to select user")
      }

      const data = await response.json()
      
      // Store in sessionStorage for this tab
      if (typeof window !== "undefined") {
        sessionStorage.setItem("current_user_id", userId)
        sessionStorage.setItem("current_user_name", data.user.name)
        sessionStorage.setItem("current_user_role", data.user.role)
      }
      
      onUserSelected(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select user")
    }
  }

  const handleCreateUser = async () => {
    if (!newUserName.trim()) {
      setError("Name is required")
      return
    }

    // If no users exist, force admin role
    const roleToUse = users.length === 0 ? "admin" : newUserRole

    try {
      setCreating(true)
      setError(null)

      const response = await fetch("/api/auth/select-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createNew: true,
          name: newUserName.trim(),
          email: newUserEmail.trim() || null,
          role: roleToUse,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create user")
      }

      const data = await response.json()
      setShowCreateDialog(false)
      setNewUserName("")
      setNewUserEmail("")
      setNewUserRole(users.length === 0 ? "admin" : "agent")
      await fetchUsers()
      
      // If this was the first user (now admin), auto-select them
      if (users.length === 0 && data.user && data.user.role === "admin") {
        // Auto-select the first admin user
        setTimeout(() => {
          handleSelectUser(data.user.id)
        }, 500)
      }
      
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user")
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-lg shadow-lg border-2">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl">Welcome Back!</CardTitle>
          <CardDescription className="text-base">
            Select your team member account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
              {error}
            </div>
          )}

          {users.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium mb-2">No team members yet</p>
                <p className="text-muted-foreground mb-6">Create the first user (will be Admin):</p>
              </div>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full transition-all duration-200 hover:scale-105 hover:shadow-md">Create First User (Admin)</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create First User</DialogTitle>
                    <DialogDescription>
                      The first user will automatically be an Admin with full access
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="e.g., Salman"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email (optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="personal@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Role *</Label>
                      <Select value={newUserRole} onValueChange={(v: any) => setNewUserRole(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin (Required for first user)</SelectItem>
                          <SelectItem value="manager" disabled>Manager (Not available for first user)</SelectItem>
                          <SelectItem value="agent" disabled>Agent (Not available for first user)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        The first user must be Admin to manage the system.
                      </p>
                    </div>
                    <Button onClick={handleCreateUser} disabled={creating || !newUserName.trim() || newUserRole !== "admin"} className="w-full">
                      {creating ? "Creating..." : "Create Admin User"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground mb-2">Select your account:</p>
                {users.map((user) => {
                  const isSelected = currentUserId === user.id
                  return (
                    <Button
                      key={user.id}
                      variant="outline"
                      className={`w-full justify-start h-auto py-4 px-4 transition-all duration-300 ease-out relative animate-in fade-in slide-in-from-bottom-4 ${
                        isSelected 
                          ? "border-primary border-2 bg-primary/10 shadow-md ring-2 ring-primary/20 scale-[1.02]" 
                          : "hover:bg-accent hover:border-primary/50 hover:border-2 hover:shadow-sm hover:scale-[1.01]"
                      }`}
                      style={{ animationDelay: `${users.indexOf(user) * 100}ms` }}
                      onClick={() => handleSelectUser(user.id)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "bg-primary/20" : "bg-primary/10"
                        }`}>
                          <User className={`w-5 h-5 ${isSelected ? "text-primary" : "text-primary"}`} />
                        </div>
                        <div className="flex flex-col items-start flex-1 min-w-0">
                          <span className={`font-semibold text-base ${
                            isSelected ? "text-foreground" : "text-foreground"
                          }`}>{user.name}</span>
                          {user.email && (
                            <span className={`text-xs truncate w-full ${
                              isSelected ? "text-muted-foreground" : "text-muted-foreground"
                            }`}>{user.email}</span>
                          )}
                          <span className={`text-xs font-medium capitalize mt-0.5 ${
                            isSelected ? "text-primary" : "text-primary"
                          }`}>{user.role}</span>
                        </div>
                        {isSelected && (
                          <div className="flex-shrink-0">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                          </div>
                        )}
                      </div>
                    </Button>
                  )
                })}
              </div>

              {/* Only show create button if user is admin or no admin exists */}
              {(!hasAdmin || currentUser?.role === "admin") && (
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      Create New User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>
                        {!hasAdmin 
                          ? "Add a new team member. At least one Admin is required."
                          : "Add a new team member to this account"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="new-name">Name *</Label>
                        <Input
                          id="new-name"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="e.g., Ali"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-email">Email (optional)</Label>
                        <Input
                          id="new-email"
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="personal@example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-role">Role *</Label>
                        <Select value={newUserRole} onValueChange={(v: any) => setNewUserRole(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="agent">Agent</SelectItem>
                          </SelectContent>
                        </Select>
                        {!hasAdmin && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            ⚠️ No admin exists. You must create at least one admin user.
                          </p>
                        )}
                      </div>
                      <Button onClick={handleCreateUser} disabled={creating || !newUserName.trim()}>
                        {creating ? "Creating..." : "Create User"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}

          {users.length > 0 && !hasAdmin && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md space-y-3">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                  ⚠️ No Admin User Exists
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  You need an admin to manage users and settings. Promote the first user to admin.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowPromoteDialog(true)}
                className="w-full"
              >
                Promote First User to Admin
              </Button>
            </div>
          )}

          {users.length > 0 && hasAdmin && currentUser && currentUser.role !== "admin" && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                ℹ️ You're logged in as <strong>{currentUser.role}</strong>. Switch to an admin user to manage team members.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <PromoteAdminDialog
        open={showPromoteDialog}
        onOpenChange={setShowPromoteDialog}
        onPromoted={() => {
          fetchUsers()
        }}
      />
    </div>
  )
}

