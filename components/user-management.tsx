"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Trash2, Edit2 } from "lucide-react"
import PromoteAdminDialog from "@/components/promote-admin-dialog"

interface User {
  id: string
  name: string
  email?: string | null
  role: "admin" | "manager" | "agent"
  isActive: boolean
}

interface UserManagementProps {
  currentUserId: string | null
}

export default function UserManagement({ currentUserId }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPromoteDialog, setShowPromoteDialog] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formRole, setFormRole] = useState<"admin" | "manager" | "agent">("agent")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (currentUserId && users.length > 0) {
      const user = users.find(u => u.id === currentUserId)
      setCurrentUser(user || null)
    }
  }, [currentUserId, users])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/users")
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

  const handleCreate = async () => {
    if (!formName.trim()) {
      setError("Name is required")
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim() || null,
          role: formRole,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        const errorMessage = errorData.error || errorData.details || "Failed to create user"
        throw new Error(errorMessage)
      }

      setShowCreateDialog(false)
      resetForm()
      await fetchUsers()
      toast({ 
        title: "Success", 
        description: "User created successfully" 
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create user"
      setError(errorMessage)
      toast({ 
        title: "Creation Failed", 
        description: errorMessage, 
        variant: "destructive" 
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingUser || !formName.trim()) {
      setError("Name is required")
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim() || null,
          role: formRole,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        const errorMessage = errorData.error || errorData.details || "Failed to update user"
        throw new Error(errorMessage)
      }

      setEditingUser(null)
      resetForm()
      await fetchUsers()
      toast({ 
        title: "Success", 
        description: "User updated successfully" 
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update user"
      setError(errorMessage)
      toast({ 
        title: "Update Failed", 
        description: errorMessage, 
        variant: "destructive" 
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) {
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        const errorMessage = errorData.error || errorData.details || "Failed to delete user"
        throw new Error(errorMessage)
      }

      await fetchUsers()
      toast({ 
        title: "Success", 
        description: "User deactivated successfully" 
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete user"
      setError(errorMessage)
      toast({ 
        title: "Deletion Failed", 
        description: errorMessage, 
        variant: "destructive" 
      })
    }
  }

  const resetForm = () => {
    setFormName("")
    setFormEmail("")
    setFormRole("agent")
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setFormName(user.name)
    setFormEmail(user.email || "")
    setFormRole(user.role)
  }

  const closeDialog = () => {
    setShowCreateDialog(false)
    setEditingUser(null)
    resetForm()
    setError(null)
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-[var(--status-urgent-bg)] text-[var(--status-urgent)] border border-[var(--status-urgent)]/30"
      case "manager":
        return "bg-primary/10 text-primary border border-primary/30"
      case "agent":
        return "bg-[var(--status-info-bg)] text-[var(--status-info)] border border-[var(--status-info)]/30"
      default:
        return "bg-muted text-muted-foreground border border-border/50"
    }
  }

  const isAdmin = currentUser?.role === "admin"
  const hasAdmin = users.some(u => u.role === "admin" && u.isActive)

  if (loading) {
    return (
      <div className="bg-background h-full">
        <div className="max-w-6xl mx-auto p-6 lg:p-10">
          <div className="mb-10 space-y-3">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">Team Management</h1>
            <p className="text-base text-muted-foreground">Manage team members, roles, and permissions</p>
          </div>
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-5">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <div className="text-base font-semibold text-muted-foreground">Loading team members...</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 lg:p-10">
        {/* Header Section */}
        <div className="mb-10 space-y-3">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">Team Management</h1>
          <p className="text-base text-muted-foreground max-w-3xl">
            {isAdmin 
              ? "Add team members, assign roles, and manage who can access what in your account."
              : "View your team members and their assigned roles."}
          </p>
        </div>
      
        <Card className="border-2 shadow-xl">
          <CardHeader className="pb-6 pt-8 px-8">
            <div className="flex items-center justify-between gap-6">
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold">Team Members</CardTitle>
                <CardDescription className="text-base">
                  {isAdmin ? `${users.length} member${users.length !== 1 ? 's' : ''} in your team` : `${users.length} team member${users.length !== 1 ? 's' : ''}`}
                </CardDescription>
              </div>
              {isAdmin ? (
                <>
                  <Button onClick={() => {
                    setEditingUser(null)
                    resetForm()
                    setError(null)
                    setShowCreateDialog(true)
                  }} size="lg" className="shadow-lg hover:shadow-xl transition-all">
                    Add Team Member
                  </Button>
                  <Dialog open={showCreateDialog || editingUser !== null} onOpenChange={(open) => {
                    if (!open) {
                      closeDialog()
                    }
                  }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-lg">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          {editingUser ? (
                            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          ) : (
                            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          )}
                        </div>
                        {editingUser ? "Edit Team Member" : "Add Team Member"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingUser 
                          ? "Update team member information and role"
                          : "Add a new team member to your account"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      {error && (
                        <div className="p-3 bg-[var(--status-urgent-bg)] text-[var(--status-urgent)] text-sm rounded-lg border border-[var(--status-urgent)]/30">
                          {error}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium">Name *</Label>
                        <Input
                          id="name"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="e.g., Azzam"
                          className="shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium">Email (optional)</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          placeholder="personal@example.com"
                          className="shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role" className="text-sm font-medium">Role *</Label>
                        <Select value={formRole} onValueChange={(v: any) => setFormRole(v)}>
                          <SelectTrigger className="shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin - Full access</SelectItem>
                            <SelectItem value="manager">Manager - Can manage team</SelectItem>
                            <SelectItem value="agent">Agent - Limited access</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={editingUser ? handleUpdate : handleCreate} 
                        disabled={saving || !formName.trim()}
                        className="w-full shadow-sm"
                        size="lg"
                      >
                        {saving ? "Saving..." : editingUser ? "Update Member" : "Add Member"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="pt-2 px-6 pb-6">
            {error && !showCreateDialog && !editingUser && (
              <div className="mb-6 p-3 bg-[var(--status-urgent-bg)] text-[var(--status-urgent)] text-xs rounded-lg border border-[var(--status-urgent)]/30">
                {error}
              </div>
            )}
            {users.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-2a6 6 0 0112 0v2zm0 0h6v-2a6 6 0 00-9-5.697" /></svg>
                </div>
                <div>
                  <p className="text-foreground font-semibold">No team members yet</p>
                  <p className="text-muted-foreground text-sm mt-1">Create your first team member to get started</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:border-primary/30 hover:bg-muted/30 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">{user.name}</span>
                          {user.id === currentUserId && (
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">You</Badge>
                          )}
                        </div>
                        {user.email && (
                          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-xs font-semibold capitalize ${getRoleColor(user.role)}`}>
                        {user.role}
                      </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(user)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  {user.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(user.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      </Card>

      {!isAdmin && !hasAdmin && (
        <div className="mt-16 pt-8 border-t border-border/40">
          <Card className="border-[var(--status-medium)]/30 bg-[var(--status-medium-bg)] shadow-md">
            <CardHeader>
              <CardTitle className="text-lg text-[var(--status-medium)]">⚠️ Admin access required</CardTitle>
              <CardDescription className="text-[var(--status-medium)]/80 mt-2">
                No admin user exists. You need to promote the first user to admin to manage team members and settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowPromoteDialog(true)} variant="outline" className="border-[var(--status-medium)]/30 hover:bg-[var(--status-medium)]/10">
                Promote First User to Admin
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      </div>

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

