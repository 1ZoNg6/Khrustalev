-- =============================================
-- Task Management System Database Schema
-- =============================================
-- Complete database schema for Supabase
-- Includes all tables, relationships, RLS policies, and triggers

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES TABLE
-- =============================================
-- User profiles with roles and basic information
CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    role text NOT NULL CHECK (role IN ('Администратор', 'Менеджер', 'Работник')) DEFAULT 'Работник',
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================
-- 2. TEAMS TABLE
-- =============================================
-- Teams for organizing users and tasks
CREATE TABLE teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================
-- 3. TEAM MEMBERS TABLE
-- =============================================
-- Many-to-many relationship between teams and users
CREATE TABLE team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'member')) DEFAULT 'member',
    created_at timestamptz DEFAULT now(),
    UNIQUE(team_id, user_id)
);

-- =============================================
-- 4. TASKS TABLE
-- =============================================
-- Main tasks table with full functionality
CREATE TABLE tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
    priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
    team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
    due_date timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================
-- 5. COMMENTS TABLE
-- =============================================
-- Comments on tasks
CREATE TABLE comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================
-- 6. MESSAGES TABLE
-- =============================================
-- Direct messages between users
CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- =============================================
-- 7. ATTACHMENTS TABLE
-- =============================================
-- File attachments for tasks
CREATE TABLE attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_url text NOT NULL,
    file_size bigint,
    created_at timestamptz DEFAULT now()
);

-- =============================================
-- 8. TASK HISTORY TABLE
-- =============================================
-- Audit trail for task changes
CREATE TABLE task_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    field_changed text NOT NULL,
    old_value text,
    new_value text,
    created_at timestamptz DEFAULT now()
);

-- =============================================
-- 9. NOTIFICATIONS TABLE
-- =============================================
-- System notifications for users
CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
    message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('comment', 'status', 'priority', 'assignment', 'message')),
    content text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
-- Profiles indexes
CREATE INDEX idx_profiles_role ON profiles(role);

-- Teams indexes
CREATE INDEX idx_teams_created_by ON teams(created_by);

-- Team members indexes
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- Tasks indexes
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_team_id ON tasks(team_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Comments indexes
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- Messages indexes
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_read ON messages(read);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Attachments indexes
CREATE INDEX idx_attachments_task_id ON attachments(task_id);
CREATE INDEX idx_attachments_user_id ON attachments(user_id);

-- Task history indexes
CREATE INDEX idx_task_history_task_id ON task_history(task_id);
CREATE INDEX idx_task_history_user_id ON task_history(user_id);
CREATE INDEX idx_task_history_created_at ON task_history(created_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_task_id ON notifications(task_id);
CREATE INDEX idx_notifications_message_id ON notifications(message_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
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

-- =============================================
-- RLS POLICIES
-- =============================================

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Teams policies
CREATE POLICY "Users can view teams they belong to or created" ON teams FOR SELECT USING (
    created_by = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_members.team_id = teams.id 
        AND team_members.user_id = auth.uid()
    )
);

CREATE POLICY "Admins and managers can create teams" ON teams FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('Администратор', 'Менеджер')
    )
);

CREATE POLICY "Team owners can update teams" ON teams FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_members.team_id = teams.id 
        AND team_members.user_id = auth.uid() 
        AND team_members.role = 'owner'
    )
);

CREATE POLICY "Team owners can delete teams" ON teams FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_members.team_id = teams.id 
        AND team_members.user_id = auth.uid() 
        AND team_members.role = 'owner'
    )
);

-- Team members policies
CREATE POLICY "Users can view team members of their teams" ON team_members FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM team_members tm 
        WHERE tm.team_id = team_members.team_id 
        AND tm.user_id = auth.uid()
    )
);

CREATE POLICY "Team owners can manage team members" ON team_members FOR ALL USING (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE teams.id = team_members.team_id 
        AND teams.created_by = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM team_members tm 
        WHERE tm.team_id = team_members.team_id 
        AND tm.user_id = auth.uid() 
        AND tm.role = 'owner'
    )
);

-- Tasks policies
CREATE POLICY "Users can view tasks they created, are assigned to, or in their teams" ON tasks FOR SELECT USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR
    EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_members.team_id = tasks.team_id 
        AND team_members.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update tasks they created, are assigned to, or in their teams" ON tasks FOR UPDATE USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR
    EXISTS (
        SELECT 1 FROM team_members 
        WHERE team_members.team_id = tasks.team_id 
        AND team_members.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete tasks they created" ON tasks FOR DELETE USING (created_by = auth.uid());

-- Comments policies
CREATE POLICY "Users can view comments on tasks they have access to" ON comments FOR SELECT USING (
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
            )
        )
    )
);

