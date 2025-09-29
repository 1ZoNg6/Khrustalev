-- =============================================
-- Simple Fix for Role Constraint
-- =============================================

-- 1. Drop all existing role constraints
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS role_check;

-- 2. Create new constraint with Russian roles
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('Администратор', 'Менеджер', 'Работник'));

-- 3. Set default role
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'Работник';

-- 4. Create profiles for existing users
INSERT INTO profiles (id, full_name, role)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Пользователь'),
    'Работник'
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 5. Show results
SELECT 'Fix completed successfully' as status;
SELECT COUNT(*) as total_profiles FROM profiles;

