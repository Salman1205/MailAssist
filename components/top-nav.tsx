"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import Logo from "@/components/logo"
import { useTheme } from "next-themes"
import { Moon, Sun, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useState } from "react"

interface UserProfile {
  name?: string
  email?: string
  picture?: string
}

interface User {
  id: string
  name: string
  email?: string | null
  role: "admin" | "manager" | "agent"
  isActive: boolean
}

interface TopNavProps {
  isConnected: boolean
  userProfile?: UserProfile | null
  currentUser?: { id: string; name: string; role: string } | null
  onLogout?: () => void
  onSwitchUser?: (userId: string) => void
}

export default function TopNav({ isConnected, userProfile, currentUser, onLogout, onSwitchUser }: TopNavProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showUserDialog, setShowUserDialog] = useState(false)

  const toggleTheme = () => setTheme(isDark ? "light" : "dark")

  const fetchUsers = async () => {
    if (!onSwitchUser) return
    try {
      setLoadingUsers(true)
      const response = await fetch("/api/users")
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch {
      // Ignore errors
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleSwitchUser = async (userId: string) => {
    if (!onSwitchUser) return
    try {
      const response = await fetch("/api/auth/select-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      if (response.ok) {
        const data = await response.json()
        // Store in sessionStorage for this tab
        if (typeof window !== "undefined") {
          sessionStorage.setItem("current_user_id", userId)
          sessionStorage.setItem("current_user_name", data.user.name)
          sessionStorage.setItem("current_user_role", data.user.role)
        }
        onSwitchUser(userId)
        setShowUserDialog(false)
        // State will update smoothly without page reload
      }
    } catch {
      // Ignore errors
    }
  }
  const initials = userProfile?.name
    ? userProfile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "ME"

  return (
    <header className="bg-card border-b border-border h-16 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-2">
        <Logo size="small" />
        <div className="text-lg font-semibold text-foreground">MailAssist</div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {isConnected && (
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full border border-border hover:bg-secondary transition"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        {isConnected && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary transition-colors">
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-medium text-foreground">
                    {currentUser?.name || userProfile?.name || "Connected"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {currentUser?.role 
                      ? `Active as ${currentUser.role}` 
                      : userProfile?.email || "Loading profile..."}
                  </div>
                </div>
                <Avatar className="h-9 w-9">
                  {userProfile?.picture ? (
                    <img src={userProfile.picture} alt={userProfile.name || "User"} className="rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                      {currentUser?.name 
                        ? currentUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                        : initials}
                    </AvatarFallback>
                  )}
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 sm:w-56">
              <DropdownMenuItem className="block sm:hidden text-left">
                <p className="text-sm font-medium text-foreground">
                  {currentUser?.name || userProfile?.name || "Connected"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentUser?.role 
                    ? `Active as ${currentUser.role}`
                    : userProfile?.email || "Loading profile..."}
                </p>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="block sm:hidden" />
              {onSwitchUser && (
                <>
                  <DropdownMenuItem 
                    onSelect={(e) => {
                      e.preventDefault()
                      setShowUserDialog(true)
                      fetchUsers()
                    }}
                    className="cursor-pointer"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Switch User
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Switch User</DialogTitle>
                        <DialogDescription>
                          Select which team member you want to use in this tab
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        {loadingUsers ? (
                          <div className="text-sm text-muted-foreground text-center py-8">
                            Loading users...
                          </div>
                        ) : users.length === 0 ? (
                          <div className="text-sm text-muted-foreground text-center py-8">
                            No users found
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {users.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => handleSwitchUser(user.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                                  user.id === currentUser?.id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border hover:bg-secondary"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium">{user.name}</div>
                                    {user.email && (
                                      <div className={`text-xs mt-0.5 ${
                                        user.id === currentUser?.id ? "opacity-75" : "text-muted-foreground"
                                      }`}>
                                        {user.email}
                                      </div>
                                    )}
                                  </div>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs capitalize ${
                                      user.id === currentUser?.id 
                                        ? "border-primary-foreground/50 bg-primary-foreground/10" 
                                        : ""
                                    }`}
                                  >
                                    {user.role}
                                  </Badge>
                                </div>
                                {user.id === currentUser?.id && (
                                  <div className="text-xs mt-2 opacity-75">Current user</div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
              <DropdownMenuItem onClick={onLogout} className="text-destructive cursor-pointer">
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
