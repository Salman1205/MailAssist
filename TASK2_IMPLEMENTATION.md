# Task 2: Role & Auth Layer - Implementation Summary

## ✅ Completed

### 1. Supabase Schema (`supabase_roles_schema.sql`)
- Created `user_role` enum (admin, manager, agent)
- Created `users` table with:
  - id, name, email, role, is_active
  - shared_gmail_email (links to shared Gmail account)
  - user_email (for scoping to shared account)
- Added `assignee_user_id` to tickets table (references users.id)
- Created indexes for performance

**To apply:** Run `supabase_roles_schema.sql` in your Supabase SQL editor

### 2. Backend Libraries
- **`lib/users.ts`**: User CRUD operations, role checking
- **`lib/permissions.ts`**: Permission middleware and role checks
- **`lib/session.ts`**: Extended to store `current_user_id` cookie

### 3. API Endpoints
- **`GET /api/users`**: List users (filtered by role)
- **`POST /api/users`**: Create user (Admin only)
- **`GET /api/users/[id]`**: Get user details
- **`PATCH /api/users/[id]`**: Update user (Admin for role/status, self for name/email)
- **`DELETE /api/users/[id]`**: Deactivate user (Admin only)
- **`GET /api/auth/select-user`**: Get available users for selection
- **`POST /api/auth/select-user`**: Select/create user after Gmail login
- **`GET /api/auth/current-user`**: Get currently selected user

### 4. Frontend Components
- **`components/user-selector.tsx`**: User selection UI after Gmail login
  - Shows list of team members
  - Allows creating new users
  - Sets `current_user_id` cookie on selection

### 5. Auth Flow Updates
- After Gmail OAuth, user must select/create a team member
- `current_user_id` cookie stores selected user
- All API calls use this user for permission checks

## 🔄 What Needs to Be Done

### 1. Run Supabase Migration
```sql
-- Run supabase_roles_schema.sql in Supabase SQL editor
```

### 2. Create First Admin User
After first Gmail login, the system will prompt to create the first user. Make sure to create an admin user first.

### 3. Add Permission Checks to Existing Routes (Task 2-6)
Update existing API routes to use permission checks:
- Ticket assignment endpoints
- Knowledge base endpoints (when implemented)
- Guardrails endpoints (when implemented)

### 4. User Management UI (Task 2-5)
Create admin interface in Settings to:
- View all users
- Create/edit/delete users
- Change roles

## 📋 Role Permissions

### Admin
- ✅ Manage users (create/edit/delete)
- ✅ Manage knowledge base
- ✅ Manage guardrails
- ✅ View all tickets
- ✅ Reassign tickets

### Manager
- ✅ View all tickets
- ✅ Reassign tickets
- ❌ Cannot manage users/knowledge/guardrails

### Agent
- ✅ View own tickets + unassigned
- ✅ Reply to tickets
- ✅ Use AI drafts
- ✅ Add notes
- ❌ Cannot view all tickets
- ❌ Cannot reassign tickets

## 🔐 How It Works

1. **Shared Gmail Login**: All team members log in with the same Gmail account
2. **User Selection**: After Gmail OAuth, user selects their identity (e.g., "Azzam", "Ali", "Sana")
3. **Session Storage**: Selected user ID stored in `current_user_id` cookie
4. **Permission Checks**: All API routes check `current_user_id` and user role
5. **Data Scoping**: Tickets/emails scoped to shared Gmail account, but assignments use user IDs

## 🚀 Next Steps

1. Run the Supabase migration
2. Test user creation and selection flow
3. Implement Task 2-5 (User Management UI)
4. Add permission checks to ticket endpoints (Task 2-6)
5. Move to Task 5: Assignment & Views


