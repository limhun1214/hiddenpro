-- =========================================
-- 프로필 관리 기능: DB 마이그레이션 스크립트
-- users/pro_profiles 테이블에 nickname, avatar_url 추가
-- avatars 스토리지 버킷 생성
-- =========================================

-- 1) users 테이블에 닉네임(유니크)/아바타 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2) pro_profiles 테이블에 닉네임(유니크)/아바타 컬럼 추가
ALTER TABLE pro_profiles ADD COLUMN IF NOT EXISTS nickname TEXT UNIQUE;
ALTER TABLE pro_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3) avatars 스토리지 버킷 생성 (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 4) 스토리지 정책: 공개 읽기
CREATE POLICY "Avatar public read" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- 5) 스토리지 정책: 인증 유저 업로드
CREATE POLICY "Avatar auth upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 6) 스토리지 정책: 인증 유저 업데이트
CREATE POLICY "Avatar auth update" ON storage.objects
FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
