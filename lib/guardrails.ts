import { supabase } from "./supabase"

export interface TopicRule {
  tag: string
  instruction: string
}

export interface Guardrails {
  toneStyle: string
  rules: string
  bannedWords: string[]
  topicRules: TopicRule[]
  updatedAt?: string
  pending: boolean
  draft?: {
    toneStyle: string
    rules: string
    bannedWords: string[]
    topicRules: TopicRule[]
  }
}

const mapRow = (row: any): Guardrails => ({
  toneStyle: row.tone_style || "",
  rules: row.rules || "",
  bannedWords: row.banned_words || [],
  topicRules: row.topic_rules || [],
  updatedAt: row.updated_at,
  pending: !!row.pending,
  draft: row.pending
    ? {
        toneStyle: row.draft_tone_style || "",
        rules: row.draft_rules || "",
        bannedWords: row.draft_banned_words || [],
        topicRules: row.draft_topic_rules || [],
      }
    : undefined,
})

export async function getGuardrails(): Promise<Guardrails | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from("guardrails").select("*").limit(1).maybeSingle()
  if (error || !data) {
    if (error) console.error("Error fetching guardrails:", error)
    return null
  }
  return mapRow(data)
}

type UpsertOptions = { publish?: boolean; asAdmin?: boolean }

export async function upsertGuardrails(
  input: Guardrails,
  options: UpsertOptions = {}
): Promise<Guardrails | null> {
  if (!supabase) return null

  // If publish, copy draft -> live and clear pending
  if (options.publish) {
    const { data: existing } = await supabase.from("guardrails").select("*").limit(1).maybeSingle()
    if (!existing) return null
    const { data, error } = await supabase
      .from("guardrails")
      .upsert(
        {
          id: 1,
          tone_style: existing.draft_tone_style || existing.tone_style || "",
          rules: existing.draft_rules || existing.rules || "",
          banned_words: existing.draft_banned_words || existing.banned_words || [],
          topic_rules: existing.draft_topic_rules || existing.topic_rules || [],
          draft_tone_style: null,
          draft_rules: null,
          draft_banned_words: null,
          draft_topic_rules: null,
          pending: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("*")
      .maybeSingle()
    if (error || !data) {
      console.error("Error publishing guardrails:", error)
      return null
    }
    return mapRow(data)
  }

  const isAdmin = !!options.asAdmin
  const payload: any = {
    id: 1,
    updated_at: new Date().toISOString(),
  }

  if (isAdmin) {
    payload.tone_style = input.toneStyle.trim()
    payload.rules = input.rules.trim()
    payload.banned_words = input.bannedWords
    payload.topic_rules = input.topicRules
    payload.pending = false
    payload.draft_tone_style = null
    payload.draft_rules = null
    payload.draft_banned_words = null
    payload.draft_topic_rules = null
  } else {
    payload.draft_tone_style = input.toneStyle.trim()
    payload.draft_rules = input.rules.trim()
    payload.draft_banned_words = input.bannedWords
    payload.draft_topic_rules = input.topicRules
    payload.pending = true
  }

  const { data, error } = await supabase
    .from("guardrails")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .maybeSingle()

  if (error || !data) {
    console.error("Error upserting guardrails:", error)
    return null
  }
  return mapRow(data)
}

