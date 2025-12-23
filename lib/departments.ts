/**
 * Departments Management Library
 * Handles department CRUD operations and user-department assignments
 */

import { supabase } from './supabase';
import { getCurrentUserEmail } from './storage';

export interface Department {
    id: string;
    name: string;
    description: string;
    userEmail?: string | null;
    businessId?: string | null;
    createdBy?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    userCount?: number; // Optional, populated when fetching with user count
}

export interface DepartmentInput {
    name: string;
    description: string;
    userEmail?: string | null;
    businessId?: string | null;
    createdBy: string;
}

export interface UserDepartment {
    id: string;
    userId: string;
    departmentId: string;
    assignedAt: string;
}

/**
 * Get all departments for an account
 */
export async function getAllDepartments(
    userEmail: string | null,
    businessId: string | null
): Promise<Department[]> {
    if (!supabase) return [];

    let query = supabase
        .from('departments')
        .select('*')
        .eq('is_active', true);

    // Scope by account type
    if (businessId) {
        query = query.eq('business_id', businessId);
    } else if (userEmail) {
        query = query.eq('user_email', userEmail);
    } else {
        return [];
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching departments:', error);
        return [];
    }

    if (!data) return [];

    // Get user count for each department
    const departmentsWithCount = await Promise.all(
        data.map(async (dept: any) => {
            if (!supabase) {
                return mapRowToDepartment({ ...dept, userCount: 0 });
            }

            const { count } = await supabase
                .from('user_departments')
                .select('*', { count: 'exact', head: true })
                .eq('department_id', dept.id);

            return mapRowToDepartment({ ...dept, userCount: count || 0 });
        })
    );

    return departmentsWithCount;
}

/**
 * Get a single department by ID
 */
export async function getDepartmentById(id: string): Promise<Department | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();

    if (error) {
        console.error('Error fetching department:', error);
        return null;
    }

    if (!data) return null;

    // Get user count
    const { count } = await supabase
        .from('user_departments')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', id);

    return mapRowToDepartment({ ...data, userCount: count || 0 });
}

/**
 * Create a new department (admin only)
 */
export async function createDepartment(input: DepartmentInput): Promise<Department | null> {
    if (!supabase) return null;

    const payload: any = {
        name: input.name,
        description: input.description,
        created_by: input.createdBy,
        is_active: true,
    };

    // Set scope
    if (input.businessId) {
        payload.business_id = input.businessId;
    } else if (input.userEmail) {
        payload.user_email = input.userEmail;
    } else {
        console.error('Department must be scoped to either userEmail or businessId');
        return null;
    }

    const { data, error } = await supabase
        .from('departments')
        .insert(payload)
        .select('*')
        .maybeSingle();

    if (error) {
        console.error('Error creating department:', error);
        return null;
    }

    if (!data) return null;

    return mapRowToDepartment(data);
}

/**
 * Update a department (admin only)
 */
export async function updateDepartment(
    id: string,
    updates: Partial<DepartmentInput>
): Promise<Department | null> {
    if (!supabase) return null;

    const payload: any = {};

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;

    const { data, error } = await supabase
        .from('departments')
        .update(payload)
        .eq('id', id)
        .select('*')
        .maybeSingle();

    if (error) {
        console.error('Error updating department:', error);
        return null;
    }

    if (!data) return null;

    return mapRowToDepartment(data);
}

/**
 * Soft delete a department (admin only)
 */
export async function deleteDepartment(id: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from('departments')
        .update({ is_active: false })
        .eq('id', id);

    if (error) {
        console.error('Error deleting department:', error);
        return false;
    }

    return true;
}

/**
 * Assign a user to a department
 */
export async function assignUserToDepartment(
    userId: string,
    departmentId: string
): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from('user_departments')
        .insert({
            user_id: userId,
            department_id: departmentId,
        });

    if (error) {
        // Ignore duplicate key errors (already assigned)
        if (error.code === '23505') {
            console.log('User already assigned to this department');
            return true;
        }
        console.error('Error assigning user to department:', error);
        return false;
    }

    return true;
}

/**
 * Remove a user from a department
 */
export async function removeUserFromDepartment(
    userId: string,
    departmentId: string
): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
        .from('user_departments')
        .delete()
        .eq('user_id', userId)
        .eq('department_id', departmentId);

    if (error) {
        console.error('Error removing user from department:', error);
        return false;
    }

    return true;
}

/**
 * Get all departments for a user
 */
export async function getUserDepartments(userId: string): Promise<Department[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('user_departments')
        .select(`
      department_id,
      departments (*)
    `)
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user departments:', error);
        return [];
    }

    if (!data) return [];

    return data
        .filter((row: any) => row.departments && row.departments.is_active)
        .map((row: any) => mapRowToDepartment(row.departments));
}

/**
 * Get all users assigned to a department
 */
export async function getDepartmentUsers(departmentId: string): Promise<any[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('user_departments')
        .select(`
      user_id,
      assigned_at,
      users (
        id,
        name,
        email,
        role
      )
    `)
        .eq('department_id', departmentId);

    if (error) {
        console.error('Error fetching department users:', error);
        return [];
    }

    if (!data) return [];

    return data
        .filter((row: any) => row.users)
        .map((row: any) => ({
            userId: row.user_id,
            assignedAt: row.assigned_at,
            name: row.users.name,
            email: row.users.email,
            role: row.users.role,
        }));
}

/**
 * Check if a user is assigned to a department
 */
export async function isUserInDepartment(
    userId: string,
    departmentId: string
): Promise<boolean> {
    if (!supabase) return false;

    const { data, error } = await supabase
        .from('user_departments')
        .select('id')
        .eq('user_id', userId)
        .eq('department_id', departmentId)
        .maybeSingle();

    if (error) {
        console.error('Error checking user department:', error);
        return false;
    }

    return !!data;
}

/**
 * Get department IDs for a user (lightweight version)
 */
export async function getUserDepartmentIds(userId: string): Promise<string[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user department IDs:', error);
        return [];
    }

    if (!data) return [];

    return data.map((row: any) => row.department_id);
}

/**
 * Update user's department assignments (replace all)
 * Removes all existing assignments and adds new ones
 */
export async function updateUserDepartments(
    userId: string,
    departmentIds: string[]
): Promise<boolean> {
    if (!supabase) return false;

    try {
        // Delete all existing assignments
        const { error: deleteError } = await supabase
            .from('user_departments')
            .delete()
            .eq('user_id', userId);

        if (deleteError) {
            console.error('Error deleting existing department assignments:', deleteError);
            return false;
        }

        // If no departments to assign, we're done
        if (departmentIds.length === 0) {
            return true;
        }

        // Insert new assignments
        const assignments = departmentIds.map(deptId => ({
            user_id: userId,
            department_id: deptId,
        }));

        const { error: insertError } = await supabase
            .from('user_departments')
            .insert(assignments);

        if (insertError) {
            console.error('Error inserting new department assignments:', insertError);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error updating user departments:', error);
        return false;
    }
}

/**
 * Map database row to Department interface
 */
function mapRowToDepartment(row: any): Department {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        userEmail: row.user_email || null,
        businessId: row.business_id || null,
        createdBy: row.created_by || null,
        isActive: row.is_active ?? true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        userCount: row.userCount,
    };
}
