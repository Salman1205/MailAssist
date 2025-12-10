/**
 * GET /api/quick-replies - Get all quick replies
 * POST /api/quick-replies - Create a new quick reply
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserIdFromRequest } from '@/lib/permissions';
import { getCurrentUserEmail } from '@/lib/storage';
import { getSessionUserEmailFromRequest } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Filter by created_by (user ID) so each user only sees their own quick replies
    const { data, error } = await supabase
      .from('quick_replies')
      .select('*')
      .eq('created_by', userId)
      .order('category', { ascending: true })
      .order('title', { ascending: true });

    if (error) {
      console.error('Error fetching quick replies:', error);
      return NextResponse.json(
        { error: 'Failed to fetch quick replies' },
        { status: 500 }
      );
    }

    return NextResponse.json({ quickReplies: data || [] });
  } catch (error) {
    console.error('Error in GET quick-replies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quick replies', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user_email from session for RLS scoping
    const userEmail = getSessionUserEmailFromRequest(request) || await getCurrentUserEmail();
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Unable to determine user email' },
        { status: 401 }
      );
    }

    // All authenticated users can create quick replies

    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { title, content, category, tags } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Get user_email from session for RLS scoping
    const userEmail = getSessionUserEmailFromRequest(request) || await getCurrentUserEmail();
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Unable to determine user email' },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('quick_replies')
      .insert({
        title: title.trim(),
        content: content.trim(),
        category: category?.trim() || 'General',
        tags: tags || [],
        created_by: userId, // Filter by this for user-specific quick replies
        user_email: userEmail, // Required for RLS policies
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating quick reply:', error);
      return NextResponse.json(
        { error: 'Failed to create quick reply', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ quickReply: data });
  } catch (error) {
    console.error('Error in POST quick-replies:', error);
    return NextResponse.json(
      { error: 'Failed to create quick reply', details: (error as Error).message },
      { status: 500 }
    );
  }
}

