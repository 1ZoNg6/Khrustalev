-- =============================================
-- Final Database Fix - Complete Solution
-- =============================================

-- =============================================
-- 1. DROP ALL EXISTING POLICIES
-- =============================================

-- Drop all existing policies to avoid conflicts
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- =============================================
-- 2. CREATE APP_SETTINGS TABLE
-- =============================================

-- Drop and recreate app_settings table
DROP TABLE IF EXISTS app_settings CASCADE;

CREATE TABLE app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name text DEFAULT 'TaskManager',
    primary_color text DEFAULT '#3b82f6',
    logo_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Insert default settings
INSERT INTO app_settings (app_name, primary_color, logo_url) VALUES
('TaskManager', '#3b82f6', null);

-- =============================================
-- 3. CREATE SIMPLE RLS POLICIES (NO RECURSION)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_all" ON profiles FOR ALL USING (true);

-- Teams policies  
CREATE POLICY "teams_all" ON teams FOR ALL USING (true);

-- Team members policies (SIMPLE - NO RECURSION)
CREATE POLICY "team_members_all" ON team_members FOR ALL USING (true);

-- Tasks policies
CREATE POLICY "tasks_all" ON tasks FOR ALL USING (true);

-- Comments policies
CREATE POLICY "comments_all" ON comments FOR ALL USING (true);

-- Messages policies
CREATE POLICY "messages_select" ON messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update" ON messages FOR UPDATE USING (receiver_id = auth.uid());

-- Attachments policies
CREATE POLICY "attachments_all" ON attachments FOR ALL USING (true);

-- Task history policies
CREATE POLICY "task_history_all" ON task_history FOR ALL USING (true);

-- Notifications policies
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- App settings policies
CREATE POLICY "app_settings_all" ON app_settings FOR ALL USING (true);

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
-- 5. CREATE TRIGGER FOR NEW USERS
-- =============================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create new trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Пользователь'),
        'Работник'
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 6. VERIFY THE FIX
-- =============================================

SELECT 'Database fix completed successfully' as status;
SELECT COUNT(*) as total_profiles FROM profiles;
SELECT COUNT(*) as total_app_settings FROM app_settings;
SELECT COUNT(*) as total_teams FROM teams;
SELECT COUNT(*) as total_tasks FROM tasks;

