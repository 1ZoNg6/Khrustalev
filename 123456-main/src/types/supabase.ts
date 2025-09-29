export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    full_name: string
                    role: 'Администратор' | 'Менеджер' | 'Работник'
                    avatar_url: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    full_name: string
                    role?: 'Администратор' | 'Менеджер' | 'Работник'
                    avatar_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string
                    role?: 'Администратор' | 'Менеджер' | 'Работник'
                    avatar_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            teams: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    created_by: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    created_by: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    created_by?: string
                    created_at?: string
                    updated_at?: string
                }
            }
            tasks: {
                Row: {
                    id: string
                    title: string
                    description: string | null
                    status: 'pending' | 'in_progress' | 'completed'
                    priority: 'low' | 'medium' | 'high'
                    created_by: string
                    assigned_to: string | null
                    team_id: string | null
                    due_date: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    description?: string | null
                    status?: 'pending' | 'in_progress' | 'completed'
                    priority?: 'low' | 'medium' | 'high'
                    created_by: string
                    assigned_to?: string | null
                    team_id?: string | null
                    due_date?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    description?: string | null
                    status?: 'pending' | 'in_progress' | 'completed'
                    priority?: 'low' | 'medium' | 'high'
                    created_by?: string
                    assigned_to?: string | null
                    team_id?: string | null
                    due_date?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            comments: {
                Row: {
                    id: string
                    task_id: string
                    user_id: string
                    content: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    task_id: string
                    user_id: string
                    content: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    task_id?: string
                    user_id?: string
                    content?: string
                    created_at?: string
                    updated_at?: string
                }
            }
            messages: {
                Row: {
                    id: string
                    sender_id: string
                    receiver_id: string
                    content: string
                    read: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    sender_id: string
                    receiver_id: string
                    content: string
                    read?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    sender_id?: string
                    receiver_id?: string
                    content?: string
                    read?: boolean
                    created_at?: string
                }
            }
            attachments: {
                Row: {
                    id: string
                    task_id: string
                    user_id: string
                    file_name: string
                    file_type: string
                    file_url: string
                    file_size: number | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    task_id: string
                    user_id: string
                    file_name: string
                    file_type: string
                    file_url: string
                    file_size?: number | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    task_id?: string
                    user_id?: string
                    file_name?: string
                    file_type?: string
                    file_url?: string
                    file_size?: number | null
                    created_at?: string
                }
            }
            task_history: {
                Row: {
                    id: string
                    task_id: string
                    user_id: string
                    field_changed: string
                    old_value: string | null
                    new_value: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    task_id: string
                    user_id: string
                    field_changed: string
                    old_value?: string | null
                    new_value?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    task_id?: string
                    user_id?: string
                    field_changed?: string
                    old_value?: string | null
                    new_value?: string | null
                    created_at?: string
                }
            }
            notifications: {
                Row: {
                    id: string
                    user_id: string
                    task_id: string | null
                    message_id: string | null
                    type: 'comment' | 'status' | 'priority' | 'assignment' | 'message'
                    content: string
                    read: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    task_id?: string | null
                    message_id?: string | null
                    type: 'comment' | 'status' | 'priority' | 'assignment' | 'message'
                    content: string
                    read?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    task_id?: string | null
                    message_id?: string | null
                    type?: 'comment' | 'status' | 'priority' | 'assignment' | 'message'
                    content?: string
                    read?: boolean
                    created_at?: string
                }
            }
        }
    }
}