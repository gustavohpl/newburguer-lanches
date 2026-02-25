import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

const supabaseUrl = `https://${projectId}.supabase.co`;

// Singleton — reutilizado em toda a aplicação
export const supabase = createClient(supabaseUrl, publicAnonKey);
