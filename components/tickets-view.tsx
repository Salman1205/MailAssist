"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader2, User, Mail, Clock, Tag, MessageSquare, Sparkles, X, Plus } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

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

interface TicketNote {
  id: string
  ticketId: string
  userId: string
  userName: string
  content: string
  createdAt: string
  updatedAt: string
}

interface ThreadMessage {
  id: string
  subject: string
  from: string
  to: string
  body: string
  date?: string
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
  const [activeTab, setActiveTab] = useState<"assigned" | "unassigned" | "all">("assigned")
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  
  // Ticket detail state
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])
  const [notes, setNotes] = useState<TicketNote[]>([])
  const [replyText, setReplyText] = useState("")
  const [draftText, setDraftText] = useState("")
  const [showDraft, setShowDraft] = useState(false)
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [newTag, setNewTag] = useState("")
  
  // Updating states
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingPriority, setUpdatingPriority] = useState(false)
  const [updatingTags, setUpdatingTags] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [addingNote, setAddingNote] = useState(false)
  
  const { toast } = useToast()
  const canAssign = currentUserRole === "admin" || currentUserRole === "manager"

  useEffect(() => {
    fetchTickets()
    fetchUsers()
  }, [])

  useEffect(() => {
    if (selectedTicket) {
      fetchThread()
      fetchNotes()
    }
  }, [selectedTicket])

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
      setUsers(data.users || [])
    } catch (err) {
      console.error("Error fetching users:", err)
    }
  }

  const fetchThread = async () => {
    if (!selectedTicket) return
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/thread`)
      if (response.ok) {
        const data = await response.json()
        setThreadMessages(data.messages || [])
      }
    } catch (err) {
      console.error("Error fetching thread:", err)
    }
  }

  const fetchNotes = async () => {
    if (!selectedTicket) return
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/notes`)
      if (response.ok) {
        const data = await response.json()
        setNotes(data.notes || [])
      }
    } catch (err) {
      console.error("Error fetching notes:", err)
    }
  }

  const handleTakeTicket = async () => {
    if (!selectedTicket || !currentUserId) return
    await handleAssign(selectedTicket.id, currentUserId)
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
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? data.ticket : t)))
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(data.ticket)
      }
      toast({ title: "Ticket assigned successfully" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign ticket")
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to assign ticket", variant: "destructive" })
    } finally {
      setAssigning(null)
    }
  }

  const handleUpdateStatus = async (status: Ticket["status"]) => {
    if (!selectedTicket) return
    try {
      setUpdatingStatus(true)
      const response = await fetch(`/api/tickets/${selectedTicket.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) throw new Error("Failed to update status")
      const data = await response.json()
      setSelectedTicket(data.ticket)
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? data.ticket : t)))
      toast({ title: "Status updated" })
    } catch (err) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleUpdatePriority = async (priority: Ticket["priority"]) => {
    if (!selectedTicket) return
    try {
      setUpdatingPriority(true)
      const response = await fetch(`/api/tickets/${selectedTicket.id}/priority`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      })

      if (!response.ok) throw new Error("Failed to update priority")
      const data = await response.json()
      setSelectedTicket(data.ticket)
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? data.ticket : t)))
      toast({ title: "Priority updated" })
    } catch (err) {
      toast({ title: "Error", description: "Failed to update priority", variant: "destructive" })
    } finally {
      setUpdatingPriority(false)
    }
  }

  const handleAddTag = async () => {
    if (!selectedTicket || !newTag.trim()) return
    const updatedTags = [...selectedTicket.tags, newTag.trim()]
    await handleUpdateTags(updatedTags)
    setNewTag("")
  }

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedTicket) return
    const updatedTags = selectedTicket.tags.filter(t => t !== tagToRemove)
    await handleUpdateTags(updatedTags)
  }

  const handleUpdateTags = async (tags: string[]) => {
    if (!selectedTicket) return
    try {
      setUpdatingTags(true)
      const response = await fetch(`/api/tickets/${selectedTicket.id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      })

      if (!response.ok) throw new Error("Failed to update tags")
      const data = await response.json()
      setSelectedTicket(data.ticket)
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? data.ticket : t)))
      toast({ title: "Tags updated" })
    } catch (err) {
      toast({ title: "Error", description: "Failed to update tags", variant: "destructive" })
    } finally {
      setUpdatingTags(false)
    }
  }

  const handleAddNote = async () => {
    if (!selectedTicket || !newNote.trim()) return
    try {
      setAddingNote(true)
      const response = await fetch(`/api/tickets/${selectedTicket.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote.trim() }),
      })

      if (!response.ok) throw new Error("Failed to add note")
      const data = await response.json()
      setNotes((prev) => [data.note, ...prev])
      setNewNote("")
      toast({ title: "Note added" })
    } catch (err) {
      toast({ title: "Error", description: "Failed to add note", variant: "destructive" })
    } finally {
      setAddingNote(false)
    }
  }

  const handleGenerateDraft = async () => {
    if (!selectedTicket || !threadMessages.length) return
    try {
      setGeneratingDraft(true)
      // Use the first message ID from thread as the email ID for draft generation
      const emailId = threadMessages[0].id
      const response = await fetch(`/api/emails/${emailId}/draft`, {
        method: "POST"
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate draft")
      }

      const data = await response.json()
      setDraftText(data.draft || "")
      setShowDraft(true)
      setReplyText(data.draft || "")
      toast({ title: "Draft generated" })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate draft", variant: "destructive" })
    } finally {
      setGeneratingDraft(false)
    }
  }

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim() || !threadMessages.length) return
    try {
      setSendingReply(true)
      // Use the first message ID from thread (the original email) to send reply
      const emailId = threadMessages[0].id
      const response = await fetch(`/api/emails/${emailId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftText: replyText.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to send reply")
      }

      setReplyText("")
      setDraftText("")
      setShowDraft(false)
      await fetchThread()
      await fetchTickets()
      toast({ title: "Reply sent successfully" })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to send reply", variant: "destructive" })
    } finally {
      setSendingReply(false)
    }
  }

  const getStatusColor = (status: Ticket["status"]) => {
    switch (status) {
      case "open": return "bg-blue-500"
      case "pending": return "bg-yellow-500"
      case "on_hold": return "bg-orange-500"
      case "closed": return "bg-gray-500"
      default: return "bg-gray-500"
    }
  }

  const getPriorityColor = (priority: Ticket["priority"]) => {
    switch (priority) {
      case "urgent": return "bg-red-500"
      case "high": return "bg-orange-500"
      case "medium": return "bg-yellow-500"
      case "low": return "bg-green-500"
      default: return "bg-gray-500"
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Filter and sort tickets based on active tab and filters
  const getFilteredTickets = () => {
    let filtered = [...tickets]

    // Tab-based filtering
    if (activeTab === "assigned") {
      filtered = filtered.filter(t => t.assigneeUserId === currentUserId)
    } else if (activeTab === "unassigned") {
      filtered = filtered.filter(t => t.assigneeUserId === null)
    }
    // "all" tab shows all tickets (no filter)

    // Apply other filters
    if (statusFilter !== "all") {
      filtered = filtered.filter(t => t.status === statusFilter)
    }
    if (priorityFilter !== "all") {
      filtered = filtered.filter(t => t.priority === priorityFilter)
    }
    if (assigneeFilter === "unassigned") {
      filtered = filtered.filter(t => t.assigneeUserId === null)
    } else if (assigneeFilter !== "all") {
      filtered = filtered.filter(t => t.assigneeUserId === assigneeFilter)
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t => 
        t.subject.toLowerCase().includes(query) ||
        t.customerEmail.toLowerCase().includes(query) ||
        (t.customerName && t.customerName.toLowerCase().includes(query))
      )
    }

    // Sort by last_customer_reply_at (oldest first, nulls last)
    filtered.sort((a, b) => {
      const aDate = a.lastCustomerReplyAt ? new Date(a.lastCustomerReplyAt).getTime() : Infinity
      const bDate = b.lastCustomerReplyAt ? new Date(b.lastCustomerReplyAt).getTime() : Infinity
      return aDate - bDate
    })

    return filtered
  }

  const filteredTickets = getFilteredTickets()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !tickets.length) {
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
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
              <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
              <TabsTrigger value="all">All Tickets</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <Input
            placeholder="Search by subject or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          {/* Filters */}
          <div className="space-y-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map((user) => (
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
                  {ticket.assigneeName ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>{ticket.assigneeName}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="italic">Unassigned</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(ticket.lastCustomerReplyAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Ticket Detail */}
      <div className={`flex-1 overflow-y-auto ${selectedTicket ? "flex flex-col" : "hidden md:flex"}`}>
        {selectedTicket ? (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-border space-y-4 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <h1 className="text-2xl font-bold">{selectedTicket.subject}</h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={getStatusColor(selectedTicket.status)}>
                      {selectedTicket.status}
                    </Badge>
                    <Badge className={getPriorityColor(selectedTicket.priority)}>
                      {selectedTicket.priority}
                    </Badge>
                    {selectedTicket.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                  Close
                </Button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {!canAssign && !selectedTicket.assigneeUserId && (
                  <Button size="sm" onClick={handleTakeTicket} disabled={assigning === selectedTicket.id}>
                    {assigning === selectedTicket.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Take Ticket"}
                  </Button>
                )}
                {canAssign && (
                  <Select
                    value={selectedTicket.assigneeUserId || "unassigned"}
                    onValueChange={(value) => handleAssign(selectedTicket.id, value === "unassigned" ? null : value)}
                    disabled={assigning === selectedTicket.id}
                  >
                    <SelectTrigger className="w-48">
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
                )}
                <Select
                  value={selectedTicket.status}
                  onValueChange={(v) => handleUpdateStatus(v as Ticket["status"])}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedTicket.priority}
                  onValueChange={(v) => handleUpdatePriority(v as Ticket["priority"])}
                  disabled={updatingPriority}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tags Editor */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">Tags:</span>
                {selectedTicket.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="gap-1">
                    {tag}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    className="h-7 w-32"
                  />
                  <Button size="sm" onClick={handleAddTag} disabled={!newTag.trim() || updatingTags}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Customer Info */}
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
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Last customer reply: {formatDate(selectedTicket.lastCustomerReplyAt)}</p>
                    <p>Last agent reply: {formatDate(selectedTicket.lastAgentReplyAt)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Conversation Thread */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Conversation
                  </h3>
                  <div className="space-y-4">
                    {threadMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Loading conversation...</p>
                    ) : (
                      threadMessages.map((msg, idx) => (
                        <div key={idx} className="border-l-2 border-border pl-4 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{msg.from}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(msg.date)}</span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap">{msg.body || msg.subject}</div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Internal Notes */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Internal Notes</h3>
                  <div className="space-y-3 mb-4">
                    {notes.map((note) => (
                      <div key={note.id} className="border-l-2 border-primary pl-4 py-2 bg-muted/50 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{note.userName}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add internal note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="min-h-20"
                    />
                    <Button onClick={handleAddNote} disabled={!newNote.trim() || addingNote}>
                      {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Reply Box */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Reply</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateDraft}
                      disabled={generatingDraft || !threadMessages.length}
                    >
                      {generatingDraft ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate AI Draft
                        </>
                      )}
                    </Button>
                  </div>
                  {showDraft && draftText && (
                    <div className="mb-4 p-3 bg-muted rounded border border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">AI Draft</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowDraft(false)
                            setDraftText("")
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{draftText}</p>
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setReplyText(draftText)
                          setShowDraft(false)
                        }}
                      >
                        Use This Draft
                      </Button>
                    </div>
                  )}
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="min-h-32 mb-4"
                  />
                  <Button onClick={handleSendReply} disabled={!replyText.trim() || sendingReply}>
                    {sendingReply ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Sending...
                      </>
                    ) : (
                      "Send Reply"
                    )}
                  </Button>
                </CardContent>
              </Card>
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
                  Choose a ticket from the list to view details, manage assignment, and reply.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

