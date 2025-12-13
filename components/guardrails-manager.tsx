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
    <Card className="border-2 shadow-xl bg-background">
      <CardHeader className="pb-6 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <CardTitle className="text-2xl">AI Guardrails</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Define how your AI communicates and what boundaries it must respect</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6">
        {pending && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending changes awaiting admin approval
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Tone & Style
          </label>
          <Textarea
            placeholder="e.g., Short, friendly, polite. UK English. Use first name. Avoid jargon."
            value={form.toneStyle}
            onChange={(e) => setForm({ ...form, toneStyle: e.target.value })}
            className="min-h-24 resize-none"
          />
          <p className="text-xs text-muted-foreground">Define the personality and writing style for AI responses</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            General Rules
          </label>
          <Textarea
            placeholder="e.g., Never promise refunds above £X; never ask for card details; always include approved disclaimer."
            value={form.rules}
            onChange={(e) => setForm({ ...form, rules: e.target.value })}
            className="min-h-24 resize-none"
          />
          <p className="text-xs text-muted-foreground">Set hard limits and compliance requirements</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Banned Words/Phrases
          </label>
          <Input
            placeholder="Comma separated, e.g., guaranteed, promise full refund, credit card info"
            value={form.bannedWords}
            onChange={(e) => setForm({ ...form, bannedWords: e.target.value })}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">Words or phrases the AI should never use</p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Topic-Specific Rules
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            Apply special instructions when emails contain specific tags (e.g., refund, warranty, shipping)
          </p>
          <div className="space-y-3">
            {form.topicRules.map((rule, idx) => (
              <div key={idx} className="rounded-xl border-2 border-border p-4 bg-muted/30 space-y-3 hover:border-primary/30 transition-colors">
                <Input
                  placeholder="Tag (e.g., refund, warranty)"
                  value={rule.tag}
                  onChange={(e) => updateTopicRule(idx, "tag", e.target.value)}
                  className="h-10 font-medium"
                />
                <Textarea
                  placeholder="Instruction for this topic (e.g., Always mention 30-day return policy; Never promise expedited refunds)."
                  value={rule.instruction}
                  onChange={(e) => updateTopicRule(idx, "instruction", e.target.value)}
                  className="min-h-20 resize-none"
                />
                <div className="flex justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeTopicRule(idx)} 
                    className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove Rule
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addTopicRule}
            className="w-full h-10 border-dashed border-2 hover:border-primary hover:bg-primary/5"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Topic Rule
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 items-center pt-6 mt-6 border-t-2 border-border/30">
          <Button
            onClick={() => handleSave(false)}
            disabled={saving}
            size="lg"
            className="shadow-lg hover:shadow-xl transition-all"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Changes
              </>
            )}
          </Button>
          {loading && (
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Loading...
            </span>
          )}
        </div>

        {/* Status Messages */}
        {message && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-700 dark:text-emerald-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {message}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

