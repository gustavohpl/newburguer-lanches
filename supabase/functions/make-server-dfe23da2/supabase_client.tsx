// ==========================================
// 🔌 SUPABASE CLIENT SINGLETON
// Usado pelas rotas de upload e storage
// ==========================================

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
