-- =============================================
-- Add Test Data (Only after users are registered)
-- =============================================
-- This script should be run AFTER users have registered in the app

-- =============================================
-- 1. CREATE TEST TEAMS (using existing users)
-- =============================================

-- Get the first admin user
WITH admin_user AS (
    SELECT id FROM profiles WHERE role = 'Администратор' LIMIT 1
)
INSERT INTO teams (name, description, created_by)
SELECT 
    'Команда разработки',
    'Основная команда разработки',
    admin_user.id
FROM admin_user
WHERE admin_user.id IS NOT NULL
ON CONFLICT DO NOTHING;

WITH admin_user AS (
    SELECT id FROM profiles WHERE role = 'Администратор' LIMIT 1
)
INSERT INTO teams (name, description, created_by)
SELECT 
    'Команда дизайна',
    'Команда UI/UX дизайна',
    admin_user.id
FROM admin_user
WHERE admin_user.id IS NOT NULL
ON CONFLICT DO NOTHING;

WITH admin_user AS (
    SELECT id FROM profiles WHERE role = 'Администратор' LIMIT 1
)
INSERT INTO teams (name, description, created_by)
SELECT 
    'Команда тестирования',
    'QA команда',
    admin_user.id
FROM admin_user
WHERE admin_user.id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =============================================
-- 2. CREATE TEST TASKS
-- =============================================

WITH admin_user AS (
    SELECT id FROM profiles WHERE role = 'Администратор' LIMIT 1
),
dev_team AS (
    SELECT id FROM teams WHERE name = 'Команда разработки' LIMIT 1
),
design_team AS (
    SELECT id FROM teams WHERE name = 'Команда дизайна' LIMIT 1
),
test_team AS (
    SELECT id FROM teams WHERE name = 'Команда тестирования' LIMIT 1
)
INSERT INTO tasks (title, description, status, priority, created_by, team_id, due_date)
SELECT 
    'Разработать систему аутентификации',
    'Создать систему входа и регистрации пользователей',
    'in_progress',
    'high',
    admin_user.id,
    dev_team.id,
    NOW() + INTERVAL '7 days'
FROM admin_user, dev_team
WHERE admin_user.id IS NOT NULL AND dev_team.id IS NOT NULL
ON CONFLICT DO NOTHING;

WITH admin_user AS (
    SELECT id FROM profiles WHERE role = 'Администратор' LIMIT 1
),
design_team AS (
    SELECT id FROM teams WHERE name = 'Команда дизайна' LIMIT 1
)
INSERT INTO tasks (title, description, status, priority, created_by, team_id, due_date)
SELECT 
    'Создать дизайн главной страницы',
    'Разработать макет и дизайн главной страницы приложения',
    'pending',
    'medium',
    admin_user.id,
    design_team.id,
    NOW() + INTERVAL '5 days'
FROM admin_user, design_team
WHERE admin_user.id IS NOT NULL AND design_team.id IS NOT NULL
ON CONFLICT DO NOTHING;

WITH admin_user AS (
    SELECT id FROM profiles WHERE role = 'Администратор' LIMIT 1
),
dev_team AS (
    SELECT id FROM teams WHERE name = 'Команда разработки' LIMIT 1
)
INSERT INTO tasks (title, description, status, priority, created_by, team_id, due_date)
SELECT 
    'Настроить CI/CD пайплайн',
    'Настроить автоматическое развертывание',
    'pending',
    'high',
    admin_user.id,
    dev_team.id,
    NOW() + INTERVAL '10 days'
FROM admin_user, dev_team
WHERE admin_user.id IS NOT NULL AND dev_team.id IS NOT NULL
ON CONFLICT DO NOTHING;

WITH admin_user AS (
    SELECT id FROM profiles WHERE role = 'Администратор' LIMIT 1
),
test_team AS (
    SELECT id FROM teams WHERE name = 'Команда тестирования' LIMIT 1
)
INSERT INTO tasks (title, description, status, priority, created_by, team_id, due_date)
SELECT 
    'Провести тестирование API',
    'Протестировать все API endpoints',
    'completed',
    'medium',
    admin_user.id,
    test_team.id,
    NOW() - INTERVAL '2 days'
FROM admin_user, test_team
WHERE admin_user.id IS NOT NULL AND test_team.id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =============================================
-- 3. CREATE TEST COMMENTS
-- =============================================

WITH admin_user AS (
    SELECT id FROM profiles WHERE role = 'Администратор' LIMIT 1
),
auth_task AS (
    SELECT id FROM tasks WHERE title = 'Разработать систему аутентификации' LIMIT 1
)
INSERT INTO comments (task_id, user_id, content)
SELECT 
    auth_task.id,
    admin_user.id,
    'Начал работу над аутентификацией. Планирую использовать JWT токены.'
FROM admin_user, auth_task
WHERE admin_user.id IS NOT NULL AND auth_task.id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =============================================
-- 4. CREATE TEST NOTIFICATIONS
-- =============================================

WITH admin_user AS (
    SELECT id FROM profiles WHERE role = 'Администратор' LIMIT 1
),
auth_task AS (
    SELECT id FROM tasks WHERE title = 'Разработать систему аутентификации' LIMIT 1
)
INSERT INTO notifications (user_id, task_id, type, content)
SELECT 
    admin_user.id,
    auth_task.id,
    'assignment',
    'Вам назначена задача: Разработать систему аутентификации'
FROM admin_user, auth_task
WHERE admin_user.id IS NOT NULL AND auth_task.id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =============================================
-- 5. VERIFY DATA CREATION
-- =============================================

SELECT 'Test data creation completed' as status;
SELECT COUNT(*) as total_teams FROM teams;
SELECT COUNT(*) as total_tasks FROM tasks;
SELECT COUNT(*) as total_comments FROM comments;
SELECT COUNT(*) as total_notifications FROM notifications;

