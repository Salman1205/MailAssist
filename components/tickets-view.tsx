"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Loader2, User, Mail, Clock, Tag, MessageSquare, Sparkles, X, Plus, ChevronDown, ChevronUp, Edit2, Check, XCircle, MoreVertical, Filter, ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useToast } from "@/components/ui/use-toast"
import { supabaseBrowser } from "@/lib/supabase-client"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface Ticket {
  id: string
  threadId: string
  customerEmail: string
  customerName?: string | null
  subject: string
  status: "open" | "pending" | "on_hold" | "closed"
  priority?: "low" | "medium" | "high" | "urgent" | null
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

interface QuickReply {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
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
  const [activeTab, setActiveTab] = useState<"assigned" | "unassigned" | "all">("unassigned")
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all")
  const [tagsFilter, setTagsFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all") // "all", "today", "week", "month", "custom"
  const [customDateStart, setCustomDateStart] = useState<string>("")
  const [customDateEnd, setCustomDateEnd] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")
  
  // Typing indicator state
  const [isTyping, setIsTyping] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  
  // Ticket detail state
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [notes, setNotes] = useState<TicketNote[]>([])
  const [replyText, setReplyText] = useState("")
  const [draftText, setDraftText] = useState("")
  const [showDraft, setShowDraft] = useState(false)
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState("")
  const [newTag, setNewTag] = useState("")
  const [assignPriority, setAssignPriority] = useState<string>("medium")
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [pendingAssignment, setPendingAssignment] = useState<{ticketId: string, assigneeUserId: string | null} | null>(null)
  const [conversationMinimized, setConversationMinimized] = useState(false)
  const [showQuotedMap, setShowQuotedMap] = useState<Record<string, boolean>>({})
  // Track last time each ticket was viewed (from Supabase) so we can show "new" badges
  const [lastViewedMap, setLastViewedMap] = useState<Record<string, string>>({})
  // Track previous selected ticket metadata for polling comparison
  const prevSelectedIdRef = useRef<string | null>(null)
  const prevSelectedCustomerReplyRef = useRef<string | null>(null)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  
  // Multi-select state
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  
  // Filters collapse state - collapsed by default
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  
  // Quick replies state
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  
  // Panel width preferences - load from localStorage
  const getInitialPanelSizes = (): number[] => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ticket-panel-widths')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // Convert from {list, detail} format to array format [list, detail]
          if (parsed.list && parsed.detail) {
            return [parsed.list, parsed.detail]
          }
        } catch {
          // ignore
        }
      }
    }
    return [40, 60] // Default: 40% list, 60% detail
  }
  
  const [panelSizes, setPanelSizes] = useState<number[]>(getInitialPanelSizes)
  const panelInitializedRef = useRef(false)
  
  // Auto-filter closed tickets
  const [autoFilterClosed, setAutoFilterClosed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('auto-filter-closed')
      return saved === 'true'
    }
    return false
  })
  
  // Updating states
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingPriority, setUpdatingPriority] = useState(false)
  const [updatingTags, setUpdatingTags] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [addingNote, setAddingNote] = useState(false)
  
  const { toast } = useToast()
  const canAssign = currentUserRole === "admin" || currentUserRole === "manager"
  
  // Save panel sizes to localStorage when they change (debounced)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const handlePanelResize = (sizes: number[]) => {
    // Only update if sizes actually changed (avoid unnecessary re-renders)
    if (sizes.length === 2 && (sizes[0] !== panelSizes[0] || sizes[1] !== panelSizes[1])) {
      setPanelSizes(sizes)
      panelInitializedRef.current = true
      
      // Debounce localStorage writes to avoid excessive writes
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      resizeTimeoutRef.current = setTimeout(() => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ticket-panel-widths', JSON.stringify({ list: sizes[0], detail: sizes[1] }))
        }
      }, 300)
    }
  }
  
  // Handle individual panel resize
  const handleListPanelResize = (size: number) => {
    const newSizes = [size, 100 - size]
    handlePanelResize(newSizes)
  }
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])
  
  // Save auto-filter preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auto-filter-closed', String(autoFilterClosed))
    }
  }, [autoFilterClosed])

  useEffect(() => {
    fetchTickets()
    fetchUsers()
    fetchTicketViews()
    fetchQuickReplies()
  }, [])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to toggle select mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsSelectMode(!isSelectMode)
        if (isSelectMode) {
          setSelectedTicketIds(new Set())
        }
      }
      // Ctrl+A to select all when in select mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && isSelectMode) {
        e.preventDefault()
        const allIds = new Set(filteredTickets.map(t => t.id))
        setSelectedTicketIds(allIds)
      }
      // Escape to exit select mode
      if (e.key === 'Escape' && isSelectMode) {
        setIsSelectMode(false)
        setSelectedTicketIds(new Set())
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelectMode, tickets, activeTab, statusFilter, priorityFilter, assigneeFilter, tagsFilter, dateFilter, searchQuery, showUnreadOnly])
  
  const fetchQuickReplies = async () => {
    try {
      const response = await fetch("/api/quick-replies")
      if (response.ok) {
        const data = await response.json()
        setQuickReplies(data.quickReplies || [])
      }
    } catch (err) {
      console.error("Error fetching quick replies:", err)
    }
  }

  // Supabase realtime for ticket_updates
  useEffect(() => {
    if (!supabaseBrowser) return
    const channel = supabaseBrowser!
      .channel("ticket-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_updates" },
        async (payload) => {
          const ticketId = (payload.new as any)?.ticket_id as string | undefined
          if (!ticketId) return
          await fetchTickets({ silent: true })

          if (selectedTicket?.id === ticketId) {
            try {
              const res = await fetch(`/api/tickets/${ticketId}`)
              if (res.ok) {
                const data = await res.json().catch(() => null)
                if (data?.ticket) {
                  setSelectedTicket(data.ticket)
                  prevSelectedCustomerReplyRef.current = data.ticket.lastCustomerReplyAt || null
                  await markTicketViewed(data.ticket, data.ticket.lastCustomerReplyAt || undefined)
                }
              }
              await fetchThread({ silent: true })
            } catch {
              // ignore
            }
          }
        }
      )
      .subscribe()

    return () => {
      if (supabaseBrowser) {
        supabaseBrowser.removeChannel(channel)
      }
    }
  }, [selectedTicket])

  const fetchTicketViews = async () => {
    try {
      const response = await fetch("/api/tickets/viewed")
      if (!response.ok) return
      const data = await response.json()
      setLastViewedMap(data.views || {})
    } catch {
      // ignore storage errors
    }
  }

  const markTicketViewed = async (ticket: Ticket, explicitStamp?: string) => {
    const stamp = explicitStamp || ticket.lastCustomerReplyAt || new Date().toISOString()
    setLastViewedMap((prev) => ({ ...prev, [ticket.id]: stamp }))
    try {
      await fetch(`/api/tickets/${ticket.id}/viewed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastViewedAt: stamp }),
      })
    } catch {
      // ignore storage errors
    }
  }

  const hasNewCustomerReply = (ticket: Ticket) => {
    if (!ticket.lastCustomerReplyAt) return false
    const lastSeen = lastViewedMap[ticket.id]
    if (!lastSeen) return true
    return new Date(ticket.lastCustomerReplyAt) > new Date(lastSeen)
  }

  // Light polling only for the currently selected ticket (once per minute) to react
  // when a new customer email arrives. No global refresh spam.
  useEffect(() => {
    if (!selectedTicket) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tickets/${selectedTicket.id}`)
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        const updated: Ticket | undefined = data?.ticket
        if (!updated) return

        const prevReply = prevSelectedCustomerReplyRef.current
        const currentReply = updated.lastCustomerReplyAt || null

        if (currentReply && (!prevReply || new Date(currentReply) > new Date(prevReply))) {
          toast({
            title: "New customer reply",
            description: updated.subject,
          })
          setSelectedTicket(updated)
          prevSelectedCustomerReplyRef.current = currentReply
          await fetchThread({ silent: true })
          await markTicketViewed(updated, currentReply)
          await fetchTickets({ silent: true })
        }
      } catch {
        // ignore transient errors
      }
    }, 60000) // 1 minute

    return () => clearInterval(interval)
  }, [selectedTicket])

  // Track selected ticket changes for comparison
  useEffect(() => {
    if (selectedTicket) {
      prevSelectedIdRef.current = selectedTicket.id
      prevSelectedCustomerReplyRef.current = selectedTicket.lastCustomerReplyAt || null
    }
  }, [selectedTicket])

  const fetchTypingIndicator = async () => {
    if (!selectedTicket) return
    try {
      const response = await fetch(`/api/tickets/${selectedTicket.id}/typing`, {
        method: 'GET',
        credentials: 'include',
      }).catch((networkError) => {
        // Network error - silently fail (typing indicator is not critical)
        return null
      })
      
      if (response && response.ok) {
        const data = await response.json()
        const typingUserIds = data.typingUsers || []
        // Always log to debug
        if (typingUserIds.length > 0) {
          console.log('[Typing Indicator] Setting typing users:', typingUserIds, 'Current state:', typingUsers)
        }
        setTypingUsers(prev => {
          // Only update if different to avoid unnecessary re-renders
          if (JSON.stringify(prev.sort()) !== JSON.stringify(typingUserIds.sort())) {
            console.log('[Typing Indicator] State changed from', prev, 'to', typingUserIds)
            return typingUserIds
          }
          return prev
        })
      }
    } catch (err) {
      // Silently fail - typing indicator is not critical
    }
  }

  useEffect(() => {
    if (selectedTicket) {
      fetchThread()
      fetchNotes()
      // Start polling for typing indicators when ticket is selected
      fetchTypingIndicator() // Fetch immediately
      const typingInterval = setInterval(() => {
        fetchTypingIndicator()
      }, 2000) // Poll every 2 seconds
      
      return () => clearInterval(typingInterval)
    } else {
      setTypingUsers([]) // Clear when no ticket selected
    }
  }, [selectedTicket, users]) // Add users as dependency so we can match names
  
  const updateTypingStatus = async (typing: boolean) => {
    if (!selectedTicket || !currentUserId) return
    try {
      await fetch(`/api/tickets/${selectedTicket.id}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing }),
      })
    } catch {
      // Silently fail - typing indicator is not critical
    }
  }
  
  const handleTyping = () => {
    if (!selectedTicket || !currentUserId) return
    
    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }
    
    // Set typing status
    setIsTyping(true)
    updateTypingStatus(true)
    
    // Clear typing status after 3 seconds of inactivity
    const timeout = setTimeout(() => {
      setIsTyping(false)
      updateTypingStatus(false)
    }, 3000)
    
    setTypingTimeout(timeout)
  }
  
  // Cleanup typing status on unmount or ticket change
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }
      if (selectedTicket && currentUserId) {
        updateTypingStatus(false)
      }
    }
  }, [selectedTicket, currentUserId])

  const fetchTickets = async (options?: { silent?: boolean, returnData?: boolean }) => {
    const { silent = false, returnData = false } = options || {}
    try {
      if (!silent) setLoading(true)
      setError(null)
      console.log('[Tickets] Fetching tickets...')
      const response = await fetch("/api/tickets")
      if (!response.ok) {
        throw new Error("Failed to fetch tickets")
      }
      const data = await response.json()
      console.log('[Tickets] Received tickets:', data.tickets?.length || 0)
      if (data.tickets && data.tickets.length > 0) {
        console.log('[Tickets] Sample ticket dates:', data.tickets.slice(0, 3).map((t: Ticket) => ({
          id: t.id,
          subject: t.subject,
          lastCustomerReplyAt: t.lastCustomerReplyAt,
          createdAt: t.createdAt,
          date: t.lastCustomerReplyAt || t.createdAt
        })))
      }
      const list = data.tickets || []
      setTickets(list)
      if (returnData) return list
    } catch (err) {
      console.error('[Tickets] Error fetching tickets:', err)
      setError(err instanceof Error ? err.message : "Failed to load tickets")
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users", {
        method: 'GET',
        credentials: 'include',
      }).catch((networkError) => {
        // Network error - return null to indicate failure
        console.warn("Network error fetching users:", networkError)
        return null
      })
      
      if (response && response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error("Error fetching users:", err)
    }
  }

  const fetchThread = async (options?: { silent?: boolean }) => {
    const { silent = false } = options || {}
    if (!selectedTicket) return
    try {
      if (!silent) setLoadingThread(true)
      const response = await fetch(`/api/tickets/${selectedTicket.id}/thread`)
      if (response.ok) {
        const data = await response.json()
        setThreadMessages(data.messages || [])
      }
    } catch (err) {
      console.error("Error fetching thread:", err)
    } finally {
      if (!silent) setLoadingThread(false)
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
    
    // If ticket is unassigned, require priority selection
    if (!selectedTicket.assigneeUserId) {
      setPendingAssignment({ ticketId: selectedTicket.id, assigneeUserId: currentUserId })
      setShowAssignDialog(true)
      return
    }
    
    await handleAssign(selectedTicket.id, currentUserId)
  }

  const handleAssign = async (ticketId: string, assigneeUserId: string | null, priority?: string) => {
    try {
      setAssigning(ticketId)
      console.log('[Assign Ticket] Starting assignment:', { ticketId, assigneeUserId, priority })
      
      // If assigning and priority is provided, update priority first
      if (assigneeUserId && priority) {
        console.log('[Assign Ticket] Setting priority:', priority)
        const priorityResponse = await fetch(`/api/tickets/${ticketId}/priority`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority }),
        })
        if (!priorityResponse.ok) {
          const errorData = await priorityResponse.json().catch(() => ({}))
          console.error('[Assign Ticket] Priority update failed:', errorData)
          throw new Error(errorData.error || "Failed to set priority")
        }
        console.log('[Assign Ticket] Priority set successfully')
      }
      
      console.log('[Assign Ticket] Assigning ticket to:', assigneeUserId)
      const response = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeUserId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Assign Ticket] Assignment failed:', errorData)
        throw new Error(errorData.error || "Failed to assign ticket")
      }
      
      console.log('[Assign Ticket] Assignment successful')

      const data = await response.json()
      
      // Update tickets list
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? data.ticket : t)))
      
      // Update selected ticket if it's the one being assigned
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(data.ticket)
      }
      
      // Close dialog and clear pending assignment BEFORE showing toast
      setShowAssignDialog(false)
      setPendingAssignment(null)
      
      toast({ title: "Ticket assigned successfully" })
      
      // Refresh tickets to ensure UI is up to date
      await fetchTickets()
    } catch (err) {
      console.error('[Assign Ticket] Error:', err)
      setError(err instanceof Error ? err.message : "Failed to assign ticket")
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to assign ticket", 
        variant: "destructive" 
      })
      // Don't close dialog on error so user can retry
    } finally {
      setAssigning(null)
    }
  }

  const handleConfirmAssign = async () => {
    if (!pendingAssignment) return
    console.log('[Assign Ticket] Starting assignment:', {
      ticketId: pendingAssignment.ticketId,
      assigneeUserId: pendingAssignment.assigneeUserId,
      priority: assignPriority
    })
    try {
      await handleAssign(pendingAssignment.ticketId, pendingAssignment.assigneeUserId, assignPriority)
    } catch (err) {
      console.error('[Assign Ticket] Error in handleConfirmAssign:', err)
    }
  }

  const handleUpdateStatus = async (status: Ticket["status"], ticketId?: string) => {
    const targetTicketId = ticketId || selectedTicket?.id
    if (!targetTicketId) return
    
    try {
      setUpdatingStatus(true)
      const response = await fetch(`/api/tickets/${targetTicketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) throw new Error("Failed to update status")
      const data = await response.json()
      
      // Update selected ticket if it's the one being updated
      if (selectedTicket?.id === targetTicketId) {
        setSelectedTicket(data.ticket)
        
        // Auto-navigate to next ticket if closing
        if (status === "closed") {
          // Wait for tickets to refresh before finding next ticket
          await fetchTickets({ silent: true })
          const refreshedFiltered = getFilteredTickets()
          const currentIndex = refreshedFiltered.findIndex(t => t.id === targetTicketId)
          const nextTicket = refreshedFiltered[currentIndex + 1] || refreshedFiltered[0]
          
          if (nextTicket && nextTicket.id !== targetTicketId) {
            setSelectedTicket(nextTicket)
            markTicketViewed(nextTicket)
          } else {
            // No more tickets, clear selection
            setSelectedTicket(null)
            toast({ title: "No more tickets", description: "All tickets in this view have been processed." })
          }
        }
      }
      
      setTickets((prev) => prev.map((t) => (t.id === targetTicketId ? data.ticket : t)))
      toast({ title: "Status updated" })
      
      // Refresh tickets to update counts
      await fetchTickets({ silent: true })
    } catch (err) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    } finally {
      setUpdatingStatus(false)
    }
  }
  
  const handleBulkUpdate = async (updates: { status?: Ticket["status"], assigneeUserId?: string | null, tags?: string[] }) => {
    if (selectedTicketIds.size === 0) return
    
    try {
      setBulkUpdating(true)
      const response = await fetch("/api/tickets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketIds: Array.from(selectedTicketIds),
          ...updates,
        }),
      })
      
      if (!response.ok) throw new Error("Failed to update tickets")
      const data = await response.json()
      
      // Update tickets in state
      const updatedMap = new Map(data.results.map((r: any) => [r.ticketId, r.ticket as Ticket]))
      setTickets((prev) => prev.map((t) => (updatedMap.get(t.id) as Ticket) || t))
      
      // Clear selection
      setSelectedTicketIds(new Set())
      setIsSelectMode(false)
      
      // If closing tickets, auto-filter them out if preference is set
      if (updates.status === "closed" && autoFilterClosed) {
        setStatusFilter("open")
      }
      
      toast({ 
        title: "Bulk update successful", 
        description: `Updated ${data.updated} ticket(s)` 
      })
      
      await fetchTickets({ silent: true })
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to update tickets", 
        variant: "destructive" 
      })
    } finally {
      setBulkUpdating(false)
    }
  }
  
  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev)
      if (next.has(ticketId)) {
        next.delete(ticketId)
      } else {
        next.add(ticketId)
      }
      return next
    })
  }
  
  const toggleSelectAll = () => {
    if (selectedTicketIds.size === filteredTickets.length) {
      setSelectedTicketIds(new Set())
    } else {
      setSelectedTicketIds(new Set(filteredTickets.map(t => t.id)))
    }
  }
  
  const insertQuickReply = (content: string) => {
    setReplyText(content)
    setShowQuickReplies(false)
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

  const handleStartEditNote = (note: TicketNote) => {
    setEditingNoteId(note.id)
    setEditingNoteContent(note.content)
  }

  const handleCancelEditNote = () => {
    setEditingNoteId(null)
    setEditingNoteContent("")
  }

  const handleUpdateNote = async () => {
    if (!selectedTicket || !editingNoteId || !editingNoteContent.trim()) {
      console.error('[Update Note] Missing required data:', { selectedTicket: !!selectedTicket, editingNoteId, editingNoteContent })
      return
    }
    
    // Find the note being edited to compare user IDs
    const noteBeingEdited = notes.find(n => n.id === editingNoteId)
    console.log('[Update Note] Frontend check:', {
      currentUserId,
      noteUserId: noteBeingEdited?.userId,
      match: currentUserId === noteBeingEdited?.userId,
      noteId: editingNoteId
    })
    
    try {
      setAddingNote(true)
      console.log('[Update Note] Sending request:', { ticketId: selectedTicket.id, noteId: editingNoteId, content: editingNoteContent.trim() })
      const response = await fetch(`/api/tickets/${selectedTicket.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          noteId: editingNoteId,
          content: editingNoteContent.trim() 
        }),
      })

      console.log('[Update Note] Response status:', response.status)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Update Note] Error response:', errorData)
        throw new Error(errorData.error || "Failed to update note")
      }
      const data = await response.json()
      console.log('[Update Note] Success, updating state:', data)
      setNotes((prev) => {
        const updated = prev.map(note => note.id === editingNoteId ? data.note : note)
        console.log('[Update Note] Updated notes array:', updated)
        return updated
      })
      setEditingNoteId(null)
      setEditingNoteContent("")
      toast({ title: "Note updated" })
    } catch (err) {
      console.error('[Update Note] Exception:', err)
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to update note", 
        variant: "destructive" 
      })
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
      // Don't set replyText here - let user click "Use This Draft" to copy it
      toast({ title: "Draft generated" })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to generate draft", variant: "destructive" })
    } finally {
      setGeneratingDraft(false)
    }
  }

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim() || !threadMessages.length) return
    
    // Clear typing status when sending
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }
    setIsTyping(false)
    updateTypingStatus(false)
    
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

  const getMessageKey = (msg: any, idx: number) =>
    msg.id || `${msg.from}-${msg.date}-${idx}`

  const splitBody = (body?: string) => {
    const lines = (body || "").split("\n")
    const main: string[] = []
    const quoted: string[] = []
    let inQuote = false
    lines.forEach(line => {
      const isQuote = line.trim().startsWith(">")
      if (isQuote) inQuote = true
      if (inQuote) quoted.push(line)
      else main.push(line)
    })
    return { main, quoted }
  }

  const getInitials = (from: string) => {
    const namePart = from?.split("<")[0].trim() || from
    const pieces = namePart.split(/\s+/).filter(Boolean)
    if (pieces.length === 0) return "?"
    const initials = pieces.slice(0, 2).map(p => p[0]).join("")
    return initials.toUpperCase()
  }

  // Filter and sort tickets based on active tab and filters
  const getFilteredTickets = () => {
    let filtered = [...tickets]
    console.log('[Filter] Starting with', filtered.length, 'tickets')

    // Tab-based filtering
    console.log('[Filter] After tab filter (' + activeTab + '):', filtered.length)
    if (activeTab === "assigned") {
      filtered = filtered.filter(t => t.assigneeUserId === currentUserId)
      console.log('[Filter] Assigned filter:', filtered.length)
    } else if (activeTab === "unassigned") {
      filtered = filtered.filter(t => t.assigneeUserId === null)
      console.log('[Filter] Unassigned filter:', filtered.length)
    }
    // "all" tab shows all tickets (no filter)

    // Auto-filter closed tickets if preference is set
    if (autoFilterClosed && statusFilter === "all") {
      filtered = filtered.filter(t => t.status !== "closed")
    }
    
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
    
    // Tags filter - support multiple tags (comma-separated)
    if (tagsFilter !== "all") {
      const selectedTags = tagsFilter.split(',').map(t => t.trim()).filter(Boolean)
      if (selectedTags.length > 0) {
        filtered = filtered.filter(t => selectedTags.some(tag => t.tags.includes(tag)))
      }
    }
    
    // Date filter
    if (dateFilter !== "all") {
      console.log('[Filter] Before date filter:', filtered.length, 'dateFilter:', dateFilter)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)
      
      filtered = filtered.filter(t => {
        // Use lastCustomerReplyAt if available, otherwise use createdAt
        const ticketDateStr = t.lastCustomerReplyAt || t.createdAt
        if (!ticketDateStr) return false
        
        const ticketDate = new Date(ticketDateStr)
        
        if (dateFilter === "today") {
          // Simple date comparison - get date strings in YYYY-MM-DD format
          const ticketYear = ticketDate.getFullYear()
          const ticketMonth = ticketDate.getMonth()
          const ticketDay = ticketDate.getDate()
          
          const todayYear = now.getFullYear()
          const todayMonth = now.getMonth()
          const todayDay = now.getDate()
          
          const isToday = ticketYear === todayYear && 
                         ticketMonth === todayMonth && 
                         ticketDay === todayDay
          
          if (!isToday) {
            console.log('[Date Filter] Ticket not matching today:', {
              ticket: {
                id: t.id,
                subject: t.subject,
                dateStr: ticketDateStr,
                year: ticketYear,
                month: ticketMonth,
                day: ticketDay,
                fullDate: ticketDate.toISOString()
              },
              today: {
                year: todayYear,
                month: todayMonth,
                day: todayDay,
                fullDate: now.toISOString()
              }
            })
          }
          
          return isToday
        } else if (dateFilter === "week") {
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 7)
          weekAgo.setHours(0, 0, 0, 0)
          return ticketDate >= weekAgo
        } else if (dateFilter === "month") {
          const monthAgo = new Date(today)
          monthAgo.setMonth(monthAgo.getMonth() - 1)
          monthAgo.setHours(0, 0, 0, 0)
          return ticketDate >= monthAgo
        } else if (dateFilter === "custom") {
          if (!customDateStart || !customDateEnd) return true
          const start = new Date(customDateStart)
          start.setHours(0, 0, 0, 0)
          const end = new Date(customDateEnd)
          end.setHours(23, 59, 59, 999)
          return ticketDate >= start && ticketDate <= end
        }
        return true
      })
      console.log('[Filter] After date filter:', filtered.length)
    }

    // Unread filter
    if (showUnreadOnly) {
      filtered = filtered.filter(t => hasNewCustomerReply(t))
    }

    // Sort by last_customer_reply_at (oldest first, nulls last)
    // Tickets that have been waiting longest (oldest last_customer_reply_at) are at the top
    // When a customer replies, last_customer_reply_at updates to now, moving ticket down
    filtered.sort((a, b) => {
      const aDate = a.lastCustomerReplyAt ? new Date(a.lastCustomerReplyAt).getTime() : Infinity
      const bDate = b.lastCustomerReplyAt ? new Date(b.lastCustomerReplyAt).getTime() : Infinity
      return aDate - bDate // Ascending: oldest first
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
          <Button onClick={() => fetchTickets()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-background">
      <ResizablePanelGroup 
        direction="horizontal" 
        className="h-full w-full"
        onLayout={handlePanelResize}
      >
        {/* Tickets List */}
        <ResizablePanel 
          defaultSize={panelSizes[0]} 
          minSize={25}
          maxSize={60}
          onResize={handleListPanelResize}
          className="flex flex-col border-r border-border bg-card overflow-hidden"
        >
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-border space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tickets</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSelectMode(!isSelectMode)
                  if (isSelectMode) {
                    setSelectedTicketIds(new Set())
                  }
                }}
                className="h-7 text-xs"
              >
                {isSelectMode ? "Cancel" : "Select"}
              </Button>
            </div>
          </div>
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-3 h-8 text-xs">
              <TabsTrigger value="assigned">Assigned</TabsTrigger>
              <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <Input
            placeholder="Search by subject or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
          />
          
          {/* Collapsible Filters */}
          <Accordion type="single" collapsible value={filtersExpanded ? "filters" : undefined}>
            <AccordionItem value="filters" className="border-none">
              <AccordionTrigger 
                className="py-1 h-7 text-xs text-muted-foreground hover:no-underline"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
              >
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3 h-3" />
                  <span>Filters</span>
                  {(statusFilter !== "all" || priorityFilter !== "all" || assigneeFilter !== "all" || tagsFilter !== "all" || dateFilter !== "all" || showUnreadOnly) && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">Active</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-1">
                <div className="space-y-2">
                  {/* Compact Filters Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] text-muted-foreground">Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] text-muted-foreground">Priority</Label>
                      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] text-muted-foreground">Assignee</Label>
                      <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
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

                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] text-muted-foreground">Tags</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-7 text-xs justify-between">
                            {tagsFilter === "all" ? "All Tags" : tagsFilter.split(',').length === 1 ? tagsFilter : `${tagsFilter.split(',').length} tags`}
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold">Filter by Tags</Label>
                              {tagsFilter !== "all" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => setTagsFilter("all")}
                                >
                                  Clear
                                </Button>
                              )}
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-1">
                              {Array.from(new Set(tickets.flatMap(t => t.tags)))
                                .map(tag => ({
                                  tag,
                                  count: tickets.filter(t => t.tags.includes(tag)).length
                                }))
                                .sort((a, b) => b.count - a.count)
                                .map(({ tag, count }) => {
                                  const selectedTags = tagsFilter === "all" ? [] : tagsFilter.split(',').map(t => t.trim())
                                  const isSelected = selectedTags.includes(tag)
                                  return (
                                    <div
                                      key={tag}
                                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                                      onClick={() => {
                                        if (isSelected) {
                                          const newTags = selectedTags.filter(t => t !== tag)
                                          setTagsFilter(newTags.length === 0 ? "all" : newTags.join(','))
                                        } else {
                                          const newTags = tagsFilter === "all" ? [tag] : [...selectedTags, tag]
                                          setTagsFilter(newTags.join(','))
                                        }
                                      }}
                                    >
                                      <Checkbox checked={isSelected} />
                                      <span className="text-xs flex-1">{tag}</span>
                                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">{count}</Badge>
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] text-muted-foreground">Date</Label>
                      <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">7 Days</SelectItem>
                          <SelectItem value="month">30 Days</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1 justify-end">
                      <div className="flex items-center gap-1.5 h-7">
                        <Switch 
                          checked={showUnreadOnly} 
                          onCheckedChange={setShowUnreadOnly}
                          className="scale-75"
                        />
                        <Label className="text-[10px] text-muted-foreground">Unread only</Label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-1">
                    <Switch 
                      checked={autoFilterClosed} 
                      onCheckedChange={setAutoFilterClosed}
                      className="scale-75"
                    />
                    <Label className="text-[10px] text-muted-foreground">Auto-hide closed tickets</Label>
                  </div>
                  
                  {/* Custom Date Range Inputs */}
                  {dateFilter === "custom" && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Input
                        type="date"
                        placeholder="Start Date"
                        value={customDateStart}
                        onChange={(e) => setCustomDateStart(e.target.value)}
                        className="h-7 text-xs"
                      />
                      <Input
                        type="date"
                        placeholder="End Date"
                        value={customDateEnd}
                        onChange={(e) => setCustomDateEnd(e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
            </div>

        {/* Bulk Actions Bar */}
        {isSelectMode && selectedTicketIds.size > 0 && (
          <div className="px-3 py-2 border-b border-border bg-muted/50 flex items-center justify-between flex-shrink-0">
            <span className="text-sm text-muted-foreground">
              {selectedTicketIds.size} ticket{selectedTicketIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkUpdate({ status: "closed" })}
                disabled={bulkUpdating}
                className="h-7 text-xs"
              >
                Close Selected
              </Button>
              {/* Allow all users to bulk assign */}
              <Select
                onValueChange={(userId) => handleBulkUpdate({ assigneeUserId: userId === "unassigned" ? null : userId })}
                disabled={bulkUpdating}
              >
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue placeholder="Assign..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassign</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredTickets.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground space-y-2 animate-in fade-in duration-300">
              <p className="text-sm">No tickets found</p>
              {tickets.length > 0 && (
                <p className="text-xs">Total tickets: {tickets.length} (filtered out)</p>
              )}
            </div>
          ) : (
            <>
              {isSelectMode && (
                <div className="px-3 py-2 border-b border-border flex items-center gap-2">
                  <Checkbox
                    checked={selectedTicketIds.size === filteredTickets.length && filteredTickets.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">Select all</span>
                </div>
              )}
              {filteredTickets.map((ticket, index) => {
                const isSelected = selectedTicket?.id === ticket.id
                const isUnread = hasNewCustomerReply(ticket)
                const isChecked = selectedTicketIds.has(ticket.id)
                return (
                <Card
                  key={ticket.id}
                  className={`m-2 cursor-pointer relative transition-all duration-200 ${
                    isSelected 
                      ? "border-primary border-2 bg-muted/30 shadow-md" 
                      : isUnread 
                        ? "border-primary/60 bg-primary/5 hover:bg-primary/10" 
                        : "border-border hover:bg-muted/50"
                  }`}
                  onClick={(e) => {
                    if (isSelectMode) {
                      e.stopPropagation()
                      toggleTicketSelection(ticket.id)
                    } else {
                      markTicketViewed(ticket)
                      setSelectedTicket(ticket)
                    }
                  }}
                >
                  {isUnread && (
                    <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-destructive shadow-sm" aria-label="New reply" />
                  )}
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      {isSelectMode && (
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTicketIds(prev => new Set(prev).add(ticket.id))
                            } else {
                              setSelectedTicketIds(prev => {
                                const next = new Set(prev)
                                next.delete(ticket.id)
                                return next
                              })
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5"
                        />
                      )}
                      <h3 className={`font-medium text-sm line-clamp-2 flex-1 ${isUnread ? "font-semibold text-foreground" : ""}`}>
                        {ticket.subject}
                      </h3>
                    <div className="flex gap-1 flex-shrink-0 items-center">
                      {isUnread && (
                        <Badge variant="secondary" className="text-[11px] bg-primary/10 text-primary border border-primary/30">
                          New
                        </Badge>
                      )}
                      <Badge className={`${getStatusColor(ticket.status)} text-white text-xs transition-all duration-200 hover:scale-105`}>
                        {ticket.status}
                      </Badge>
                      {/* Only show priority if ticket is assigned */}
                      {ticket.assigneeUserId && (
                        <Badge className={`${getPriorityColor(ticket.priority)} text-white text-xs transition-all duration-200 hover:scale-105`}>
                          {ticket.priority}
                        </Badge>
                      )}
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
                )})}
            </>
          )}
          </div>
          </div>
        </ResizablePanel>

      <ResizableHandle 
        withHandle 
        className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize group"
      />

      {/* Ticket Detail */}
      <ResizablePanel 
        defaultSize={panelSizes[1]} 
        minSize={40}
        maxSize={75}
        className="flex flex-col bg-background overflow-hidden"
      >
        <div className={`flex-1 overflow-y-auto transition-all duration-300 ${selectedTicket ? "flex flex-col h-full w-full" : "hidden md:flex"}`}>
        {selectedTicket ? (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-6 border-b border-border space-y-4 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <h1 className="text-2xl font-bold">{selectedTicket.subject}</h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${getStatusColor(selectedTicket.status)} transition-all duration-200 hover:scale-105`}>
                      {selectedTicket.status}
                    </Badge>
                    {/* Only show priority badge if ticket is assigned and has priority */}
                    {selectedTicket.assigneeUserId && selectedTicket.priority && (
                      <Badge className={`${getPriorityColor(selectedTicket.priority)} transition-all duration-200 hover:scale-105`}>
                        {selectedTicket.priority}
                      </Badge>
                    )}
                    {selectedTicket.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="transition-all duration-200 hover:scale-105 hover:bg-muted">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTicket(null)}
                  className="transition-all duration-200 hover:scale-105"
                >
                  Close
                </Button>
              </div>

              {hasNewCustomerReply(selectedTicket) && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-md text-sm text-primary animate-in fade-in">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>New customer reply received.</span>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {!selectedTicket.assigneeUserId && (
                  <Button 
                    size="sm" 
                    onClick={handleTakeTicket} 
                    disabled={assigning === selectedTicket.id}
                    className="h-8 text-xs"
                  >
                    {assigning === selectedTicket.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Take Ticket"}
                  </Button>
                )}
                {/* Allow all users to assign tickets to others */}
                <Select
                  value={selectedTicket.assigneeUserId || "unassigned"}
                  onValueChange={(value) => {
                    const assigneeId = value === "unassigned" ? null : value
                    // If assigning to someone (not unassigning), require priority
                    if (assigneeId && !selectedTicket.assigneeUserId) {
                      setPendingAssignment({ ticketId: selectedTicket.id, assigneeUserId: assigneeId })
                      setShowAssignDialog(true)
                    } else {
                      handleAssign(selectedTicket.id, assigneeId)
                    }
                  }}
                  disabled={assigning === selectedTicket.id}
                >
                  <SelectTrigger className="w-40 h-8 text-xs">
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
                <Select
                  value={selectedTicket.status}
                  onValueChange={(v) => handleUpdateStatus(v as Ticket["status"])}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                {/* Priority selector - only shown for assigned tickets and Admin/Manager */}
                {selectedTicket.assigneeUserId ? (
                  canAssign ? (
                    <Select
                      value={selectedTicket.priority || "medium"}
                      onValueChange={(v) => handleUpdatePriority(v as Ticket["priority"])}
                      disabled={updatingPriority}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs text-muted-foreground px-2 py-1.5 border border-border rounded-md">
                      Priority: {selectedTicket.priority || "Not set"}
                    </div>
                  )
                ) : (
                  <div className="text-xs text-muted-foreground px-2 py-1.5 border border-border rounded-md">
                    Priority: Set when assigned
                  </div>
                )}
              </div>

              {/* Tags Editor */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium">Tags:</span>
                {/* Popular tags as chips - sorted by frequency */}
                {Array.from(new Set(tickets.flatMap(t => t.tags)))
                  .map(tag => ({
                    tag,
                    count: tickets.filter(t => t.tags.includes(tag)).length
                  }))
                  .filter(({ tag }) => !selectedTicket.tags.includes(tag))
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 8)
                  .map(({ tag, count }) => (
                    <Badge 
                      key={tag} 
                      variant="outline" 
                      className="h-6 text-xs cursor-pointer hover:bg-muted"
                      onClick={() => {
                        const updatedTags = [...selectedTicket.tags, tag]
                        handleUpdateTags(updatedTags)
                      }}
                      title={`Used ${count} time${count !== 1 ? 's' : ''}`}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {tag}
                      {count > 1 && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
                    </Badge>
                  ))}
                {selectedTicket.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="gap-1 h-6 text-xs hover:bg-muted">
                    {tag}
                    <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveTag(tag)} />
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    className="h-6 w-24 text-xs"
                    list="tag-suggestions"
                  />
                  <datalist id="tag-suggestions">
                    {Array.from(new Set(tickets.flatMap(t => t.tags)))
                      .filter(tag => !selectedTicket.tags.includes(tag))
                      .map((tag) => (
                        <option key={tag} value={tag} />
                      ))}
                  </datalist>
                  <Button 
                    size="sm" 
                    onClick={handleAddTag} 
                    disabled={!newTag.trim() || updatingTags}
                    className="h-6 w-6 p-0"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Customer Info */}
              <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
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
              <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '100ms' }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Conversation
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConversationMinimized(!conversationMinimized)}
                      className="h-8 w-8 p-0 transition-all duration-200 hover:scale-110 hover:bg-muted"
                    >
                      {conversationMinimized ? (
                        <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                      ) : (
                        <ChevronUp className="w-4 h-4 transition-transform duration-200" />
                      )}
                    </Button>
                  </div>
                  {!conversationMinimized && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      {loadingThread ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="flex flex-col items-center gap-2 animate-in fade-in duration-300">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Loading conversation...</p>
                          </div>
                        </div>
                      ) : threadMessages.length === 0 ? (
                        <p className="text-sm text-muted-foreground animate-in fade-in duration-300">No messages yet</p>
                      ) : (
                        threadMessages.map((msg, idx) => {
                          const key = getMessageKey(msg, idx)
                          const { main, quoted } = splitBody(msg.body || msg.subject || "")
                          const hasQuoted = quoted.some(l => l.trim().length > 0)
                          const showQuoted = !!showQuotedMap[key]
                          return (
                          <div 
                            key={key} 
                            className="rounded-lg border border-border/60 bg-background/60 shadow-sm p-4 transition-all duration-200 hover:bg-muted/40 animate-in fade-in slide-in-from-left-2"
                            style={{ animationDelay: `${idx * 50}ms` }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                                {getInitials(msg.from || "User")}
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-semibold text-foreground leading-tight">
                                    {msg.from}
                                  </div>
                                  <span className="text-xs text-muted-foreground">{formatDate(msg.date)}</span>
                                </div>

                                <div className="text-sm leading-6 whitespace-pre-wrap">
                                  {main.join("\n") || msg.subject || "No content"}
                                </div>

                                {hasQuoted && (
                                  <div className="space-y-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-muted-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setShowQuotedMap(prev => ({ ...prev, [key]: !prev[key] }))
                                      }}
                                    >
                                      <MoreVertical className="w-3 h-3 mr-1" />
                                      {showQuoted ? "Hide" : "Show"} quoted text
                                    </Button>
                                    {showQuoted && (
                                      <div className="text-[11px] text-muted-foreground/70 whitespace-pre-wrap bg-muted/40 border-l-2 border-muted-foreground/30 pl-3 py-2 rounded leading-4 max-h-32 overflow-y-auto">
                                        {quoted.join("\n")}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )})
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Internal Notes */}
              <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '200ms' }}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-4">Internal Notes</h3>
                  <div className="space-y-3 mb-4">
                    {notes.map((note, idx) => (
                      <div 
                        key={note.id} 
                        className="border-l-2 border-primary pl-4 py-2 bg-muted/50 rounded transition-all duration-200 hover:bg-muted/70 animate-in fade-in slide-in-from-left-2"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{note.userName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</span>
                            {currentUserId === note.userId && (
                              editingNoteId === note.id ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleUpdateNote()
                                    }}
                                    disabled={addingNote || !editingNoteContent.trim()}
                                    type="button"
                                  >
                                    <Check className="w-3 h-3 text-green-500" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={handleCancelEditNote}
                                    disabled={addingNote}
                                  >
                                    <XCircle className="w-3 h-3 text-red-500" />
                                  </Button>
                                </div>
                              ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 transition-all duration-200 hover:scale-110 hover:bg-muted"
                                    onClick={() => handleStartEditNote(note)}
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                              )
                            )}
                          </div>
                        </div>
                        {editingNoteId === note.id ? (
                          <Textarea
                            value={editingNoteContent}
                            onChange={(e) => setEditingNoteContent(e.target.value)}
                            className="min-h-20 text-sm"
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        )}
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
              <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '300ms' }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Reply</h3>
                    <div className="flex items-center gap-2">
                      <Popover open={showQuickReplies} onOpenChange={setShowQuickReplies}>
                        <PopoverTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                            >
                              Quick Replies
                              {quickReplies.length > 0 && (
                                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                                  {quickReplies.length}
                                </Badge>
                              )}
                            </Button>
                          </PopoverTrigger>
                        <PopoverContent className="w-80 p-2" align="end">
                          {quickReplies.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              <p>No quick replies available</p>
                              <p className="text-xs mt-1">Admins can add quick replies in settings</p>
                            </div>
                          ) : (
                            <div className="space-y-1 max-h-96 overflow-y-auto">
                              {Object.entries(
                                quickReplies.reduce((acc, qr) => {
                                  const cat = qr.category || "General"
                                  if (!acc[cat]) acc[cat] = []
                                  acc[cat].push(qr)
                                  return acc
                                }, {} as Record<string, QuickReply[]>)
                              ).map(([category, replies]) => (
                                <div key={category} className="mb-2">
                                  <div className="text-xs font-semibold text-muted-foreground mb-1 px-2 sticky top-0 bg-background py-1">
                                    {category} ({replies.length})
                                  </div>
                                  {replies.map((qr) => (
                                    <Button
                                      key={qr.id}
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start h-8 text-xs text-left"
                                      onClick={() => insertQuickReply(qr.content)}
                                    >
                                      {qr.title}
                                    </Button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleGenerateDraft}
                        disabled={generatingDraft || !threadMessages.length}
                        className="h-7 text-xs"
                      >
                        {generatingDraft ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI Draft
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {showDraft && draftText && (
                    <div className="mb-4 p-3 bg-muted rounded border border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">AI Draft</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowDraft(false)
                            setDraftText("")
                          }}
                          className="transition-all duration-200 hover:scale-110"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{draftText}</p>
                      <Button
                        size="sm"
                        className="mt-2 transition-all duration-200 hover:scale-105"
                        onClick={() => {
                          setReplyText(draftText)
                          setShowDraft(false)
                        }}
                      >
                        Use This Draft
                      </Button>
                    </div>
                  )}
                  {/* Typing Indicator */}
                  {typingUsers.length > 0 && (
                    <div className="mb-2 px-2 py-1 bg-primary/10 border border-primary/20 rounded text-xs text-primary italic flex items-center gap-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="transition-all duration-200">
                        {typingUsers.map((userId) => {
                          const user = users.find(u => u.id === userId)
                          return user ? user.name : "Someone"
                        }).filter(Boolean).join(", ")} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                      </span>
                    </div>
                  )}
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => {
                      setReplyText(e.target.value)
                      handleTyping()
                    }}
                    className="min-h-32 mb-3 text-sm"
                  />
                  <Button 
                    onClick={handleSendReply} 
                    disabled={!replyText.trim() || sendingReply}
                    className="h-8 text-xs"
                  >
                    {sendingReply ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
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
      </ResizablePanel>
    </ResizablePanelGroup>

    {/* Assignment Dialog with Priority Selection */}
    <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Ticket</DialogTitle>
            <DialogDescription>
              Select a priority for this ticket before assigning it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="assign-priority">Priority *</Label>
              <Select value={assignPriority} onValueChange={setAssignPriority}>
                <SelectTrigger>
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
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAssignDialog(false)
                  setPendingAssignment(null)
                }}
                className=""
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleConfirmAssign()
                }} 
                disabled={assigning !== null}
              >
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

