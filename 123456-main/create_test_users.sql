-- =============================================
-- Create Test Users with Different Roles
-- =============================================
-- This script creates test profiles for different user roles
-- Note: You'll need to register these users manually in the app

-- Create test profiles (these will be linked to auth.users when users register)
-- We'll create placeholder profiles that can be updated when users register

-- Create a test administrator profile
INSERT INTO profiles (id, full_name, role) VALUES
('00000000-0000-0000-0000-000000000001', 'Администратор Системы', 'Администратор')
ON CONFLICT (id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- Create a test manager profile  
INSERT INTO profiles (id, full_name, role) VALUES
('00000000-0000-0000-0000-000000000002', 'Менеджер Проекта', 'Менеджер')
ON CONFLICT (id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- Create test worker profiles
INSERT INTO profiles (id, full_name, role) VALUES
('00000000-0000-0000-0000-000000000003', 'Разработчик Иван', 'Работник'),
('00000000-0000-0000-0000-000000000004', 'Дизайнер Анна', 'Работник'),
('00000000-0000-0000-0000-000000000005', 'Тестировщик Петр', 'Работник')
ON CONFLICT (id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- Assign users to teams
INSERT INTO team_members (team_id, user_id, role) VALUES
-- Development team
((SELECT id FROM teams WHERE name = 'Команда разработки' LIMIT 1), '00000000-0000-0000-0000-000000000001', 'owner'),
((SELECT id FROM teams WHERE name = 'Команда разработки' LIMIT 1), '00000000-0000-0000-0000-000000000002', 'member'),
((SELECT id FROM teams WHERE name = 'Команда разработки' LIMIT 1), '00000000-0000-0000-0000-000000000003', 'member'),

-- Design team
((SELECT id FROM teams WHERE name = 'Команда дизайна' LIMIT 1), '00000000-0000-0000-0000-000000000001', 'owner'),
((SELECT id FROM teams WHERE name = 'Команда дизайна' LIMIT 1), '00000000-0000-0000-0000-000000000004', 'member'),

-- Testing team
((SELECT id FROM teams WHERE name = 'Команда тестирования' LIMIT 1), '00000000-0000-0000-0000-000000000001', 'owner'),
((SELECT id FROM teams WHERE name = 'Команда тестирования' LIMIT 1), '00000000-0000-0000-0000-000000000005', 'member')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Assign some tasks to users
UPDATE tasks SET assigned_to = '00000000-0000-0000-0000-000000000003' 
WHERE title = 'Разработать систему аутентификации';

UPDATE tasks SET assigned_to = '00000000-0000-0000-0000-000000000004' 
WHERE title = 'Создать дизайн главной страницы';

UPDATE tasks SET assigned_to = '00000000-0000-0000-0000-000000000005' 
WHERE title = 'Провести тестирование API';

-- Create some test messages
INSERT INTO messages (sender_id, receiver_id, content) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Добро пожаловать в команду! Давайте обсудим планы на неделю.'),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'Как продвигается работа над аутентификацией?'),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Аутентификация готова на 80%. Осталось добавить двухфакторную аутентификацию.')
ON CONFLICT DO NOTHING;

-- Create task history entries
INSERT INTO task_history (task_id, user_id, field_changed, old_value, new_value) VALUES
((SELECT id FROM tasks WHERE title = 'Разработать систему аутентификации' LIMIT 1), '00000000-0000-0000-0000-000000000001', 'status', 'pending', 'in_progress'),
((SELECT id FROM tasks WHERE title = 'Провести тестирование API' LIMIT 1), '00000000-0000-0000-0000-000000000001', 'status', 'in_progress', 'completed'),
((SELECT id FROM tasks WHERE title = 'Разработать систему аутентификации' LIMIT 1), '00000000-0000-0000-0000-000000000001', 'assigned_to', null, '00000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

SELECT 'Test users and data created successfully' as status;
SELECT COUNT(*) as total_test_profiles FROM profiles WHERE id LIKE '00000000-0000-0000-0000-00000000000%';
SELECT COUNT(*) as total_team_memberships FROM team_members;
SELECT COUNT(*) as total_messages FROM messages;
SELECT COUNT(*) as total_task_history FROM task_history;

