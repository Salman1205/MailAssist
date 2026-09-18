/**
 * Manage stored drafts
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadDrafts } from '@/lib/storage';
import { getVerifiedUserId } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: identity from the validated session_token, not the forgeable
    // current_user_id cookie — otherwise anyone could read another user's drafts.
    const userId = await getVerifiedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const drafts = await loadDrafts(userId);
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('Error loading drafts:', error);
    return NextResponse.json(
      { error: 'Failed to load drafts', details: (error as Error).message },
      { status: 500 }
    );
  }
}


