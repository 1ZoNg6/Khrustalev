-- =============================================
-- Manual Profile Creation for Existing Users
-- =============================================

-- 1. Check if there are users in auth.users without profiles
SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data->>'full_name' as full_name,
    au.created_at
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 2. Create profiles for users who don't have them
INSERT INTO profiles (id, full_name, role)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Пользователь'),
    'Работник'
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- 3. Verify the creation
SELECT 'Profiles created successfully' as status;
SELECT COUNT(*) as total_profiles FROM profiles;

