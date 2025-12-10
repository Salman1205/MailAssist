/**
 * Manage stored drafts
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadDrafts } from '@/lib/storage';
import { getCurrentUserIdFromRequest } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserIdFromRequest(request);
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


