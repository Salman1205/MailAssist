/**
 * GET /api/quick-replies - Get all quick replies
 * POST /api/quick-replies - Create a new quick reply
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserIdFromRequest } from '@/lib/permissions';
import { canViewAllTickets } from '@/lib/permissions';
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

    const { data, error } = await supabase
      .from('quick_replies')
      .select('*')
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

    // Only admins/managers can create quick replies
    const canManage = await canViewAllTickets(userId);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Unauthorized - only admins and managers can create quick replies' },
        { status: 403 }
      );
    }

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

    const { data, error } = await supabase
      .from('quick_replies')
      .insert({
        title: title.trim(),
        content: content.trim(),
        category: category?.trim() || 'General',
        tags: tags || [],
        created_by: userId,
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

