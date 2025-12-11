import { NextRequest, NextResponse } from "next/server"
import { getGuardrails, upsertGuardrails } from "@/lib/guardrails"
import { getCurrentUserIdFromRequest, getSessionUserEmailFromRequest } from "@/lib/session"
import { checkPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  const userEmail = getSessionUserEmailFromRequest(request as any)
  if (!userEmail) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const data = await getGuardrails(userEmail)
  return NextResponse.json({ guardrails: data })
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserIdFromRequest(request as any)
    const userEmail = getSessionUserEmailFromRequest(request as any)
    if (!userId || !userEmail) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const adminCheck = await checkPermission(userId, "admin")
    const managerCheck = await checkPermission(userId, "manager")
    const allowed = adminCheck.allowed || managerCheck.allowed
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    // For now we allow both admin and manager to save live guardrails; no pending flow.
    const publish = false

    const payload = {
      toneStyle: body.toneStyle || "",
      rules: body.rules || "",
      bannedWords: Array.isArray(body.bannedWords) ? body.bannedWords : [],
      topicRules: Array.isArray(body.topicRules) ? body.topicRules : [],
    }

    const saved = await upsertGuardrails(payload, {
      publish,
      // Treat both admin and manager as privileged for live saves (no pending)
      asAdmin: true,
      userEmail,
      userId,
    })
    if (!saved) return NextResponse.json({ error: "Failed to save" }, { status: 500 })
    return NextResponse.json({ guardrails: saved })
  } catch (error) {
    console.error("Error saving guardrails:", error)
    return NextResponse.json({ error: "Failed to save guardrails" }, { status: 500 })
  }
}

