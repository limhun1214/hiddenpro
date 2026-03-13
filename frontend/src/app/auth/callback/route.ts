import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const errorParam = requestUrl.searchParams.get('error');
    const errorDescription = requestUrl.searchParams.get('error_description');

    // [1] 인증 서버로부터 직접 전달된 에러 처리
    if (errorParam) {
        return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(errorDescription || errorParam)}`, request.url));
    }

    if (code) {
        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        // [2] 코드 교환 실패 시 에러와 함께 홈으로 리다이렉트
        if (exchangeError) {
            return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(exchangeError.message)}`, request.url));
        }

        // [3] 세션 교환 성공 → DB 처리 및 역할 라우팅은 /auth/complete에서 담당
        return NextResponse.redirect(new URL('/auth/complete', request.url));
    }

    // code 없는 경우 홈으로
    return NextResponse.redirect(new URL('/', request.url));
}
