/*
  # Rebuild Task Management System

  1. Changes
    - Simplify tables structure
    - Add proper foreign key relationships
    - Add proper indexes
    - Update RLS policies
    - Fix notifications constraints

  2. Tables
    - tasks
    - comments
    - notifications
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS tasks;

-- Create tasks table
CREATE TABLE tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create comments table
CREATE TABLE comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('comment', 'status', 'priority', 'assignment')),
    content text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_task_id ON notifications(task_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Tasks policies
CREATE POLICY "Users can view tasks they created or are assigned to"
    ON tasks FOR SELECT
    USING (
        created_by = auth.uid()
        OR assigned_to = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can create tasks"
    ON tasks FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own tasks or if admin"
    ON tasks FOR UPDATE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can delete their own tasks or if admin"
    ON tasks FOR DELETE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Comments policies
CREATE POLICY "Users can view comments on tasks they have access to"
    ON comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = comments.task_id
            AND (
                tasks.created_by = auth.uid()
                OR tasks.assigned_to = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'manager')
                )
            )
        )
    );

CREATE POLICY "Users can create comments on tasks they have access to"
    ON comments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = task_id
            AND (
                tasks.created_by = auth.uid()
                OR tasks.assigned_to = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'manager')
                )
            )
        )
    );

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Function to update task's updated_at timestamp
CREATE OR REPLACE FUNCTION update_task_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating task's timestamp
CREATE TRIGGER update_task_timestamp
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_timestamp();

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
            'You have been assigned to a task: ' || NEW.title
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for task assignment notifications
CREATE TRIGGER notify_on_task_assignment
    AFTER UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_assignment();

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
            'New comment on your task'
        );
    END IF;

    -- Notify assignee if they exist and are not the commenter
    IF task_assignee IS NOT NULL AND task_assignee != NEW.user_id THEN
        INSERT INTO notifications (user_id, task_id, type, content)
        VALUES (
            task_assignee,
            NEW.task_id,
            'comment',
            'New comment on a task assigned to you'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for comment notifications
CREATE TRIGGER notify_on_task_comment
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_comment();
