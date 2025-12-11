import { supabase } from "./supabase"

export interface KnowledgeItem {
  id: string
  title: string
  body: string
  tags: string[]
  canParaphrase: boolean
  createdAt: string
  updatedAt: string
  status?: "published" | "pending"
  version?: number
}

const mapRow = (row: any): KnowledgeItem => ({
  id: row.id,
  title: row.title,
  body: row.body,
  tags: row.tags || [],
  canParaphrase: !!row.can_paraphrase,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  status: (row.status as any) || "published",
  version: row.version || 1,
})

export async function listKnowledge(userEmail: string | null, includeAll = false): Promise<KnowledgeItem[]> {
  if (!supabase || !userEmail) return []
  let query = supabase
    .from("knowledge_items")
    .select("*")
    .eq("user_email", userEmail)
    .order("created_at", { ascending: false })
  if (!includeAll) {
    query = query.eq("status", "published")
  }
  const { data, error } = await query
  if (error || !data) {
    console.error("Error fetching knowledge items:", error)
    return []
  }
  return data.map(mapRow)
}

export async function createKnowledge(
  input: {
    title: string
    body: string
    tags: string[]
    canParaphrase: boolean
    status?: "published" | "pending"
    userEmail: string
    userId?: string | null
  }
) {
  if (!supabase || !input.userEmail) return null
  const { data, error } = await supabase
    .from("knowledge_items")
    .insert({
      title: input.title.trim(),
      body: input.body.trim(),
      tags: input.tags,
      can_paraphrase: input.canParaphrase,
      status: input.status || "published",
      version: 1,
      user_email: input.userEmail,
      created_by: input.userId || null,
    })
    .select("*")
    .maybeSingle()
  if (error || !data) {
    console.error("Error creating knowledge item:", error)
    return null
  }
  return mapRow(data)
}

export async function updateKnowledge(
  id: string,
  input: {
    title?: string
    body?: string
    tags?: string[]
    canParaphrase?: boolean
    status?: "published" | "pending"
    bumpVersion?: boolean
    userEmail: string
  }
) {
  if (!supabase || !input.userEmail) return null
  let versionBump = 0
  if (input.bumpVersion) {
    const { data: existing } = await supabase
      .from("knowledge_items")
      .select("version")
      .eq("id", id)
      .eq("user_email", input.userEmail)
      .maybeSingle()
    const currentVersion = existing?.version || 1
    versionBump = currentVersion + 1
  }
  const payload: any = {}
  if (input.title !== undefined) payload.title = input.title.trim()
  if (input.body !== undefined) payload.body = input.body.trim()
  if (input.tags !== undefined) payload.tags = input.tags
  if (input.canParaphrase !== undefined) payload.can_paraphrase = input.canParaphrase
  if (input.status) payload.status = input.status
  if (input.bumpVersion) payload.version = versionBump

  const { data, error } = await supabase
    .from("knowledge_items")
    .update(payload)
    .eq("id", id)
    .eq("user_email", input.userEmail)
    .select("*")
    .maybeSingle()
  if (error || !data) {
    console.error("Error updating knowledge item:", error)
    return null
  }
  return mapRow(data)
}

export async function deleteKnowledge(id: string, userEmail: string | null) {
  if (!supabase || !userEmail) return false
  const { error } = await supabase.from("knowledge_items").delete().eq("id", id).eq("user_email", userEmail)
  if (error) {
    console.error("Error deleting knowledge item:", error)
    return false
  }
  return true
}

