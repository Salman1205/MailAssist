import { NextRequest, NextResponse } from "next/server"
import { listKnowledge, createKnowledge } from "@/lib/knowledge"
import { checkPermission } from "@/lib/permissions"
import { getCurrentUserIdFromRequest } from "@/lib/session"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const includeAll = url.searchParams.get("all") === "1"

  if (!includeAll) {
    const items = await listKnowledge(false)
    return NextResponse.json({ items })
  }

  // includeAll requires admin/manager
  const userId = getCurrentUserIdFromRequest(request as any)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const adminCheck = await checkPermission(userId, "admin")
  const managerCheck = await checkPermission(userId, "manager")
  const allowed = adminCheck.allowed || managerCheck.allowed
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const items = await listKnowledge(true)
  return NextResponse.json({ items })
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserIdFromRequest(request as any)
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const adminCheck = await checkPermission(userId, "admin")
    const managerCheck = await checkPermission(userId, "manager")
    const allowed = adminCheck.allowed || managerCheck.allowed
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const status = adminCheck.allowed ? "published" : "pending"
    const item = await createKnowledge({
      title: body.title || "",
      body: body.body || "",
      tags: Array.isArray(body.tags) ? body.tags : [],
      canParaphrase: !!body.canParaphrase,
      status,
    })
    if (!item) return NextResponse.json({ error: "Failed to create item" }, { status: 500 })
    return NextResponse.json({ item })
  } catch (error) {
    console.error("Error creating knowledge item:", error)
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 })
  }
}

