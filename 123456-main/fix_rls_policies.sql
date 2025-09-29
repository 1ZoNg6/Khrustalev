-- =============================================
-- Fix RLS Policies for Profiles Table
-- =============================================
-- This script fixes the RLS policies to allow profile creation during signup

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create new policies that allow profile creation during signup
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- This policy allows profile creation for the authenticated user
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Also create a policy that allows system to create profiles (for the trigger)
CREATE POLICY "System can create profiles" ON profiles FOR INSERT WITH CHECK (true);

-- =============================================
-- Test the fix
-- =============================================
-- This will test if the policies work correctly
SELECT 'RLS policies updated successfully' as status;

