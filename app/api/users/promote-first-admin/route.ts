/**
 * Promote first user to admin
 * This is a one-time utility to fix the case where the first user was created as agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, updateUser } from '@/lib/users';
import { getSessionUserEmailFromRequest } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { validateBusinessSession, getSessionUserEmail } = await import('@/lib/session');
    const businessSession = await validateBusinessSession();
    const sharedGmailEmail = await getSessionUserEmail();

    if (!businessSession && !sharedGmailEmail) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail or log in first.' },
        { status: 401 }
      );
    }

    // Get all users for this account
    const users = await getAllUsers(businessSession?.businessId, sharedGmailEmail);

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No users found' },
        { status: 404 }
      );
    }

    // Find the first user (oldest by created_at)
    const sortedUsers = users.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const firstUser = sortedUsers[0];

    // Check if there's already an admin
    const hasAdmin = users.some(u => u.role === 'admin' && u.isActive);

    if (hasAdmin) {
      return NextResponse.json(
        { error: 'An admin user already exists. Use the Team management page to change roles.' },
        { status: 400 }
      );
    }

    // If only one user exists, we can be more lenient - allow promotion
    // This helps fix the case where first user was created as agent

    // Promote first user to admin
    const updatedUser = await updateUser(firstUser.id, {
      role: 'admin',
    });

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to promote user to admin' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User "${updatedUser.name}" has been promoted to admin`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error promoting first user to admin:', error);
    return NextResponse.json(
      { error: 'Failed to promote user', details: (error as Error).message },
      { status: 500 }
    );
  }
}

