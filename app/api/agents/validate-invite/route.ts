/**
 * GET /api/agents/validate-invite?token=xxx
 * Validate an invitation token without accepting it
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Find the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('agent_invitations')
      .select(`
        *,
        businesses (
          id,
          business_name
        )
      `)
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or already used invitation' },
        { status: 404 }
      )
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Update invitation status to expired
      await supabase
        .from('agent_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return NextResponse.json(
        { error: 'This invitation has expired. Please request a new invitation.' },
        { status: 410 }
      )
    }

    const business = Array.isArray(invitation.businesses) 
      ? invitation.businesses[0] 
      : invitation.businesses

    // Return invitation details
    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        business_id: invitation.business_id,
        business_name: business?.business_name || 'Unknown Business',
        expires_at: invitation.expires_at,
      },
    })
  } catch (error) {
    console.error('[ValidateInvite] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
