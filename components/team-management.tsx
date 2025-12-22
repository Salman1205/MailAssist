"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UserPlus, Mail, User, Shield, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"

interface TeamMember {
  id: string
  name: string
  email: string
  role: "admin" | "manager" | "agent"
  created_at: string
}

interface PendingInvitation {
  id: string
  email: string
  name: string
  role: string
  status: string
  expires_at: string
  created_at: string
}

export default function TeamManagementView() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [resendingInvite, setResendingInvite] = useState<string | null>(null)

  // Form state
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"agent" | "manager">("agent")

  useEffect(() => {
    loadTeamData()
  }, [])

  const loadTeamData = async () => {
    setLoading(true)
    try {
      // Load team members
      const membersRes = await fetch("/api/agents/list")
      if (membersRes.ok) {
        const membersData = await membersRes.json()
        setMembers(membersData.members || [])
      }

      // Load pending invitations
      const invitationsRes = await fetch("/api/agents/invitations")
      if (invitationsRes.ok) {
        const invitationsData = await invitationsRes.json()
        setInvitations(invitationsData.invitations || [])
      }
    } catch (err) {
      console.error("Error loading team data:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/agents/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to send invitation")
        setInviteLoading(false)
        return
      }

      setSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteDialogOpen(false)
      setInviteName("")
      setInviteEmail("")
      setInviteRole("agent")

      // Reload data to show new invitation
      await loadTeamData()
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setInviteLoading(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-950 text-purple-300 border-purple-800"
      case "manager":
        return "bg-blue-950 text-blue-300 border-blue-800"
      case "agent":
        return "bg-slate-700 text-slate-300 border-slate-600"
      default:
        return "bg-slate-700 text-slate-300 border-slate-600"
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-950 text-yellow-300 border-yellow-800"
      case "accepted":
        return "bg-green-950 text-green-300 border-green-800"
      case "expired":
        return "bg-red-950 text-red-300 border-red-800"
      default:
        return "bg-slate-700 text-slate-300 border-slate-600"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Team Management</h2>
          <p className="text-muted-foreground">
            Manage your team members and send invitations
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-200 group">
              <UserPlus className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
              Invite Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800">
            <form onSubmit={handleInvite}>
              <DialogHeader>
                <DialogTitle className="text-white">Invite Team Member</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Send an invitation to add a new team member. They'll receive an email with instructions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Name</Label>
                  <Input
                    id="name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                    className="bg-slate-800/50 border-slate-700 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="bg-slate-800/50 border-slate-700 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-slate-300">Role</Label>
                  <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                    <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      <SelectItem value="agent" className="text-white">Agent</SelectItem>
                      <SelectItem value="manager" className="text-white">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Agents can view and respond to tickets. Managers can also invite other team members.
                  </p>
                </div>
                {error && (
                  <Alert className="bg-red-950/30 border-red-900/50">
                    <AlertDescription className="text-red-300">{error}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={inviteLoading}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  {inviteLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {success && (
        <Alert className="bg-green-950/30 border-green-900/50 animate-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <AlertDescription className="text-green-300 ml-2">{success}</AlertDescription>
        </Alert>
      )}

      {/* Team Members */}
      <Card className="bg-slate-900/50 border-slate-800 backdrop-blur shadow-xl hover:shadow-2xl transition-shadow duration-300">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-lg border border-blue-700/30">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-white">Team Members</CardTitle>
              <CardDescription className="text-slate-400">
                {members.length} active {members.length === 1 ? 'member' : 'members'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-slate-600" />
              </div>
              <p className="text-slate-400 text-lg font-medium mb-2">No team members yet</p>
              <p className="text-slate-500 text-sm">Invite your first member to get started!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="text-slate-400">Email</TableHead>
                  <TableHead className="text-slate-400">Role</TableHead>
                  <TableHead className="text-slate-400">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member, index) => (
                  <TableRow
                    key={member.id}
                    className="border-slate-800 hover:bg-slate-800/30 transition-colors"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-full flex items-center justify-center border border-blue-700/30">
                          <User className="h-4 w-4 text-blue-400" />
                        </div>
                        <span className="font-semibold">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{member.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(member.role)}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400">{formatDate(member.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card className="bg-slate-900/50 border-slate-800 backdrop-blur shadow-xl hover:shadow-2xl transition-shadow duration-300">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 rounded-lg border border-yellow-700/30">
              <Mail className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <CardTitle className="text-white">Pending Invitations</CardTitle>
              <CardDescription className="text-slate-400">
                {invitations.length} {invitations.length === 1 ? 'invitation' : 'invitations'} pending
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-slate-600" />
              </div>
              <p className="text-slate-400 text-lg font-medium mb-2">No pending invitations</p>
              <p className="text-slate-500 text-sm">All invitations have been accepted or expired</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="text-slate-400">Email</TableHead>
                  <TableHead className="text-slate-400">Role</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation, index) => {
                  const expired = isExpired(invitation.expires_at)
                  return (
                    <TableRow
                      key={invitation.id}
                      className="border-slate-800 hover:bg-slate-800/30 transition-colors group"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 rounded-full flex items-center justify-center border border-yellow-700/30">
                            <Mail className="h-4 w-4 text-yellow-400" />
                          </div>
                          <span className="text-white font-semibold">{invitation.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-slate-500" />
                          {invitation.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(invitation.role)}>
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(expired ? "expired" : invitation.status)}>
                          {expired ? "Expired" : invitation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(invitation.expires_at)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
