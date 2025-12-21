/**
 * Login API Endpoint
 * POST /api/auth/login
 * 
 * Flow:
 * 1. Validate input (email, password)
 * 2. Find business by email
 * 3. Verify password
 * 4. Check if email is verified
 * 5. Find or create user for this business
 * 6. Create session
 * 7. Set cookies
 * 8. Return success
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateLoginInput, verifyPassword, generateSession } from '@/lib/auth-utils'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    // 1. Validate input
    const validation = validateLoginInput({ email, password })
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // 2. Find business by email
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('business_email', normalizedEmail)
      .single()

    if (businessError || !business) {
      console.error('[Login] Business not found:', normalizedEmail)
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    // 3. Check if email is verified
    if (!business.is_email_verified) {
      return NextResponse.json(
        { 
          error: 'Email not verified. Please check your email for the verification code.',
          requiresVerification: true,
          businessId: business.id,
        },
        { status: 403 }
      )
    }

    // 4. Verify password
    const isPasswordValid = await verifyPassword(password, business.password_hash)
    if (!isPasswordValid) {
      console.error('[Login] Invalid password for:', normalizedEmail)
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    // 5. Find admin user for this business
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (usersError) {
      console.error('[Login] Error fetching users:', usersError)
      return NextResponse.json(
        { error: 'Failed to fetch user data.' },
        { status: 500 }
      )
    }

    // Find admin user or first active user
    let user = users?.find(u => u.role === 'admin')
    if (!user) {
      user = users?.[0]
    }

    if (!user) {
      // No users exist - create admin user
      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          business_id: business.id,
          name: business.owner_name,
          email: business.business_email,
          role: 'admin',
          is_active: true,
          is_email_verified: true,
          user_email: business.business_email,
          shared_gmail_email: business.business_email,
        })
        .select()
        .single()

      if (createUserError || !newUser) {
        console.error('[Login] Error creating admin user:', createUserError)
        return NextResponse.json(
          { error: 'Failed to create user account.' },
          { status: 500 }
        )
      }

      user = newUser
      console.log('[Login] Created admin user:', user.id)
    }

    // 6. Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    // 7. Create session
    const { token: sessionToken, expiresAt } = generateSession(30) // 30 days

    const { error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: user.id,
        business_id: business.id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
      })

    if (sessionError) {
      console.error('[Login] Error creating session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create session.' },
        { status: 500 }
      )
    }

    console.log('[Login] Session created for user:', user.id)

    // 8. Set session cookies
    const cookieStore = await cookies()
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    cookieStore.set('user_id', user.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    // 9. Return success
    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: {
        id: business.id,
        name: business.business_name,
        email: business.business_email,
      },
      sessionToken,
    })
  } catch (error) {
    console.error('[Login] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
