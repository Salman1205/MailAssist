/**
 * Logout endpoint - clears stored tokens and all user data
 */

import { NextResponse } from 'next/server';
import { clearAllData } from '@/lib/storage';

export async function POST() {
  try {
    await clearAllData();
    return NextResponse.json({ success: true, message: 'Logged out successfully. All data cleared.' });
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json(
      { error: 'Failed to logout', details: (error as Error).message },
      { status: 500 }
    );
  }
}


