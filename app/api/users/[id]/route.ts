/**
 * User management endpoints for specific user
 * GET: Get user details
 * PATCH: Update user (Admin only, or self for name/email)
 * DELETE: Deactivate user (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUser, deleteUser, UserRole } from '@/lib/users';
import { requirePermission, getCurrentUserIdFromRequest } from '@/lib/permissions';
import { getCurrentUserIdFromRequest as getUserId } from '@/lib/session';

type RouteContext =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const paramsData = await Promise.resolve((context as any).params);
    const userId = paramsData?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user id' },
        { status: 400 }
      );
    }

    const currentUserId = getUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Users can view their own profile, or Admin/Manager can view anyone
    if (userId !== currentUserId) {
      const { allowed } = await requirePermission(request, ['admin', 'manager']);
      if (!allowed) {
        return NextResponse.json(
          { error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const paramsData = await Promise.resolve((context as any).params);
    const userId = paramsData?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user id' },
        { status: 400 }
      );
    }

    const currentUserId = getUserId(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, email, role, isActive } = body;

    // Check permissions
    const isSelf = userId === currentUserId;
    const isUpdatingRoleOrActive = role !== undefined || isActive !== undefined;

    if (isUpdatingRoleOrActive || (!isSelf && name === undefined && email === undefined)) {
      // Changing role or active status requires admin
      const { allowed } = await requirePermission(request, 'admin');
      if (!allowed) {
        return NextResponse.json(
          { error: 'Admin access required to update role or status' },
          { status: 403 }
        );
      }
    }

    // Validate role if provided
    if (role && !['admin', 'manager', 'agent'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, manager, or agent' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await updateUser(userId, updateData);
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Check admin permission
    const { allowed } = await requirePermission(request, 'admin');
    
    if (!allowed) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const paramsData = await Promise.resolve((context as any).params);
    const userId = paramsData?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user id' },
        { status: 400 }
      );
    }

    await deleteUser(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user', details: (error as Error).message },
      { status: 500 }
    );
  }
}


