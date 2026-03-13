import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Service Role Key로 JWT app_metadata 직접 수정 (Admin API 전용)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
    try {
        const { targetUserId, newRole, requestingAdminId } = await request.json();

        // 1. 허용된 역할값 검증
        const allowedRoles = ['ADMIN', 'ADMIN_OPERATION', 'ADMIN_VIEWER', 'PRO', 'CUSTOMER'];
        if (!allowedRoles.includes(newRole)) {
            return NextResponse.json({ error: '허용되지 않은 역할값입니다.' }, { status: 400 });
        }

        // 2. 요청자가 ADMIN인지 DB에서 검증
        const { data: adminCheck, error: adminErr } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('user_id', requestingAdminId)
            .single();
        if (adminErr || adminCheck?.role !== 'ADMIN') {
            return NextResponse.json({ error: '최고 관리자만 승급 처리할 수 있습니다.' }, { status: 403 });
        }

        // 3. 본인 계정 강등 방지
        if (targetUserId === requestingAdminId && !['ADMIN'].includes(newRole)) {
            return NextResponse.json({ error: '본인 계정의 권한은 회수할 수 없습니다.' }, { status: 400 });
        }

        // 4. DB users.role 업데이트
        const { error: dbError } = await supabaseAdmin
            .from('users')
            .update({ role: newRole })
            .eq('user_id', targetUserId);
        if (dbError) {
            return NextResponse.json({ error: 'DB 업데이트 실패: ' + dbError.message }, { status: 500 });
        }

        // 5. JWT app_metadata 동기화 (핵심 — 재로그인 없이 즉시 반영)
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            targetUserId,
            { app_metadata: { role: newRole } }
        );
        if (authError) {
            return NextResponse.json({ error: 'JWT 동기화 실패: ' + authError.message }, { status: 500 });
        }

        // 6. 감사 로그 기록
        await supabaseAdmin.from('admin_action_logs').insert({
            target_user_id: targetUserId,
            admin_id: requestingAdminId,
            action_type: newRole === 'PRO' || newRole === 'CUSTOMER' ? 'DEMOTE_ADMIN' : 'PROMOTE_ADMIN',
            reason: `역할 변경: ${newRole}`,
        });

        return NextResponse.json({ success: true, newRole });

    } catch (e: any) {
        return NextResponse.json({ error: '서버 오류: ' + e.message }, { status: 500 });
    }
}
