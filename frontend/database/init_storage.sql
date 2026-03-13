-- 스토리지 버킷 생성 스크립트 (service_images)
-- Public 버킷으로 생성하여 인증 없이 읽기 가능하도록 설정

-- 1. 버킷 생성 (존재하지 않을 경우에만)
INSERT INTO storage.buckets (id, name, public)
VALUES ('service_images', 'service_images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS(Row Level Security) 정책 설정
-- 모든 사용자가 Storage 객체를 조회할 수 있도록 허용
CREATE POLICY "service_images_public_access" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'service_images');

-- 인증된 관리자(ADMIN)만 Storage 객체를 업로드, 수정, 삭제할 수 있도록 허용
CREATE POLICY "service_images_admin_upload" 
    ON storage.objects FOR INSERT 
    WITH CHECK (
        bucket_id = 'service_images' 
        AND EXISTS (SELECT 1 FROM public.users WHERE users.user_id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY "service_images_admin_update" 
    ON storage.objects FOR UPDATE 
    USING (
        bucket_id = 'service_images' 
        AND EXISTS (SELECT 1 FROM public.users WHERE users.user_id = auth.uid() AND users.role = 'ADMIN')
    );

CREATE POLICY "service_images_admin_delete" 
    ON storage.objects FOR DELETE 
    USING (
        bucket_id = 'service_images' 
        AND EXISTS (SELECT 1 FROM public.users WHERE users.user_id = auth.uid() AND users.role = 'ADMIN')
    );
