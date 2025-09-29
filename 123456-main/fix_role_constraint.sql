-- =============================================
-- Fix Role Constraint in Profiles Table
-- =============================================

-- 1. First, let's check what the current constraint allows
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
AND conname LIKE '%role%';

-- 2. Drop the existing role constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 3. Create new constraint with Russian roles
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('Администратор', 'Менеджер', 'Работник'));

-- 4. Update the default value
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'Работник';

-- 5. Now try to create profiles for existing users
INSERT INTO profiles (id, full_name, role)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Пользователь'),
    'Работник'
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 6. Verify the creation
SELECT 'Role constraint fixed and profiles created' as status;
SELECT COUNT(*) as total_profiles FROM profiles;

