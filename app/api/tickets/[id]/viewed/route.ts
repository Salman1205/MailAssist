import { NextRequest, NextResponse } from "next/server"
import { getCurrentUserEmail } from "@/lib/storage"
import { getCurrentUserIdFromRequest } from "@/lib/session"
import { upsertTicketView } from "@/lib/ticket-views"

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const ticketId = context?.params?.id
    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticket ID" }, { status: 400 })
    }

    const userId = getCurrentUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const userEmail = await getCurrentUserEmail()
    if (!userEmail) {
      return NextResponse.json({ error: "No Gmail account connected" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const lastViewedAt = body?.lastViewedAt as string | undefined

    const result = await upsertTicketView(userId, ticketId, lastViewedAt)

    if (!result) {
      return NextResponse.json({ error: "Failed to update view state" }, { status: 500 })
    }

    return NextResponse.json({ ticketId, lastViewedAt: result.last_viewed_at || lastViewedAt })
  } catch (error) {
    console.error("Error updating ticket view:", error)
    return NextResponse.json({ error: "Failed to update ticket view" }, { status: 500 })
  }
}

