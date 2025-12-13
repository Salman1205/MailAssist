"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import Logo from "@/components/logo"
import { useTheme } from "next-themes"
import { Moon, Sun, Users, User } from "lucide-react"
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
  onSearch?: (query: string) => void
}

export default function TopNav({ isConnected, userProfile, currentUser, onLogout, onSwitchUser, onSearch }: TopNavProps) {
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
    <header className="bg-background/95 backdrop-blur-sm border-b border-border h-16 flex items-center justify-between px-4 md:px-6 gap-2 md:gap-4">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <div className="flex-shrink-0">
          <Logo size="small" />
        </div>
        <div className="text-base font-bold text-foreground truncate hidden sm:block">MailAssist</div>
      </div>

      {/* Global Search - Now visible on all screen sizes */}
      {isConnected && (
        <form
          className="flex items-center gap-2 flex-1 max-w-3xl relative"
          onSubmit={(e) => {
            e.preventDefault()
            const form = e.currentTarget
            const input = form.querySelector<HTMLInputElement>('input[name="global-search"]')
            if (input && onSearch) {
              onSearch(input.value.trim())
            }
          }}
        >
          <input
            name="global-search"
            type="search"
            placeholder="Search..."
            className="w-full h-10 px-4 pr-10 rounded-xl border-2 border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all hover:border-primary/50 md:placeholder:text-[length:inherit]"
            style={{ fontSize: '14px' }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                const target = e.target as HTMLInputElement
                target.value = ''
                target.blur()
                if (onSearch) onSearch('')
              }
            }}
            onChange={(e) => {
              if (e.target.value === '' && onSearch) {
                onSearch('')
              }
            }}
          />
          {/* Clear button */}
          <button
            type="button"
            onClick={(e) => {
              const form = e.currentTarget.closest('form')
              const input = form?.querySelector<HTMLInputElement>('input[name="global-search"]')
              if (input) {
                input.value = ''
                input.focus()
                if (onSearch) onSearch('')
              }
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors opacity-0 hover:opacity-100 focus:opacity-100"
            aria-label="Clear search"
            style={{
              opacity: 'var(--search-has-value, 0)',
            }}
            onMouseEnter={(e) => {
              const form = e.currentTarget.closest('form')
              const input = form?.querySelector<HTMLInputElement>('input[name="global-search"]')
              if (input && input.value) {
                e.currentTarget.style.opacity = '1'
              }
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </form>
      )}

      <div className="flex items-center gap-2 flex-shrink-0">
        {isConnected && (
          <button
            onClick={toggleTheme}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-input hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Toggle theme"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        {isConnected && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="hidden text-right sm:block min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {currentUser?.name || userProfile?.name || "Connected"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {currentUser?.role 
                      ? `${currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}` 
                      : userProfile?.email || "Loading..."}
                  </div>
                </div>
                <Avatar className="h-8 w-8 flex-shrink-0 border border-border">
                  {userProfile?.picture ? (
                    <img src={userProfile.picture} alt={userProfile.name || "User"} className="rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {currentUser?.name 
                        ? currentUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                        : initials}
                    </AvatarFallback>
                  )}
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem className="block sm:hidden text-left py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {currentUser?.name || userProfile?.name || "Connected"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentUser?.role 
                      ? `${currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}` 
                      : userProfile?.email || "Loading..."}
                  </p>
                </div>
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
                    <span>Switch User</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          Switch User
                        </DialogTitle>
                        <DialogDescription className="text-xs mt-1">
                          Select a team member to manage their account
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        {loadingUsers ? (
                          <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <span>Loading users...</span>
                          </div>
                        ) : users.length === 0 ? (
                          <div className="text-sm text-muted-foreground text-center py-8">
                            No users found
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                            {users.map((user, index) => (
                              <button
                                key={user.id}
                                onClick={() => handleSwitchUser(user.id)}
                                className={`w-full text-left group transition-all duration-200 rounded-lg animate-in fade-in slide-in-from-bottom-2`}
                                style={{ animationDelay: `${index * 50}ms` }}
                              >
                                <div className={`p-3 border-2 rounded-lg transition-all duration-200 ${
                                  user.id === currentUser?.id
                                    ? "border-primary bg-gradient-to-r from-primary/10 to-primary/5 shadow-md ring-2 ring-primary/20"
                                    : "border-border/50 hover:border-primary/40 hover:bg-muted/50 hover:shadow-sm"
                                }`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                                      user.id === currentUser?.id
                                        ? "bg-primary text-white shadow-sm"
                                        : "bg-primary/10 text-primary group-hover:bg-primary/20"
                                    }`}>
                                      <User className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm text-foreground">{user.name}</div>
                                      {user.email && (
                                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                                          {user.email}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs px-2 py-0.5 capitalize font-semibold ${
                                          user.id === currentUser?.id 
                                            ? "border-primary bg-primary/10 text-primary" 
                                            : "border-border/50 bg-transparent"
                                        }`}
                                      >
                                        {user.role}
                                      </Badge>
                                      {user.id === currentUser?.id && (
                                        <span className="text-[10px] text-primary font-medium">Active</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
              <DropdownMenuSeparator />
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
