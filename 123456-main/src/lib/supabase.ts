import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

// Force the correct Supabase configuration
const supabaseUrl = 'https://coroqcjsazhfmwabfece.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcm9xY2pzYXpoZm13YWJmZWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNTU2MjEsImV4cCI6MjA3NDYzMTYyMX0.R0STabfPspiwD4IzhFgNmkALhEJdpdgPYxzHPyQmcEc';

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key configured:', !!supabaseAnonKey);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    },
    global: {
        headers: {
            'X-Client-Info': 'task-management-app'
        }
    }
});