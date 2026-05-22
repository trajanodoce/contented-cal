import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://riizkhddtaacmcymbeqo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpaXpraGRkdGFhY21jeW1iZXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjYwMzUsImV4cCI6MjA5NDkwMjAzNX0.Z_Y4iaSoXWeahixT3uR7kpIJqhEu73mTGXOImSaLjM8';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
