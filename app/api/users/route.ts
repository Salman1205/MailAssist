/**
 * User management endpoints
 * GET: List all users (all authenticated users can see all users for switching purposes)
 * POST: Create new user (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, createUser, UserRole } from '@/lib/users';
import { requirePermission } from '@/lib/permissions';
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

    // For user switching, all authenticated users should be able to see all users
    // This allows agents to switch to admin/manager accounts
    // The restriction on user management (create/edit/delete) is still enforced in POST/PATCH/DELETE endpoints
    const users = await getAllUsers();
    
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin permission
    const { allowed } = await requirePermission(request, 'admin');
    
    if (!allowed) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, role } = body;

    if (!name || !role) {
      return NextResponse.json(
        { error: 'Name and role are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'manager', 'agent'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, manager, or agent' },
        { status: 400 }
      );
    }

    const user = await createUser({
      name,
      email: email || null,
      role: role as UserRole,
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user', details: (error as Error).message },
      { status: 500 }
    );
  }
}

