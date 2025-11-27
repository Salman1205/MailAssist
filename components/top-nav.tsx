"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Logo from "@/components/logo"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

interface UserProfile {
  name?: string
  email?: string
  picture?: string
}

interface TopNavProps {
  isConnected: boolean
  userProfile?: UserProfile | null
  onLogout?: () => void
}

export default function TopNav({ isConnected, userProfile, onLogout }: TopNavProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const toggleTheme = () => setTheme(isDark ? "light" : "dark")
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
                    {userProfile?.name || "Connected"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {userProfile?.email || "Loading profile..."}
                  </div>
                </div>
                <Avatar className="h-9 w-9">
                  {userProfile?.picture ? (
                    <img src={userProfile.picture} alt={userProfile.name || "User"} className="rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 sm:w-56">
              <DropdownMenuItem className="block sm:hidden text-left">
                <p className="text-sm font-medium text-foreground">{userProfile?.name || "Connected"}</p>
                <p className="text-xs text-muted-foreground">{userProfile?.email || "Loading profile..."}</p>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout} className="text-destructive">
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
