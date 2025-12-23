/**
 * Remove User from Department API Route
 * DELETE /api/departments/[id]/users/[userId] - Remove a user from a department (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { removeUserFromDepartment, getDepartmentById } from '@/lib/departments';
import { getCurrentUser } from '@/lib/session';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> }
) {
    try {
        const { id, userId } = await params;
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Only admins can remove users from departments
        if (currentUser.role !== 'admin') {
            return NextResponse.json(
                { error: 'Permission denied. Only admins can remove users from departments.' },
                { status: 403 }
            );
        }

        // Verify department exists and user has access
        const department = await getDepartmentById(id);
        if (!department) {
            return NextResponse.json(
                { error: 'Department not found' },
                { status: 404 }
            );
        }

        const hasAccess =
            (currentUser.accountType === 'business' && department.businessId === currentUser.businessId) ||
            (currentUser.accountType === 'personal' && department.userEmail === currentUser.email);

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        const success = await removeUserFromDepartment(userId, id);

        if (!success) {
            return NextResponse.json(
                { error: 'Failed to remove user from department' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'User removed from department successfully',
        });
    } catch (error) {
        console.error('Error removing user from department:', error);
        return NextResponse.json(
            { error: 'Failed to remove user from department' },
            { status: 500 }
        );
    }
}
