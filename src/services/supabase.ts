import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Connection test function
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('dummy')
      .select('*')
      .limit(1);
    
    // If we get a "relation does not exist" error, connection is working
    if (error?.code === 'PGRST116') {
      console.log('✅ Supabase connection successful');
      return true;
    }
    
    // If we get data or no error, connection is working
    if (!error || data !== null) {
      console.log('✅ Supabase connection successful');
      return true;
    }
    
    console.error('❌ Supabase connection error:', error);
    return false;
  } catch (err) {
    console.error('❌ Supabase connection failed:', err);
    return false;
  }
}