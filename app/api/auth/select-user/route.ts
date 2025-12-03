/**
 * User selection endpoint
 * Called after Gmail OAuth to select which team member is using the system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserById, getAllUsers } from '@/lib/users';
import { setCurrentUserIdInResponse, getSessionUserEmailFromRequest } from '@/lib/session';
import { createUser } from '@/lib/users';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, createNew } = body;

    const sharedGmailEmail = getSessionUserEmailFromRequest(request);
    if (!sharedGmailEmail) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    // If creating a new user
    if (createNew && body.name && body.role) {
      const newUser = await createUser({
        name: body.name,
        email: body.email || null,
        role: body.role,
      });

      if (!newUser) {
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }

      // Don't automatically select the user - just return the created user
      // User will need to explicitly select them
      return NextResponse.json({ 
        success: true, 
        user: newUser,
        message: 'User created successfully' 
      });
    }

    // If selecting existing user
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify user exists and belongs to this shared account
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.userEmail !== sharedGmailEmail) {
      return NextResponse.json(
        { error: 'User does not belong to this account' },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'User is inactive' },
        { status: 403 }
      );
    }

    // Set user ID in session
    const response = NextResponse.json({ 
      success: true, 
      user,
      message: 'User selected successfully' 
    });
    setCurrentUserIdInResponse(response, userId);
    return response;
  } catch (error) {
    console.error('Error selecting user:', error);
    return NextResponse.json(
      { error: 'Failed to select user', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return list of available users for selection
    const sharedGmailEmail = getSessionUserEmailFromRequest(request);
    if (!sharedGmailEmail) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Gmail first.' },
        { status: 401 }
      );
    }

    const users = await getAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users for selection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: (error as Error).message },
      { status: 500 }
    );
  }
}