CREATE POLICY "Users can create comments on tasks they have access to" ON comments FOR INSERT WITH CHECK (
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
            )
        )
    )
);

-- Messages policies
CREATE POLICY "Users can view messages they sent or received" ON messages FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
);

CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update messages they received" ON messages FOR UPDATE USING (receiver_id = auth.uid());

-- Attachments policies
CREATE POLICY "Users can view attachments on tasks they have access to" ON attachments FOR SELECT USING (
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
            )
        )
    )
);

CREATE POLICY "Users can create attachments on tasks they have access to" ON attachments FOR INSERT WITH CHECK (
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
            )
        )
    )
);

-- Task history policies
CREATE POLICY "Users can view task history for tasks they have access to" ON task_history FOR SELECT USING (
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
            )
        )
    )
);

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'Работник');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to create notification on task assignment
CREATE OR REPLACE FUNCTION notify_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
        INSERT INTO notifications (user_id, task_id, type, content)
        VALUES (
            NEW.assigned_to,
            NEW.id,
            'assignment',
            'You have been assigned to task: ' || NEW.title
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for task assignment notifications
CREATE TRIGGER notify_on_task_assignment
    AFTER UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION notify_task_assignment();

-- Function to create notification on comment
CREATE OR REPLACE FUNCTION notify_task_comment()
RETURNS TRIGGER AS $$
DECLARE
    task_creator uuid;
    task_assignee uuid;
BEGIN
    -- Get task details
    SELECT created_by, assigned_to
    INTO task_creator, task_assignee
    FROM tasks
    WHERE id = NEW.task_id;

    -- Notify task creator if they're not the commenter
    IF task_creator != NEW.user_id THEN
        INSERT INTO notifications (user_id, task_id, type, content)
        VALUES (
            task_creator,
            NEW.task_id,
            'comment',
            'New comment on your task: ' || (SELECT title FROM tasks WHERE id = NEW.task_id)
        );
    END IF;

    -- Notify assignee if they exist and are not the commenter
    IF task_assignee IS NOT NULL AND task_assignee != NEW.user_id THEN
        INSERT INTO notifications (user_id, task_id, type, content)
        VALUES (
            task_assignee,
            NEW.task_id,
            'comment',
            'New comment on task assigned to you: ' || (SELECT title FROM tasks WHERE id = NEW.task_id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for comment notifications
CREATE TRIGGER notify_on_task_comment
    AFTER INSERT ON comments
    FOR EACH ROW EXECUTE FUNCTION notify_task_comment();

-- Function to create notification on message
CREATE OR REPLACE FUNCTION notify_message()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, message_id, type, content)
    VALUES (
        NEW.receiver_id,
        NEW.id,
        'message',
        'New message from ' || (SELECT full_name FROM profiles WHERE id = NEW.sender_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for message notifications
CREATE TRIGGER notify_on_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION notify_message();

-- Function to log task changes
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO task_history (task_id, user_id, field_changed, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'status', OLD.status, NEW.status);
    END IF;

    -- Log priority changes
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO task_history (task_id, user_id, field_changed, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'priority', OLD.priority, NEW.priority);
    END IF;

    -- Log assignment changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        INSERT INTO task_history (task_id, user_id, field_changed, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for task changes logging
CREATE TRIGGER log_task_changes
    AFTER UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION log_task_changes();

-- =============================================
-- SAMPLE DATA (OPTIONAL)
-- =============================================
-- Uncomment the following lines to insert sample data

/*
-- Insert sample teams
INSERT INTO teams (name, description, created_by) VALUES
('Development Team', 'Main development team', (SELECT id FROM profiles LIMIT 1)),
('Design Team', 'UI/UX design team', (SELECT id FROM profiles LIMIT 1));

-- Insert sample tasks
INSERT INTO tasks (title, description, status, priority, created_by, team_id) VALUES
('Implement user authentication', 'Add login and registration functionality', 'pending', 'high', (SELECT id FROM profiles LIMIT 1), (SELECT id FROM teams LIMIT 1)),
('Design new dashboard', 'Create wireframes for the new dashboard', 'in_progress', 'medium', (SELECT id FROM profiles LIMIT 1), (SELECT id FROM teams LIMIT 1));
*/
