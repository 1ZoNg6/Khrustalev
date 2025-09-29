export type UserRole = 'Администратор' | 'Менеджер' | 'Работник';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type NotificationType = 'comment' | 'status' | 'priority' | 'assignment' | 'message';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  assigned_to: string | null;
  team_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  assigned_to_profile?: Profile;
  created_by_profile?: Profile;
  team?: Team;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;

  // Joined fields
  user_profile?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;

  // Joined fields
  sender_profile?: Profile;
  receiver_profile?: Profile;
}

export interface Attachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size?: number;
  created_at: string;

  // Joined fields
  user_profile?: Profile;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  user_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;

  // Joined fields
  user_profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  task_id: string | null;
  message_id: string | null;
  type: NotificationType;
  content: string;
  read: boolean;
  created_at: string;

  // Joined fields
  task?: Task;
  message?: Message;
}