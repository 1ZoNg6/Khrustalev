-- =============================================
-- Fix Database Constraints
-- =============================================

-- 1. Fix team_members role constraint
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_check 
CHECK (role IN ('owner', 'member'));

-- 2. Fix tasks priority constraint  
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check 
CHECK (priority IN ('low', 'medium', 'high'));

-- 3. Fix tasks status constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('pending', 'in_progress', 'completed'));

-- 4. Fix profiles role constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('Администратор', 'Менеджер', 'Работник'));

SELECT 'Constraints fixed successfully' as status;

