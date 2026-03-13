import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your environment variables.');
}

// [핵심 수정] createClient(@supabase/supabase-js) → createBrowserClient(@supabase/ssr)
// 기존 createClient는 세션을 localStorage에 저장 → 미들웨어(쿠키 기반)와 세션 불일치 발생
// createBrowserClient는 세션을 쿠키에 저장 → 미들웨어와 세션 완전 동기화
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
