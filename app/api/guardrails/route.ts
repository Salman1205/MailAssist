import { NextRequest, NextResponse } from "next/server"
import { getGuardrails, upsertGuardrails } from "@/lib/guardrails"
import { getCurrentUserIdFromRequest } from "@/lib/session"
import { checkPermission } from "@/lib/permissions"

export async function GET() {
  const data = await getGuardrails()
  return NextResponse.json({ guardrails: data })
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
    const publish = !!body.publish && adminCheck.allowed

    const payload = {
      toneStyle: body.toneStyle || "",
      rules: body.rules || "",
      bannedWords: Array.isArray(body.bannedWords) ? body.bannedWords : [],
      topicRules: Array.isArray(body.topicRules) ? body.topicRules : [],
    }

    const saved = await upsertGuardrails(payload, { publish, asAdmin: adminCheck.allowed })
    if (!saved) return NextResponse.json({ error: "Failed to save" }, { status: 500 })
    return NextResponse.json({ guardrails: saved })
  } catch (error) {
    console.error("Error saving guardrails:", error)
    return NextResponse.json({ error: "Failed to save guardrails" }, { status: 500 })
  }
}

