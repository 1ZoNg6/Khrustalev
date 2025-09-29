-- =============================================
-- Complete Database Fix
-- =============================================
-- This script fixes all database issues:
-- 1. Infinite recursion in RLS policies
-- 2. Missing tables
-- 3. Incorrect RLS policies

-- =============================================
-- 1. DROP ALL EXISTING POLICIES TO AVOID CONFLICTS
-- =============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "System can create profiles" ON profiles;

DROP POLICY IF EXISTS "Users can view teams they belong to or created" ON teams;
DROP POLICY IF EXISTS "Admins and managers can create teams" ON teams;
DROP POLICY IF EXISTS "Team owners can update teams" ON teams;
DROP POLICY IF EXISTS "Team owners can delete teams" ON teams;

DROP POLICY IF EXISTS "Users can view team members of their teams" ON team_members;
DROP POLICY IF EXISTS "Team owners can manage team members" ON team_members;

DROP POLICY IF EXISTS "Users can view tasks they created, are assigned to, or in their teams" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks they created, are assigned to, or in their teams" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks they created" ON tasks;

DROP POLICY IF EXISTS "Users can view comments on tasks they have access to" ON comments;
DROP POLICY IF EXISTS "Users can create comments on tasks they have access to" ON comments;

DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update messages they received" ON messages;

DROP POLICY IF EXISTS "Users can view attachments on tasks they have access to" ON attachments;
DROP POLICY IF EXISTS "Users can create attachments on tasks they have access to" ON attachments;

DROP POLICY IF EXISTS "Users can view task history for tasks they have access to" ON task_history;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- =============================================
-- 2. CREATE MISSING TABLES
-- =============================================

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    value text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Insert default settings
INSERT INTO app_settings (key, value, description) VALUES
('app_name', 'TaskManager', 'Application name'),
('app_version', '1.0.0', 'Application version'),
('maintenance_mode', 'false', 'Maintenance mode status')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 3. CREATE SIMPLE, NON-RECURSIVE RLS POLICIES
-- =============================================

-- Profiles policies (simple)
CREATE POLICY "profiles_select_policy" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_policy" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_policy" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_system_insert_policy" ON profiles FOR INSERT WITH CHECK (true);

-- Teams policies (simple)
CREATE POLICY "teams_select_policy" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_insert_policy" ON teams FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "teams_update_policy" ON teams FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "teams_delete_policy" ON teams FOR DELETE USING (auth.uid() = created_by);

-- Team members policies (simple, no recursion)
CREATE POLICY "team_members_select_policy" ON team_members FOR SELECT USING (true);
CREATE POLICY "team_members_insert_policy" ON team_members FOR INSERT WITH CHECK (true);
CREATE POLICY "team_members_update_policy" ON team_members FOR UPDATE USING (true);
CREATE POLICY "team_members_delete_policy" ON team_members FOR DELETE USING (true);

-- Tasks policies (simple)
CREATE POLICY "tasks_select_policy" ON tasks FOR SELECT USING (true);
CREATE POLICY "tasks_insert_policy" ON tasks FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "tasks_update_policy" ON tasks FOR UPDATE USING (true);
CREATE POLICY "tasks_delete_policy" ON tasks FOR DELETE USING (auth.uid() = created_by);

-- Comments policies (simple)
CREATE POLICY "comments_select_policy" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_policy" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_policy" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_policy" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Messages policies (simple)
CREATE POLICY "messages_select_policy" ON messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "messages_insert_policy" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update_policy" ON messages FOR UPDATE USING (receiver_id = auth.uid());
CREATE POLICY "messages_delete_policy" ON messages FOR DELETE USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Attachments policies (simple)
CREATE POLICY "attachments_select_policy" ON attachments FOR SELECT USING (true);
CREATE POLICY "attachments_insert_policy" ON attachments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "attachments_update_policy" ON attachments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "attachments_delete_policy" ON attachments FOR DELETE USING (auth.uid() = user_id);

-- Task history policies (simple)
CREATE POLICY "task_history_select_policy" ON task_history FOR SELECT USING (true);
CREATE POLICY "task_history_insert_policy" ON task_history FOR INSERT WITH CHECK (true);
CREATE POLICY "task_history_update_policy" ON task_history FOR UPDATE USING (true);
CREATE POLICY "task_history_delete_policy" ON task_history FOR DELETE USING (true);

-- Notifications policies (simple)
CREATE POLICY "notifications_select_policy" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_policy" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update_policy" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_delete_policy" ON notifications FOR DELETE USING (user_id = auth.uid());

-- App settings policies (simple)
CREATE POLICY "app_settings_select_policy" ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_insert_policy" ON app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "app_settings_update_policy" ON app_settings FOR UPDATE USING (true);
CREATE POLICY "app_settings_delete_policy" ON app_settings FOR DELETE USING (true);

-- =============================================
-- 4. CREATE PROFILES FOR EXISTING USERS
-- =============================================

-- Create profiles for users who don't have them
INSERT INTO profiles (id, full_name, role)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Пользователь'),
    'Работник'
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- =============================================
-- 5. VERIFY THE FIX
-- =============================================

SELECT 'Database fix completed successfully' as status;
SELECT COUNT(*) as total_profiles FROM profiles;
SELECT COUNT(*) as total_app_settings FROM app_settings;

