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

const mapRow = (row: any): Guardrails => {
  const hasDraft =
    !!row.draft_tone_style ||
    !!row.draft_rules ||
    (Array.isArray(row.draft_banned_words) && row.draft_banned_words.length > 0) ||
    (row.draft_topic_rules && Array.isArray(row.draft_topic_rules) && row.draft_topic_rules.length > 0)

  const effectivePending = !!(row.pending && hasDraft)

  return {
    toneStyle: row.tone_style || "",
    rules: row.rules || "",
    bannedWords: row.banned_words || [],
    topicRules: row.topic_rules || [],
    updatedAt: row.updated_at,
    pending: effectivePending,
    draft: effectivePending
      ? {
          toneStyle: row.draft_tone_style || "",
          rules: row.draft_rules || "",
          bannedWords: row.draft_banned_words || [],
          topicRules: row.draft_topic_rules || [],
        }
      : undefined,
  }
}

export async function getGuardrails(userEmail: string | null): Promise<Guardrails | null> {
  if (!supabase || !userEmail) return null
  const { data, error } = await supabase
    .from("guardrails")
    .select("*")
    .eq("user_email", userEmail)
    .limit(1)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error("Error fetching guardrails:", error)
    return null
  }
  return mapRow(data)
}

type UpsertOptions = { publish?: boolean; asAdmin?: boolean }

export async function upsertGuardrails(
  input: Guardrails,
  options: UpsertOptions & { userEmail?: string | null; userId?: string | null } = {}
): Promise<Guardrails | null> {
  if (!supabase || !options.userEmail) return null

  const userEmail = options.userEmail

  // If publish, copy draft -> live and clear pending
  if (options.publish) {
    const { data: existing } = await supabase
      .from("guardrails")
      .select("*")
      .eq("user_email", userEmail)
      .limit(1)
      .maybeSingle()
    if (!existing) return null
    const { data, error } = await supabase
      .from("guardrails")
      .upsert(
        {
          id: existing.id,
          user_email: userEmail,
          created_by: options.userId || existing.created_by || null,
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
    user_email: userEmail,
    created_by: options.userId || null,
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
    .upsert(payload, { onConflict: "user_email" })
    .select("*")
    .maybeSingle()

  if (error || !data) {
    console.error("Error upserting guardrails:", error)
    return null
  }
  return mapRow(data)
}

