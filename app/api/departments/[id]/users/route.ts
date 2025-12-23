/**
 * Department Users API Routes
 * GET /api/departments/[id]/users - Get all users assigned to a department
 * POST /api/departments/[id]/users - Assign users to a department (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDepartmentUsers, assignUserToDepartment, getDepartmentById } from '@/lib/departments';
import { getCurrentUser } from '@/lib/session';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
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

        const users = await getDepartmentUsers(id);

        return NextResponse.json({
            success: true,
            users,
        });
    } catch (error) {
        console.error('Error fetching department users:', error);
        return NextResponse.json(
            { error: 'Failed to fetch department users' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Only admins can assign users
        if (currentUser.role !== 'admin') {
            return NextResponse.json(
                { error: 'Permission denied. Only admins can assign users to departments.' },
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

        const body = await request.json();
        const { userIds } = body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json(
                { error: 'userIds array is required' },
                { status: 400 }
            );
        }

        // Assign each user to the department
        const results = await Promise.all(
            userIds.map(userId => assignUserToDepartment(userId, id))
        );

        const successCount = results.filter(r => r).length;

        return NextResponse.json({
            success: true,
            message: `Assigned ${successCount} user(s) to department`,
            assignedCount: successCount,
        });
    } catch (error) {
        console.error('Error assigning users to department:', error);
        return NextResponse.json(
            { error: 'Failed to assign users to department' },
            { status: 500 }
        );
    }
}
