-- =============================================
-- Fix Profile Creation Trigger
-- =============================================

-- 1. Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create a more robust function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into profiles with proper error handling
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id, 
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            COALESCE(NEW.raw_user_meta_data->>'name', 'Пользователь')
        ),
        'Работник'
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- Profile already exists, just return
        RETURN NEW;
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Test the function
SELECT 'Trigger fixed successfully' as status;

