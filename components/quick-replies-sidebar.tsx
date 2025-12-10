"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Search, Edit2, Trash2, MessageSquare, X, Sparkles, Copy, Check } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface QuickReply {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  created_by?: string | null
}

interface QuickRepliesSidebarProps {
  onSelectReply: (content: string) => void
  currentUserId: string | null
  onQuickRepliesChange?: () => void
  onClose?: () => void
}

export default function QuickRepliesSidebar({ onSelectReply, currentUserId, onQuickRepliesChange, onClose }: QuickRepliesSidebarProps) {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [loading, setLoading] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null)
  const [deletingReply, setDeletingReply] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  // Form state
  const [formTitle, setFormTitle] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formCategory, setFormCategory] = useState("General")
  const [formTags, setFormTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [saving, setSaving] = useState(false)
  
  const { toast } = useToast()

  useEffect(() => {
    // Delay showing skeleton to prevent flash
    const timer = setTimeout(() => setShowSkeleton(true), 100)
    fetchQuickReplies()
    return () => clearTimeout(timer)
  }, [currentUserId])

  const fetchQuickReplies = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/quick-replies")
      if (response.ok) {
        const data = await response.json()
        setQuickReplies(data.quickReplies || [])
      }
    } catch (err) {
      console.error("Error fetching quick replies:", err)
      toast({
        title: "Error",
        description: "Failed to load quick replies",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingReply(null)
    setFormTitle("")
    setFormContent("")
    setFormCategory("General")
    setFormTags([])
    setShowCreateDialog(true)
  }

  const handleEdit = (reply: QuickReply) => {
    setEditingReply(reply)
    setFormTitle(reply.title)
    setFormContent(reply.content)
    setFormCategory(reply.category || "General")
    setFormTags(reply.tags || [])
    setShowCreateDialog(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast({
        title: "Error",
        description: "Title and content are required",
        variant: "destructive"
      })
      return
    }

    try {
      setSaving(true)
      const url = editingReply ? `/api/quick-replies/${editingReply.id}` : "/api/quick-replies"
      const method = editingReply ? "PATCH" : "POST"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory.trim() || "General",
          tags: formTags
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to save quick reply")
      }

      toast({
        title: "Success",
        description: editingReply ? "Quick reply updated" : "Quick reply created"
      })
      
      setShowCreateDialog(false)
      await fetchQuickReplies()
      onQuickRepliesChange?.()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save quick reply",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/quick-replies/${id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to delete quick reply")
      }

      toast({
        title: "Success",
        description: "Quick reply deleted"
      })
      
      setDeletingReply(null)
      await fetchQuickReplies()
      onQuickRepliesChange?.()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete quick reply",
        variant: "destructive"
      })
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formTags.includes(newTag.trim())) {
      setFormTags([...formTags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormTags(formTags.filter(t => t !== tag))
  }

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast({
      title: "Copied",
      description: "Quick reply copied to clipboard"
    })
  }

  const categories = Array.from(new Set(quickReplies.map(qr => qr.category || "General"))).sort()
  
  const filteredReplies = quickReplies.filter(qr => {
    const matchesSearch = !searchQuery || 
      qr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qr.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      qr.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === "all" || qr.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const groupedReplies = filteredReplies.reduce((acc, qr) => {
    const cat = qr.category || "General"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(qr)
    return acc
  }, {} as Record<string, QuickReply[]>)

  const canEdit = (reply: QuickReply) => {
    // Users can edit their own replies, or if they're admin/manager (we'll check on backend)
    return true // UI allows, backend enforces
  }

  return (
    <div className="flex flex-col h-full w-full bg-card border-l border-border/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-card/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Quick Replies</h2>
          </div>
          <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleCreate}
            className="h-8 text-xs transition-all duration-300 ease-out hover:scale-110 hover:shadow-md"
          >
            <Plus className="w-3 h-3 mr-1 transition-transform duration-300 group-hover:rotate-90" />
            New
          </Button>
          {onClose && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-8 w-8 p-0 transition-all duration-300 ease-out hover:scale-110 hover:bg-muted hover:shadow-sm"
                title="Close Quick Replies"
              >
                <X className="w-4 h-4 transition-transform duration-300 hover:rotate-90" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search quick replies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>

        {/* Category Filter */}
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && showSkeleton ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full bg-muted/30" />
            ))}
          </div>
        ) : !loading && filteredReplies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              {searchQuery || selectedCategory !== "all" 
                ? "No quick replies match your filters" 
                : "No quick replies yet"}
            </p>
            {!searchQuery && selectedCategory === "all" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreate}
                className="mt-2"
              >
                <Plus className="w-3 h-3 mr-1" />
                Create your first quick reply
              </Button>
            )}
          </div>
        ) : (
          Object.entries(groupedReplies).map(([category, replies]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {category}
                </h3>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {replies.length}
                </Badge>
              </div>
              {replies.map((reply, idx) => (
                <Card
                  key={reply.id}
                  className="group hover:shadow-lg transition-all duration-300 ease-out border-border/50 hover:border-primary/30 cursor-pointer hover:scale-[1.02] animate-in fade-in slide-in-from-right-2"
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={(e) => {
                    // Only trigger if clicking on the card itself, not on buttons
                    if ((e.target as HTMLElement).closest('button')) {
                      return
                    }
                    onSelectReply(reply.content)
                    toast({
                      title: "Quick reply added",
                      description: `"${reply.title}" added to draft`,
                    })
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-sm flex-1 line-clamp-1">
                        {reply.title}
                      </h4>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {copiedId === reply.id ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            disabled
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Check className="w-3 h-3 text-green-500" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopy(reply.content, reply.id)
                            }}
                            title="Copy to clipboard"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                        {canEdit(reply) && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(reply)
                              }}
                              title="Edit"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeletingReply(reply.id)
                              }}
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {reply.content}
                    </p>
                    {reply.tags && reply.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {reply.tags.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="h-4 px-1.5 text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReply ? "Edit Quick Reply" : "Create Quick Reply"}</DialogTitle>
            <DialogDescription>
              {editingReply 
                ? "Update your quick reply template" 
                : "Create a reusable template for common responses"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Thank you for your inquiry"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Enter the reply content..."
                className="mt-1 min-h-32"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <div className="flex gap-2 mt-1">
                <Select 
                  value={["General", "Support", "Sales", "Billing", "Technical"].includes(formCategory) || categories.includes(formCategory) ? formCategory : ""} 
                  onValueChange={(value) => {
                    setFormCategory(value)
                    // Clear custom input when selecting from dropdown
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Billing">Billing</SelectItem>
                    <SelectItem value="Technical">Technical</SelectItem>
                    {categories.filter(c => !["General", "Support", "Sales", "Billing", "Technical"].includes(c)).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Or type custom category"
                  value={["General", "Support", "Sales", "Billing", "Technical"].includes(formCategory) || categories.includes(formCategory) ? "" : formCategory}
                  onChange={(e) => {
                    const customValue = e.target.value
                    setFormCategory(customValue || "General")
                  }}
                  onFocus={(e) => {
                    // If current value is from dropdown, clear it when focusing input
                    if (["General", "Support", "Sales", "Billing", "Technical"].includes(formCategory) || categories.includes(formCategory)) {
                      e.currentTarget.value = ""
                      setFormCategory("")
                    }
                  }}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Select from existing or type a custom category
              </p>
            </div>

            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                {formTags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  className="flex-1"
                />
                <Button type="button" onClick={handleAddTag} variant="outline">
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formTitle.trim() || !formContent.trim()}>
              {saving ? "Saving..." : editingReply ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingReply} onOpenChange={() => setDeletingReply(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quick Reply</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this quick reply? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingReply(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deletingReply && handleDelete(deletingReply)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

