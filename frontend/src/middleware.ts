import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 정적 파일 즉시 우회
    if (pathname.startsWith('/_next') || pathname.includes('.')) {
        return NextResponse.next();
    }

    const isProfileRoute = pathname.startsWith('/profile');
    const isAdminRoute = pathname.startsWith('/admin');
    const isChatRoute = pathname.startsWith('/chat');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isProProfileRoute = pathname.startsWith('/pro/') && uuidRegex.test(pathname.split('/')[2] || '');
    const isProRoute = pathname.startsWith('/pro/') && !isProProfileRoute;
    const isCustomerRoute = pathname.startsWith('/customer');
    const isProtectedRoute = isProfileRoute || isAdminRoute || isChatRoute || isProRoute || isCustomerRoute;

    if (!isProtectedRoute) {
        return NextResponse.next();
    }

    const response = NextResponse.next({ request: { headers: request.headers } });

    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return request.cookies.getAll(); },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            request.cookies.set(name, value);
                            response.cookies.set(name, value, options);
                        });
                    },
                },
            }
        );

        // getSession()은 네트워크 요청 없이 쿠키에서 JWT를 로컬 파싱만 수행 (O(1))
        const { data: { session } } = await supabase.auth.getSession();

        console.log('[MW_DEBUG]', pathname, 'session:', !!session, 'role:', session?.user?.user_metadata?.role || session?.user?.app_metadata?.role || 'NO_ROLE');

        if (!session) {
            const loginUrl = request.nextUrl.clone();
            loginUrl.pathname = '/';
            loginUrl.searchParams.set('login', 'true');
            return NextResponse.redirect(loginUrl);
        }

        const user = session.user;
        const role = String(user?.app_metadata?.role || user?.user_metadata?.role || 'CUSTOMER').toUpperCase();
        const status = String(user?.app_metadata?.status || user?.user_metadata?.status || 'ACTIVE').toUpperCase();

        if (status === 'SUSPENDED') {
            const suspUrl = request.nextUrl.clone();
            suspUrl.pathname = '/';
            suspUrl.searchParams.set('suspended', 'true');
            return NextResponse.redirect(suspUrl);
        }

        if (status === 'DELETED') {
            await supabase.auth.signOut();
            return NextResponse.redirect(new URL('/?withdrawn=true', request.url));
        }

        if (isAdminRoute && !['ADMIN', 'ADMIN_OPERATION', 'ADMIN_VIEWER'].includes(role)) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        if (isProRoute && role !== 'PRO' && role !== 'ADMIN') {
            return NextResponse.redirect(new URL('/', request.url));
        }

        if (role === 'CUSTOMER' && (isProRoute || isAdminRoute)) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        return response;

    } catch (e) {
        console.error('Middleware Crash:', e);
        return response;
    }
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/public|auth/callback|auth/complete|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
