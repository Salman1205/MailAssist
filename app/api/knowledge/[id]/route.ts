import { NextRequest, NextResponse } from "next/server"
import { updateKnowledge, deleteKnowledge } from "@/lib/knowledge"
import { checkPermission } from "@/lib/permissions"
import { getCurrentUserIdFromRequest } from "@/lib/session"

type RouteContext = { params: { id: string } }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = getCurrentUserIdFromRequest(request as any)
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const adminCheck = await checkPermission(userId, "admin")
    const managerCheck = await checkPermission(userId, "manager")
    const allowed = adminCheck.allowed || managerCheck.allowed
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const item = await updateKnowledge(context.params.id, {
      title: body.title,
      body: body.body,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      canParaphrase: body.canParaphrase,
      status: body.status,
      bumpVersion: adminCheck.allowed,
    })
    if (!item) return NextResponse.json({ error: "Failed to update item" }, { status: 500 })
    return NextResponse.json({ item })
  } catch (error) {
    console.error("Error updating knowledge item:", error)
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = getCurrentUserIdFromRequest(request as any)
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const adminCheck = await checkPermission(userId, "admin")
    const managerCheck = await checkPermission(userId, "manager")
    const allowed = adminCheck.allowed || managerCheck.allowed
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const ok = await deleteKnowledge(context.params.id)
    if (!ok) return NextResponse.json({ error: "Failed to delete item" }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting knowledge item:", error)
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 })
  }
}

