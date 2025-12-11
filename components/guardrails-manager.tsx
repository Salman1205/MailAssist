"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Textarea } from "./ui/textarea"
import { Input } from "./ui/input"
import { Button } from "./ui/button"

interface TopicRule {
  tag: string
  instruction: string
}

interface GuardrailsForm {
  toneStyle: string
  rules: string
  bannedWords: string
  topicRules: TopicRule[]
}

export default function GuardrailsManager() {
  const [form, setForm] = useState<GuardrailsForm>({
    toneStyle: "",
    rules: "",
    bannedWords: "",
    topicRules: [{ tag: "", instruction: "" }],
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/guardrails")
      const data = await res.json()
      if (data?.guardrails) {
        setForm({
          toneStyle: data.guardrails.toneStyle || "",
          rules: data.guardrails.rules || "",
          bannedWords: (data.guardrails.bannedWords || []).join(", "),
          topicRules: (data.guardrails.draft?.topicRules?.length
            ? data.guardrails.draft.topicRules
            : data.guardrails.topicRules?.length
            ? data.guardrails.topicRules
            : [{ tag: "", instruction: "" }]),
        })
        setPending(data.guardrails.pending || false)
        setHasDraft(!!data.guardrails.draft)
      }
    } catch (err) {
      setError("Failed to load guardrails")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const updateTopicRule = (index: number, key: "tag" | "instruction", value: string) => {
    setForm((prev) => {
      const next = [...prev.topicRules]
      next[index] = { ...next[index], [key]: value }
      return { ...prev, topicRules: next }
    })
  }

  const addTopicRule = () => {
    setForm((prev) => ({ ...prev, topicRules: [...prev.topicRules, { tag: "", instruction: "" }] }))
  }

  const removeTopicRule = (index: number) => {
    setForm((prev) => {
      const next = prev.topicRules.filter((_, i) => i !== index)
      return { ...prev, topicRules: next.length ? next : [{ tag: "", instruction: "" }] }
    })
  }

  const handleSave = async (publish = false) => {
    setError(null)
    setMessage(null)
    setSaving(true)
    try {
      const payload = {
        toneStyle: form.toneStyle.trim(),
        rules: form.rules.trim(),
        bannedWords: form.bannedWords
          .split(",")
          .map((w) => w.trim())
          .filter(Boolean),
        topicRules: form.topicRules
          .map((r) => ({ tag: r.tag.trim(), instruction: r.instruction.trim() }))
          .filter((r) => r.tag || r.instruction),
      }
      const res = await fetch("/api/guardrails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, publish }),
      })
      if (res.status === 401 || res.status === 403) {
        throw new Error("Admin or manager required")
      }
      if (!res.ok) throw new Error("Save failed")
      const data = await res.json()
        setPending(data.guardrails?.pending || false)
        setHasDraft(!!data.guardrails?.draft)
        setMessage("Guardrails saved")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border border-border/80 shadow-md bg-muted/30 backdrop-blur">
      <CardHeader>
        <CardTitle>AI Guardrails</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {pending && (
          <div className="text-sm text-amber-500">
            Pending changes awaiting admin publish.
          </div>
        )}
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">Tone & style</div>
          <Textarea
            placeholder="e.g., Short, friendly, polite. UK English. Use first name. Avoid jargon."
            value={form.toneStyle}
            onChange={(e) => setForm({ ...form, toneStyle: e.target.value })}
            className="min-h-20"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">General rules</div>
          <Textarea
            placeholder="e.g., Never promise refunds above £X; never ask for card details; always include approved disclaimer."
            value={form.rules}
            onChange={(e) => setForm({ ...form, rules: e.target.value })}
            className="min-h-20"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">Banned words/phrases</div>
          <Input
            placeholder="Comma separated, e.g., guaranteed, promise full refund, credit card info"
            value={form.bannedWords}
            onChange={(e) => setForm({ ...form, bannedWords: e.target.value })}
          />
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">Topic-specific rules</div>
          <div className="text-xs text-muted-foreground">
            Apply when the email relates to a tag (e.g., refund, warranty). Keep instructions concise.
          </div>
          {form.topicRules.map((rule, idx) => (
            <div key={idx} className="flex flex-col gap-2 rounded-md border border-border p-3 bg-background/60">
              <Input
                placeholder="Tag (e.g., refund)"
                value={rule.tag}
                onChange={(e) => updateTopicRule(idx, "tag", e.target.value)}
              />
              <Textarea
                placeholder="Instruction when this tag is present (e.g., include refund policy snippet; avoid promising expedited refunds)."
                value={rule.instruction}
                onChange={(e) => updateTopicRule(idx, "instruction", e.target.value)}
                className="min-h-16"
              />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => removeTopicRule(idx)} className="hover:bg-accent hover:text-accent-foreground">
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addTopicRule}
            className="transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            Add topic rule
          </Button>
        </div>

        <div className="flex gap-2 items-center">
          <Button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-sm"
          >
            {saving ? "Saving..." : "Save (submit)"}
          </Button>
          {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
        </div>

        {message && <div className="text-sm text-emerald-500">{message}</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
      </CardContent>
    </Card>
  )
}

