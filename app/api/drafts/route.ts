/**
 * Manage stored drafts
 */

import { NextResponse } from 'next/server';
import { loadDrafts } from '@/lib/storage';

export async function GET() {
  try {
    const drafts = await loadDrafts();
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('Error loading drafts:', error);
    return NextResponse.json(
      { error: 'Failed to load drafts', details: (error as Error).message },
      { status: 500 }
    );
  }
}


