"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Search, Edit2, Trash2, MessageSquare, X, Copy, Check, Tag, FolderOpen, Sparkles } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface QuickReply {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  created_by?: string | null
  created_at?: string
  updated_at?: string
}

interface QuickRepliesViewProps {
  currentUserId: string | null
}

export default function QuickRepliesView({ currentUserId }: QuickRepliesViewProps) {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [loading, setLoading] = useState(true)
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
  }, [])

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
    setNewTag("")
    setShowCreateDialog(true)
  }

  const handleEdit = (reply: QuickReply) => {
    setEditingReply(reply)
    setFormTitle(reply.title)
    setFormContent(reply.content)
    setFormCategory(reply.category || "General")
    setFormTags(reply.tags || [])
    setNewTag("")
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

  return (
    <div className="h-full w-full bg-background overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border/50 bg-card/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              Quick Replies
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage reusable response templates
            </p>
          </div>
          <Button
            onClick={handleCreate}
            className="transition-all duration-300 ease-out hover:scale-110 hover:shadow-lg shadow-md"
          >
            <Plus className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-90" />
            New Quick Reply
          </Button>
        </div>
        
        {/* Search and Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search quick replies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48 h-10">
              <FolderOpen className="w-4 h-4 mr-2" />
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && showSkeleton ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48 w-full rounded-lg bg-muted/30" />
            ))}
          </div>
        ) : !loading && filteredReplies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-12">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery || selectedCategory !== "all" 
                ? "No quick replies match your filters" 
                : "No quick replies yet"}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {searchQuery || selectedCategory !== "all"
                ? "Try adjusting your search or category filter"
                : "Create your first quick reply to save time on common responses"}
            </p>
            {!searchQuery && selectedCategory === "all" && (
              <Button onClick={handleCreate} size="lg" className="transition-all duration-200 hover:scale-105">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Quick Reply
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedReplies).map(([category, replies]) => (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">{category}</h2>
                  </div>
                  <Badge variant="secondary" className="h-5 px-2 text-xs">
                    {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {replies.map((reply, idx) => (
                    <Card
                      key={reply.id}
                      className="group hover:shadow-xl transition-all duration-300 ease-out border-border/50 hover:border-primary/30 relative overflow-hidden hover:scale-[1.02] animate-in fade-in slide-in-from-bottom-2"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <CardContent className="p-5">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="font-semibold text-base flex-1 line-clamp-1 group-hover:text-primary transition-colors">
                            {reply.title}
                          </h3>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {copiedId === reply.id ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                disabled
                              >
                                <Check className="w-4 h-4 text-green-500" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handleCopy(reply.content, reply.id)}
                                title="Copy to clipboard"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEdit(reply)}
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeletingReply(reply.id)}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Content Preview */}
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 min-h-[3.75rem]">
                          {reply.content}
                        </p>
                        
                        {/* Tags */}
                        {reply.tags && reply.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {reply.tags.slice(0, 3).map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="h-5 px-2 text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                            {reply.tags.length > 3 && (
                              <Badge variant="outline" className="h-5 px-2 text-xs">
                                +{reply.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleCopy(reply.content, reply.id)}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {reply.created_at && new Date(reply.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {editingReply ? "Edit Quick Reply" : "Create Quick Reply"}
            </DialogTitle>
            <DialogDescription>
              {editingReply 
                ? "Update your quick reply template" 
                : "Create a reusable template for common responses"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 py-4">
            <div>
              <Label htmlFor="title" className="text-sm font-semibold">Title *</Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Thank you for your inquiry"
                className="mt-2 h-10"
              />
            </div>

            <div>
              <Label htmlFor="content" className="text-sm font-semibold">Content *</Label>
              <Textarea
                id="content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Enter the reply content..."
                className="mt-2 min-h-40 resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formContent.length} characters
              </p>
            </div>

            <div>
              <Label htmlFor="category" className="text-sm font-semibold">Category</Label>
              <div className="flex gap-2 mt-2">
                <Select 
                  value={["General", "Support", "Sales", "Billing", "Technical"].includes(formCategory) || categories.includes(formCategory) ? formCategory : ""} 
                  onValueChange={(value) => {
                    setFormCategory(value)
                  }}
                >
                  <SelectTrigger className="flex-1 h-10">
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
                    // Clear dropdown selection when user starts typing custom category
                    if (["General", "Support", "Sales", "Billing", "Technical"].includes(formCategory) || categories.includes(formCategory)) {
                      e.currentTarget.value = ""
                      setFormCategory("")
                    }
                  }}
                  className="flex-1 h-10"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Select from existing categories or type a custom one
              </p>
            </div>

            <div>
              <Label className="text-sm font-semibold">Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2 mb-3">
                {formTags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1.5 h-7 px-3">
                    <Tag className="w-3 h-3" />
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-destructive transition-colors" 
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
                  className="flex-1 h-10"
                />
                <Button type="button" onClick={handleAddTag} variant="outline" className="h-10">
                  <Plus className="w-4 h-4 mr-1" />
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
              {saving ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingReply ? (
                "Update Quick Reply"
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Quick Reply
                </>
              )}
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
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

