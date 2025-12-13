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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-[var(--status-urgent)] bg-[var(--status-urgent-bg)] border-[var(--status-urgent)]/30'
      case 'manager': return 'text-primary bg-primary/10 border-primary/30'
      case 'agent': return 'text-[var(--status-info)] bg-[var(--status-info-bg)] border-[var(--status-info)]/30'
      default: return 'text-muted-foreground bg-muted border-border'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return '👑'
      case 'manager': return '📊'
      case 'agent': return '👤'
      default: return '•'
    }
  }

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
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-border/60">
        <CardHeader className="space-y-3 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">Welcome Back!</CardTitle>
            </div>
          </div>
          <CardDescription className="text-sm leading-relaxed">
            Select your team member account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-4 bg-[var(--status-urgent-bg)] text-[var(--status-urgent)] text-sm rounded-lg border border-[var(--status-urgent)]/30 shadow-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading your accounts...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">No team members yet</p>
                <p className="text-sm text-muted-foreground">Create the first user (will be Admin with full access)</p>
              </div>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full shadow-md hover:shadow-lg transition-all">
                    Create First User (Admin)
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      Create First User
                    </DialogTitle>
                    <DialogDescription>
                      The first user will automatically be an Admin with full access
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">Name *</Label>
                      <Input
                        id="name"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="e.g., Salman"
                        className="shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">Email (optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="personal@example.com"
                        className="shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm font-medium">Role *</Label>
                      <Select value={newUserRole} onValueChange={(v: any) => setNewUserRole(v)}>
                        <SelectTrigger className="shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin (Required for first user)</SelectItem>
                          <SelectItem value="manager" disabled>Manager (Not available for first user)</SelectItem>
                          <SelectItem value="agent" disabled>Agent (Not available for first user)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        The first user must be Admin to manage the system.
                      </p>
                    </div>
                    <Button onClick={handleCreateUser} disabled={creating || !newUserName.trim() || newUserRole !== "admin"} className="w-full shadow-sm">
                      {creating ? "Creating..." : "Create Admin User"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Select your account:</p>
                <div className="space-y-2">
                  {users.map((user, index) => {
                    const isSelected = currentUserId === user.id
                    return (
                      <button
                        key={user.id}
                        className={`w-full text-left group transition-all duration-200 ease-out animate-in fade-in slide-in-from-bottom-2 rounded-lg`}
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => handleSelectUser(user.id)}
                      >
                        <div className={`p-4 border-2 rounded-lg transition-all duration-200 ${
                          isSelected
                            ? "border-primary bg-gradient-to-r from-primary/10 to-primary/5 shadow-md ring-2 ring-primary/20"
                            : "border-border/50 bg-card hover:border-primary/40 hover:bg-muted/50 hover:shadow-md"
                        }`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                              isSelected 
                                ? "bg-primary text-white shadow-sm" 
                                : "bg-primary/10 text-primary group-hover:bg-primary/20"
                            }`}>
                              <User className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-foreground">{user.name}</div>
                              {user.email && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {user.email}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded capitalize border ${
                                getRoleColor(user.role)
                              }`}>
                                {user.role}
                              </span>
                              {isSelected && (
                                <span className="text-[10px] text-primary font-medium">Active</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Create new user button */}
              {(!hasAdmin || currentUser?.role === "admin") && (
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full mt-4 border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all shadow-sm">
                      Create New User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        Create New User
                      </DialogTitle>
                      <DialogDescription>
                        {!hasAdmin 
                          ? "Add a new team member. At least one Admin is required."
                          : "Add a new team member to this account"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-name" className="text-sm font-medium">Name *</Label>
                        <Input
                          id="new-name"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="e.g., Ali"
                          className="shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-email" className="text-sm font-medium">Email (optional)</Label>
                        <Input
                          id="new-email"
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="personal@example.com"
                          className="shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-role" className="text-sm font-medium">Role *</Label>
                        <Select value={newUserRole} onValueChange={(v: any) => setNewUserRole(v)}>
                          <SelectTrigger className="shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="agent">Agent</SelectItem>
                          </SelectContent>
                        </Select>
                        {!hasAdmin && (
                          <p className="text-xs text-[var(--status-medium)] mt-1">
                            ⚠️ No admin exists. You must create at least one admin user.
                          </p>
                        )}
                      </div>
                      <Button onClick={handleCreateUser} disabled={creating || !newUserName.trim()} className="w-full shadow-sm">
                        {creating ? "Creating..." : "Create User"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}

          {users.length > 0 && !hasAdmin && (
            <div className="mt-4 p-4 bg-[var(--status-medium-bg)] border border-[var(--status-medium)]/30 rounded-lg space-y-3 shadow-sm">
              <div>
                <p className="text-sm font-medium text-[var(--status-medium)] mb-1">
                  ⚠️ No Admin User Exists
                </p>
                <p className="text-xs text-[var(--status-medium)]/80">
                  You need an admin to manage users and settings. Promote the first user to admin.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowPromoteDialog(true)}
                className="w-full text-xs"
              >
                Promote First User to Admin
              </Button>
            </div>
          )}

          {users.length > 0 && hasAdmin && currentUser && currentUser.role !== "admin" && (
            <div className="mt-4 p-4 bg-[var(--status-info-bg)] border border-[var(--status-info)]/30 rounded-lg shadow-sm">
              <p className="text-xs text-[var(--status-info)]">
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

