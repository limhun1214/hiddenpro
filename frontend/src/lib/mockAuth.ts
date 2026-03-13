/**
 * Mock 인증 유틸리티
 * 
 * QA 테스트 단계용 — 실제 SMS/OAuth API 없이 DB 상태만 변경합니다.
 * 추후 실제 API 교체 시 이 파일의 함수 내부만 수정하면 됩니다.
 * 
 * [핵심] QA 단계이므로 모든 입력값은 무조건 통과(Mock) 시킵니다.
 *        형식 검사 절대 하지 않습니다.
 */
import { supabase } from './supabase';

/**
 * [고객용] 휴대폰 인증 Mock
 * users 테이블의 is_phone_verified = true 업데이트
 * phone 컬럼이 없어도 에러가 나지 않도록 is_phone_verified만 업데이트
 */
export async function mockVerifyCustomerPhone(userId: string, phone: string) {
    // ── 1계정 1번호 정책: 중복 전화번호 차단 ──
    const normalizedPhone = phone.replace(/[\s\-]/g, '');

    // users 테이블에서 동일 번호를 가진 다른 계정 검색
    const { data: existingUser } = await supabase
        .from('users')
        .select('user_id')
        .eq('phone', normalizedPhone)
        .neq('user_id', userId)
        .limit(1);

    // pro_profiles 테이블에서도 동일 번호 검색
    const { data: existingPro } = await supabase
        .from('pro_profiles')
        .select('pro_id')
        .eq('phone', normalizedPhone)
        .neq('pro_id', userId)
        .limit(1);

    if ((existingUser && existingUser.length > 0) || (existingPro && existingPro.length > 0)) {
        throw new Error('이 전화번호는 이미 다른 계정에서 인증되었습니다. 1개의 번호로 1개의 계정만 인증할 수 있습니다.');
    }

    // 먼저 is_phone_verified + phone 둘 다 업데이트 시도
    const { error } = await supabase
        .from('users')
        .update({ is_phone_verified: true, phone: normalizedPhone })
        .eq('user_id', userId);

    if (error) {
        // phone 컬럼이 없을 수 있으므로, is_phone_verified만 재시도
        const { error: retryError } = await supabase
            .from('users')
            .update({ is_phone_verified: true })
            .eq('user_id', userId);

        if (retryError) {
            throw new Error('[DB 에러] 고객 휴대폰 인증 DB 업데이트 실패: ' + retryError.message);
        }
    }
    return true;
}

/**
 * [고수용] 전화번호 인증 Mock
 * pro_profiles 테이블의 is_phone_verified = true 업데이트
 * phone 컬럼이 없어도 에러가 나지 않도록 fallback 처리
 */
export async function mockVerifyProPhone(proId: string, phone: string) {
    // ── 1계정 1번호 정책: 중복 전화번호 차단 ──
    const normalizedPhone = phone.replace(/[\s\-]/g, '');

    // pro_profiles 테이블에서 동일 번호를 가진 다른 계정 검색
    const { data: existingPro } = await supabase
        .from('pro_profiles')
        .select('pro_id')
        .eq('phone', normalizedPhone)
        .neq('pro_id', proId)
        .limit(1);

    // users 테이블에서도 동일 번호 검색
    const { data: existingUser } = await supabase
        .from('users')
        .select('user_id')
        .eq('phone', normalizedPhone)
        .neq('user_id', proId)
        .limit(1);

    if ((existingPro && existingPro.length > 0) || (existingUser && existingUser.length > 0)) {
        throw new Error('이 전화번호는 이미 다른 계정에서 인증되었습니다. 1개의 번호로 1개의 계정만 인증할 수 있습니다.');
    }

    // 먼저 is_phone_verified + phone 둘 다 업데이트 시도
    const { error } = await supabase
        .from('pro_profiles')
        .update({ is_phone_verified: true, phone: normalizedPhone })
        .eq('pro_id', proId);

    if (error) {
        // phone 컬럼이 없을 수 있으므로, is_phone_verified만 재시도
        const { error: retryError } = await supabase
            .from('pro_profiles')
            .update({ is_phone_verified: true })
            .eq('pro_id', proId);

        if (retryError) {
            throw new Error('[DB 에러] 고수 전화번호 인증 DB 업데이트 실패: ' + retryError.message);
        }
    }
    return true;
}

/**
 * [고수용] Facebook URL 연동 Mock
 * pro_profiles 테이블의 facebook_url 업데이트
 * [핵심] QA 단계 — 형식 검사 절대 하지 않음. 아무 값이든 무조건 통과.
 */
export async function mockLinkFacebook(proId: string, url: string) {
    // 형식 검사 없이 무조건 DB에 저장
    const { error } = await supabase
        .from('pro_profiles')
        .update({ facebook_url: url })
        .eq('pro_id', proId);

    if (error) {
        throw new Error('[DB 에러] Facebook 연동 DB 업데이트 실패: ' + error.message);
    }
    return true;
}

/**
 * [고객용] 휴대폰 인증 상태 확인
 */
export async function checkCustomerPhoneVerified(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('users')
        .select('is_phone_verified')
        .eq('user_id', userId)
        .single();

    if (error || !data) return false;
    return data.is_phone_verified === true;
}
