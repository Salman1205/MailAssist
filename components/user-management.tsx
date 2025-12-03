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
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create user")
      }

      setShowCreateDialog(false)
      resetForm()
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user")
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
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update user")
      }

      setEditingUser(null)
      resetForm()
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user")
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
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete user")
      }

      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user")
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
        return "bg-red-500/10 text-red-600 dark:text-red-400"
      case "manager":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400"
      case "agent":
        return "bg-green-500/10 text-green-600 dark:text-green-400"
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400"
    }
  }

  const isAdmin = currentUser?.role === "admin"
  const hasAdmin = users.some(u => u.role === "admin" && u.isActive)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-sm text-muted-foreground">Loading users...</div>
      </div>
    )
  }

  return (
    <>
      <Card className="border border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {isAdmin 
                  ? "Manage team members and their roles"
                  : "You need admin access to manage users"}
              </CardDescription>
            </div>
            {isAdmin ? (
              <>
                <Button onClick={() => {
                  setEditingUser(null)
                  resetForm()
                  setError(null)
                  setShowCreateDialog(true)
                }}>Add User</Button>
                <Dialog open={showCreateDialog || editingUser !== null} onOpenChange={(open) => {
                  if (!open) {
                    closeDialog()
                  }
                }}>
                  <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? "Edit User" : "Create New User"}</DialogTitle>
                <DialogDescription>
                  {editingUser 
                    ? "Update user information and role"
                    : "Add a new team member to your account"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                    {error}
                  </div>
                )}
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Azzam"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="personal@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select value={formRole} onValueChange={(v: any) => setFormRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={editingUser ? handleUpdate : handleCreate} 
                  disabled={saving || !formName.trim()}
                  className="w-full"
                >
                  {saving ? "Saving..." : editingUser ? "Update User" : "Create User"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
              </>
            ) : null}
          </div>
        </CardHeader>
      <CardContent>
        {error && !showCreateDialog && !editingUser && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
            {error}
          </div>
        )}
        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No users found. Create the first team member.
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.name}</span>
                      {user.id === currentUserId && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    {user.email && (
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getRoleColor(user.role)}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
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
      <Card className="border border-border mt-4">
        <CardHeader>
          <CardTitle>Need Admin Access?</CardTitle>
          <CardDescription>
            No admin user exists. Promote the first user to admin to manage team members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowPromoteDialog(true)}>
            Promote First User to Admin
          </Button>
        </CardContent>
      </Card>
    )}

    <PromoteAdminDialog
      open={showPromoteDialog}
      onOpenChange={setShowPromoteDialog}
      onPromoted={() => {
        fetchUsers()
      }}
    />
  </>
  )
}

