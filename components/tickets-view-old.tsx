"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, User, Mail, Clock, Tag } from "lucide-react"

interface Ticket {
  id: string
  threadId: string
  customerEmail: string
  customerName?: string | null
  subject: string
  status: "open" | "pending" | "on_hold" | "closed"
  priority: "low" | "medium" | "high" | "urgent"
  assigneeUserId?: string | null
  assigneeName?: string | null
  tags: string[]
  lastCustomerReplyAt?: string | null
  lastAgentReplyAt?: string | null
  createdAt: string
  updatedAt: string
}

interface User {
  id: string
  name: string
  role: "admin" | "manager" | "agent"
}

interface TicketsViewProps {
  currentUserId: string | null
  currentUserRole: "admin" | "manager" | "agent" | null
}

export default function TicketsView({ currentUserId, currentUserRole }: TicketsViewProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all")

  const canAssign = currentUserRole === "admin" || currentUserRole === "manager"

  useEffect(() => {
    fetchTickets()
    if (canAssign) {
      fetchUsers()
    }
  }, [canAssign])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/tickets")
      if (!response.ok) {
        throw new Error("Failed to fetch tickets")
      }
      const data = await response.json()
      setTickets(data.tickets || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets")
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      if (!response.ok) return
      const data = await response.json()
      // Filter to only agents (for assignment)
      const agents = (data.users || []).filter((u: User) => u.role === "agent" && u.id !== currentUserId)
      setUsers(agents)
    } catch (err) {
      console.error("Error fetching users:", err)
    }
  }

  const handleAssign = async (ticketId: string, assigneeUserId: string | null) => {
    try {
      setAssigning(ticketId)
      const response = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeUserId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to assign ticket")
      }

      const data = await response.json()
      // Update ticket in list
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? data.ticket : t))
      )
      // Update selected ticket if it's the one being assigned
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(data.ticket)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign ticket")
    } finally {
      setAssigning(null)
    }
  }

  const getStatusColor = (status: Ticket["status"]) => {
    switch (status) {
      case "open":
        return "bg-blue-500"
      case "pending":
        return "bg-yellow-500"
      case "on_hold":
        return "bg-orange-500"
      case "closed":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const getPriorityColor = (priority: Ticket["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500"
      case "high":
        return "bg-orange-500"
      case "medium":
        return "bg-yellow-500"
      case "low":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Filter tickets
  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter !== "all" && ticket.status !== statusFilter) return false
    if (assigneeFilter === "unassigned" && ticket.assigneeUserId !== null) return false
    if (assigneeFilter !== "all" && assigneeFilter !== "unassigned" && ticket.assigneeUserId !== assigneeFilter) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchTickets}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-full bg-background">
      {/* Tickets List */}
      <div className={`border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto ${
        selectedTicket ? "hidden md:flex md:w-96" : "flex w-full md:w-96"
      } flex-col`}>
        <div className="p-4 border-b border-border space-y-4">
          <h2 className="text-lg font-semibold">Tickets</h2>
          
          {/* Filters */}
          <div className="space-y-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {canAssign && users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
                {currentUserId && (
                  <SelectItem value={currentUserId}>Me</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredTickets.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No tickets found
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className={`m-2 cursor-pointer hover:bg-accent transition-colors ${
                  selectedTicket?.id === ticket.id ? "bg-accent" : ""
                }`}
                onClick={() => setSelectedTicket(ticket)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm line-clamp-2 flex-1">
                      {ticket.subject}
                    </h3>
                    <div className="flex gap-1 flex-shrink-0">
                      <Badge className={`${getStatusColor(ticket.status)} text-white text-xs`}>
                        {ticket.status}
                      </Badge>
                      <Badge className={`${getPriorityColor(ticket.priority)} text-white text-xs`}>
                        {ticket.priority}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{ticket.customerEmail}</span>
                  </div>
                  {ticket.assigneeName && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>{ticket.assigneeName}</span>
                    </div>
                  )}
                  {!ticket.assigneeName && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="italic">Unassigned</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(ticket.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Ticket Detail */}
      <div className={`flex-1 overflow-y-auto ${selectedTicket ? "flex" : "hidden md:flex"}`}>
        {selectedTicket ? (
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">{selectedTicket.subject}</h1>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(selectedTicket.status)}>
                    {selectedTicket.status}
                  </Badge>
                  <Badge className={getPriorityColor(selectedTicket.priority)}>
                    {selectedTicket.priority}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Customer</span>
                  </div>
                  <p className="text-sm">{selectedTicket.customerEmail}</p>
                  {selectedTicket.customerName && (
                    <p className="text-sm text-muted-foreground">{selectedTicket.customerName}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Assignee</span>
                  </div>
                  {canAssign ? (
                    <Select
                      value={selectedTicket.assigneeUserId || "unassigned"}
                      onValueChange={(value) =>
                        handleAssign(selectedTicket.id, value === "unassigned" ? null : value)
                      }
                      disabled={assigning === selectedTicket.id}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">
                      {selectedTicket.assigneeName || "Unassigned"}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Last Customer Reply</span>
                  </div>
                  <p className="text-sm">{formatDate(selectedTicket.lastCustomerReplyAt)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Last Agent Reply</span>
                  </div>
                  <p className="text-sm">{formatDate(selectedTicket.lastAgentReplyAt)}</p>
                </CardContent>
              </Card>
            </div>

            {selectedTicket.tags.length > 0 && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTicket.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="text-sm text-muted-foreground">
              <p>Created: {formatDate(selectedTicket.createdAt)}</p>
              <p>Updated: {formatDate(selectedTicket.updatedAt)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full px-6 md:pl-48 py-10">
            <div className="text-center md:text-left space-y-4 max-w-md">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto md:mx-0">
                <Mail className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Select a ticket</h2>
                <p className="text-muted-foreground">
                  Choose a ticket from the list to view details and manage assignment.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

