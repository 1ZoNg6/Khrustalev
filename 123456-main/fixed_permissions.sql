-- =============================================
-- Fixed Permissions Setup (No Test Data)
-- =============================================

-- =============================================
-- 1. DROP EXISTING POLICIES
-- =============================================

-- Drop all existing policies
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
-- 2. CREATE ROLE-BASED RLS POLICIES
-- =============================================

-- Profiles policies
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_system_insert" ON profiles FOR INSERT WITH CHECK (true);

-- Teams policies
CREATE POLICY "teams_select_all" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_insert_admin_manager" ON teams FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('Администратор', 'Менеджер')
    )
);
CREATE POLICY "teams_update_creator" ON teams FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "teams_delete_creator" ON teams FOR DELETE USING (auth.uid() = created_by);

-- Team members policies
CREATE POLICY "team_members_select_all" ON team_members FOR SELECT USING (true);
CREATE POLICY "team_members_insert_team_owner" ON team_members FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE teams.id = team_members.team_id 
        AND teams.created_by = auth.uid()
    )
);
CREATE POLICY "team_members_update_team_owner" ON team_members FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE teams.id = team_members.team_id 
        AND teams.created_by = auth.uid()
    )
);
CREATE POLICY "team_members_delete_team_owner" ON team_members FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE teams.id = team_members.team_id 
        AND teams.created_by = auth.uid()
    )
);

-- Tasks policies
CREATE POLICY "tasks_select_accessible" ON tasks FOR SELECT USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR
    EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_members.team_id = tasks.team_id 
        AND team_members.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('Администратор', 'Менеджер')
    )
);

CREATE POLICY "tasks_insert_all" ON tasks FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "tasks_update_accessible" ON tasks FOR UPDATE USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR
    EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_members.team_id = tasks.team_id 
        AND team_members.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('Администратор', 'Менеджер')
    )
);

CREATE POLICY "tasks_delete_creator_admin" ON tasks FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'Администратор'
    )
);

-- Comments policies
CREATE POLICY "comments_select_accessible" ON comments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM tasks 
        WHERE tasks.id = comments.task_id 
        AND (
            tasks.created_by = auth.uid() OR 
            tasks.assigned_to = auth.uid() OR
            EXISTS (
                SELECT 1 FROM team_members 
                WHERE team_members.team_id = tasks.team_id 
                AND team_members.user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role IN ('Администратор', 'Менеджер')
            )
        )
    )
);

CREATE POLICY "comments_insert_accessible" ON comments FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM tasks 
        WHERE tasks.id = comments.task_id 
        AND (
            tasks.created_by = auth.uid() OR 
            tasks.assigned_to = auth.uid() OR
            EXISTS (
                SELECT 1 FROM team_members 
                WHERE team_members.team_id = tasks.team_id 
                AND team_members.user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role IN ('Администратор', 'Менеджер')
            )
        )
    )
);

-- Messages policies
CREATE POLICY "messages_select_own" ON messages FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
);
CREATE POLICY "messages_insert_own" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update_receiver" ON messages FOR UPDATE USING (receiver_id = auth.uid());

-- Attachments policies
CREATE POLICY "attachments_select_accessible" ON attachments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM tasks 
        WHERE tasks.id = attachments.task_id 
        AND (
            tasks.created_by = auth.uid() OR 
            tasks.assigned_to = auth.uid() OR
            EXISTS (
                SELECT 1 FROM team_members 
                WHERE team_members.team_id = tasks.team_id 
                AND team_members.user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role IN ('Администратор', 'Менеджер')
            )
        )
    )
);

CREATE POLICY "attachments_insert_accessible" ON attachments FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM tasks 
        WHERE tasks.id = attachments.task_id 
        AND (
            tasks.created_by = auth.uid() OR 
            tasks.assigned_to = auth.uid() OR
            EXISTS (
                SELECT 1 FROM team_members 
                WHERE team_members.team_id = tasks.team_id 
                AND team_members.user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role IN ('Администратор', 'Менеджер')
            )
        )
    )
);

-- Task history policies
CREATE POLICY "task_history_select_accessible" ON task_history FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM tasks 
        WHERE tasks.id = task_history.task_id 
        AND (
            tasks.created_by = auth.uid() OR 
            tasks.assigned_to = auth.uid() OR
            EXISTS (
                SELECT 1 FROM team_members 
                WHERE team_members.team_id = tasks.team_id 
                AND team_members.user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role IN ('Администратор', 'Менеджер')
            )
        )
    )
);

-- Notifications policies
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_system" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- App settings policies
CREATE POLICY "app_settings_select_all" ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_modify_admin" ON app_settings FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'Администратор'
    )
);

SELECT 'Permissions setup completed successfully' as status;

