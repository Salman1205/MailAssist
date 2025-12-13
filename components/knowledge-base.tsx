"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Badge } from "./ui/badge"
import { Switch } from "./ui/switch"

interface KnowledgeItem {
  id: string
  title: string
  body: string
  tags: string[]
  canParaphrase: boolean
  status?: "published" | "pending"
  version?: number
}

export default function KnowledgeBaseManager() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [pendingItems, setPendingItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")

  const [form, setForm] = useState({
    title: "",
    body: "",
    tags: "",
    canParaphrase: true,
  })

  const [editingId, setEditingId] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/knowledge?all=1")
      if (res.status === 401 || res.status === 403) {
        setItems([])
        setPendingItems([])
        setError("Admin access required to manage knowledge base.")
        return
      }
      const data = await res.json()
      const published = (data.items || []).filter((i: KnowledgeItem) => i.status !== "pending")
      const pending = (data.items || []).filter((i: KnowledgeItem) => i.status === "pending")
      setItems(published)
      setPendingItems(pending)
    } catch (err) {
      setError("Failed to load knowledge items")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const resetForm = () =>
    setForm({ title: "", body: "", tags: "", canParaphrase: true })

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and body are required")
      return
    }
    setError(null)
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        canParaphrase: form.canParaphrase,
      }
      if (editingId) {
        const res = await fetch(`/api/knowledge/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (res.status === 401 || res.status === 403) throw new Error("Admin required")
        if (!res.ok) throw new Error("Update failed")
      } else {
        const res = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (res.status === 401 || res.status === 403) throw new Error("Admin required")
        if (!res.ok) throw new Error("Create failed")
      }
      resetForm()
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item: KnowledgeItem) => {
    setEditingId(item.id)
    setForm({
      title: item.title,
      body: item.body,
      tags: item.tags.join(", "),
      canParaphrase: item.canParaphrase,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" })
      if (res.status === 401 || res.status === 403) throw new Error("Admin required")
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setError("Delete failed")
    }
  }

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published", bumpVersion: true }),
      })
      if (res.status === 401 || res.status === 403) throw new Error("Admin required")
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setError("Publish failed")
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-xl bg-background">
        <CardHeader className="pb-6 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-2xl">Knowledge Base</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Create reusable content that AI can reference in responses</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6">
          <div className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-2 md:gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Title</div>
                <Input
                  placeholder="e.g., Return policy (30 days)"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Paraphrase</div>
                <label className="flex items-center gap-2 text-sm text-foreground rounded-md border border-border px-3 py-2">
                  <Switch
                    checked={form.canParaphrase}
                    onCheckedChange={(v) => setForm({ ...form, canParaphrase: v })}
                  />
                  Allow AI to paraphrase (off = copy verbatim)
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Body</div>
              <Textarea
                placeholder="What the AI can use — include exact steps, timelines, who pays, thresholds..."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="min-h-28"
              />
              <div className="text-xs text-muted-foreground">
                Tip: Be explicit with numbers and conditions (e.g., “30 days”, “5–7 business days”, “customer pays return shipping unless damaged”).
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Tags</div>
              <Input
                placeholder="Comma separated, e.g., returns, refund, policy"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
              <div className="text-xs text-muted-foreground">Tags help auto-select snippets for matching emails.</div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update entry" : "Create entry"}
              </Button>
              {editingId && (
                <Button variant="ghost" onClick={() => { setEditingId(null); resetForm() }}>
                  Cancel
                </Button>
              )}
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/80 shadow-md bg-muted/30 backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle>Pending (admin approval)</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Filter by tag or text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="sm:w-64"
            />
            <div className="text-xs text-muted-foreground">Filter applies to pending and published lists.</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : pendingItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">No pending items.</div>
          ) : (
            pendingItems
              .filter((item) => {
                if (!filter.trim()) return true
                const f = filter.toLowerCase()
                return (
                  item.title.toLowerCase().includes(f) ||
                  item.body.toLowerCase().includes(f) ||
                  item.tags.some((t) => t.toLowerCase().includes(f))
                )
              })
              .map((item) => (
              <div key={item.id} className="rounded-md border border-border p-4 space-y-2 bg-background/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Pending • v{item.version || 1} • {item.canParaphrase ? "Paraphrase" : "Copy exactly"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => handlePublish(item.id)}>Approve/Publish</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>Delete</Button>
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap leading-6">{item.body}</div>
                <div className="flex gap-2 flex-wrap">
                  {item.tags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No tags</span>
                  ) : (
                    item.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/80 shadow-md bg-muted/30 backdrop-blur">
        <CardHeader>
          <CardTitle>Published</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No knowledge items yet.</div>
          ) : (
            items
              .filter((item) => {
                if (!filter.trim()) return true
                const f = filter.toLowerCase()
                return (
                  item.title.toLowerCase().includes(f) ||
                  item.body.toLowerCase().includes(f) ||
                  item.tags.some((t) => t.toLowerCase().includes(f))
                )
              })
              .map((item) => (
              <div key={item.id} className="rounded-md border border-border p-4 space-y-2 bg-background/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Published • v{item.version || 1} • {item.canParaphrase ? "Paraphrase" : "Copy exactly"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>Delete</Button>
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap leading-6">{item.body}</div>
                <div className="flex gap-2 flex-wrap">
                  {item.tags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No tags</span>
                  ) : (
                    item.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

