````
[System Core Prerequisite: 비파괴적 확장 및 회귀 방지]
[WARNING FOR ANTIGRAVITY]: 명시적으로 지시받은 파일과 대상 범위 내에서만 작업하고, 구조 충돌 위험 발견 시 즉시 작업을 중단하고 보고하라.

## 작업 파일
- `src/app/admin/page.tsx`

---

### [작업 1] 상태 변수 추가

inquiries 상태 선언부 (156~165번 라인 근처) 아래에 아래 3개 상태를 추가한다.
```tsx
const [inquiriesPage, setInquiriesPage] = useState(1);
const [inquiriesTotalCount, setInquiriesTotalCount] = useState(0);
const [inquiryStatusUpdating, setInquiryStatusUpdating] = useState(false);
const INQUIRIES_PAGE_SIZE = 20;
```

---

### [작업 2] loadInquiries 함수 수정 — 페이지네이션 적용

현재 loadInquiries 함수 (527번 라인 근처)를 아래와 같이 교체한다.
기존 로직(필터, 카테고리, 검색, users 병합)은 모두 보존하고 페이지네이션만 추가한다.

변경 전:
```tsx
    const loadInquiries = useCallback(async () => {
        setInquiriesLoading(true);

        let q = supabase.from('inquiries').select('*');
        if (inquiriesFilter !== 'all') q = q.eq('status', inquiriesFilter);
        if (inquiriesCategory !== 'all') q = q.eq('category', inquiriesCategory);
        q = q.order('created_at', { ascending: false }).limit(200);

        const { data, error } = await q;
        if (error || !data) { setInquiriesLoading(false); return; }

        // users 별도 조회 후 클라이언트 병합
        const userIds = Array.from(new Set(data.map((d: any) => d.user_id).filter(Boolean)));
        let userMap: Record<string, any> = {};
        if (userIds.length > 0) {
            const { data: usersData } = await supabase
                .from('users')
                .select('user_id, name, nickname, phone')
                .in('user_id', userIds);
            (usersData || []).forEach((u: any) => { userMap[u.user_id] = u; });
        }

        const enriched = data.map((d: any) => ({
            ...d,
            users: userMap[d.user_id] || null,
        }));

        const filtered = inquiriesSearch.trim()
            ? enriched.filter((d: any) => {
                const keyword = inquiriesSearch.trim().toLowerCase();
                const nickname = (d.users?.nickname || '').toLowerCase();
                const name = (d.users?.name || '').toLowerCase();
                const email = (d.email || '').toLowerCase();
                return nickname.includes(keyword) || name.includes(keyword) || email.includes(keyword);
              })
            : enriched;
        setInquiries(filtered);
        setInquiriesLoading(false);
    }, [inquiriesFilter, inquiriesCategory, inquiriesSearch]);
```

변경 후:
```tsx
    const loadInquiries = useCallback(async (page = 1) => {
        setInquiriesLoading(true);

        // 1) 전체 카운트 조회 (페이지네이션용)
        let countQ = supabase.from('inquiries').select('id', { count: 'exact', head: true });
        if (inquiriesFilter !== 'all') countQ = countQ.eq('status', inquiriesFilter);
        if (inquiriesCategory !== 'all') countQ = countQ.eq('category', inquiriesCategory);
        const { count } = await countQ;
        setInquiriesTotalCount(count || 0);

        // 2) 페이지 데이터 조회
        const from = (page - 1) * INQUIRIES_PAGE_SIZE;
        const to = from + INQUIRIES_PAGE_SIZE - 1;
        let q = supabase.from('inquiries').select('*');
        if (inquiriesFilter !== 'all') q = q.eq('status', inquiriesFilter);
        if (inquiriesCategory !== 'all') q = q.eq('category', inquiriesCategory);
        q = q.order('created_at', { ascending: false }).range(from, to);

        const { data, error } = await q;
        if (error || !data) { setInquiriesLoading(false); return; }

        // 3) users 별도 조회 후 클라이언트 병합
        const userIds = Array.from(new Set(data.map((d: any) => d.user_id).filter(Boolean)));
        let userMap: Record<string, any> = {};
        if (userIds.length > 0) {
            const { data: usersData } = await supabase
                .from('users')
                .select('user_id, name, nickname, phone')
                .in('user_id', userIds);
            (usersData || []).forEach((u: any) => { userMap[u.user_id] = u; });
        }

        const enriched = data.map((d: any) => ({
            ...d,
            users: userMap[d.user_id] || null,
        }));

        // 4) 클라이언트 검색 필터 (닉네임/이메일)
        const filtered = inquiriesSearch.trim()
            ? enriched.filter((d: any) => {
                const keyword = inquiriesSearch.trim().toLowerCase();
                const nickname = (d.users?.nickname || '').toLowerCase();
                const name = (d.users?.name || '').toLowerCase();
                const email = (d.email || '').toLowerCase();
                return nickname.includes(keyword) || name.includes(keyword) || email.includes(keyword);
              })
            : enriched;

        setInquiries(filtered);
        setInquiriesPage(page);
        setInquiriesLoading(false);
    }, [inquiriesFilter, inquiriesCategory, inquiriesSearch]);
```

---

### [작업 3] 필터 변경 시 페이지 1로 리셋

inquiriesFilter, inquiriesCategory 변경 useEffect를 찾아서 수정한다.

현재 아래와 같은 useEffect가 있을 것이다 (876번 라인 근처):
```tsx
        if (tab === 'inquiries') loadInquiries();
```
이 라인을 아래로 교체한다:
```tsx
        if (tab === 'inquiries') { setInquiriesPage(1); loadInquiries(1); }
```

---

### [작업 4] 페이지네이션 UI 추가

테이블 아래, `</>` 닫는 태그 바로 위 (3342번 라인 근처)에 페이지네이션 UI를 추가한다.

변경 전:
```tsx
                        </>)}
                    </>)}
```
변경 후:
```tsx
                            {/* 페이지네이션 */}
                            {inquiriesTotalCount > INQUIRIES_PAGE_SIZE && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
                                    <span className="text-xs text-gray-500">
                                        총 {inquiriesTotalCount}건 · {inquiriesPage}p / {Math.ceil(inquiriesTotalCount / INQUIRIES_PAGE_SIZE)}p
                                    </span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => loadInquiries(inquiriesPage - 1)}
                                            disabled={inquiriesPage <= 1 || inquiriesLoading}
                                            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition"
                                        >← 이전</button>
                                        {Array.from({ length: Math.min(5, Math.ceil(inquiriesTotalCount / INQUIRIES_PAGE_SIZE)) }, (_, i) => {
                                            const totalPages = Math.ceil(inquiriesTotalCount / INQUIRIES_PAGE_SIZE);
                                            const startPage = Math.max(1, Math.min(inquiriesPage - 2, totalPages - 4));
                                            const p = startPage + i;
                                            if (p > totalPages) return null;
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => loadInquiries(p)}
                                                    disabled={inquiriesLoading}
                                                    className={`px-3 py-1.5 text-xs rounded transition ${p === inquiriesPage ? 'bg-blue-600 text-white font-bold' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                                                >{p}</button>
                                            );
                                        })}
                                        <button
                                            onClick={() => loadInquiries(inquiriesPage + 1)}
                                            disabled={inquiriesPage >= Math.ceil(inquiriesTotalCount / INQUIRIES_PAGE_SIZE) || inquiriesLoading}
                                            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition"
                                        >다음 →</button>
                                    </div>
                                </div>
                            )}
                        </>)}
                    </>)}
```

---

### [작업 5] 상태 전환 함수 추가

`handleSaveInquiryReply` 함수 아래에 아래 함수를 새로 추가한다.
```tsx
    const handleUpdateInquiryStatus = async (inquiryId: string, newStatus: 'pending' | 'in_progress' | 'resolved') => {
        setInquiryStatusUpdating(true);
        const { error } = await supabase
            .from('inquiries')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', inquiryId);
        if (error) {
            showToast('상태 변경에 실패했습니다.', 'error');
            setInquiryStatusUpdating(false);
            return;
        }
        // 로컬 상태 즉시 반영
        setInquiries(prev => prev.map(iq => iq.id === inquiryId ? { ...iq, status: newStatus } : iq));
        if (selectedInquiry?.id === inquiryId) {
            setSelectedInquiry((prev: any) => prev ? { ...prev, status: newStatus } : prev);
        }
        showToast('상태가 변경되었습니다.', 'success');
        setInquiryStatusUpdating(false);
    };
```

---

### [작업 6] 팝업 모달에 상태 전환 버튼 UI 추가

팝업 모달 하단 버튼 영역 (3436번 라인 근처, `닫기` 버튼 앞)에 상태 전환 버튼을 추가한다.

변경 전:
```tsx
                            <div className="p-5 border-t border-gray-700 flex justify-end gap-2 bg-gray-800/80 rounded-b-2xl">
                                <button onClick={() => { setSelectedInquiry(null); setReplyImages([]); setReplyImagePreviews([]); }} className="px-5 py-2.5 border border-gray-600 text-gray-300 hover:bg-gray-700 font-bold rounded-lg transition text-sm">닫기</button>
```
변경 후:
```tsx
                            <div className="p-5 border-t border-gray-700 flex justify-between items-center bg-gray-800/80 rounded-b-2xl">
                                {/* 상태 전환 버튼 그룹 */}
                                <div className="flex gap-2">
                                    {selectedInquiry.status !== 'pending' && (
                                        <button
                                            onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'pending')}
                                            disabled={inquiryStatusUpdating}
                                            className="px-3 py-2 text-xs bg-yellow-900/40 border border-yellow-700/50 text-yellow-300 hover:bg-yellow-800/60 disabled:opacity-40 font-bold rounded-lg transition"
                                        >접수대기로 변경</button>
                                    )}
                                    {selectedInquiry.status !== 'in_progress' && (
                                        <button
                                            onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'in_progress')}
                                            disabled={inquiryStatusUpdating}
                                            className="px-3 py-2 text-xs bg-blue-900/40 border border-blue-700/50 text-blue-300 hover:bg-blue-800/60 disabled:opacity-40 font-bold rounded-lg transition"
                                        >처리중으로 변경</button>
                                    )}
                                    {selectedInquiry.status !== 'resolved' && (
                                        <button
                                            onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'resolved')}
                                            disabled={inquiryStatusUpdating}
                                            className="px-3 py-2 text-xs bg-green-900/40 border border-green-700/50 text-green-300 hover:bg-green-800/60 disabled:opacity-40 font-bold rounded-lg transition"
                                        >답변완료로 변경</button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setSelectedInquiry(null); setReplyImages([]); setReplyImagePreviews([]); }} className="px-5 py-2.5 border border-gray-600 text-gray-300 hover:bg-gray-700 font-bold rounded-lg transition text-sm">닫기</button>
```

또한 닫기 버튼 이후 닫는 태그도 수정해야 한다.

변경 전 (닫기 버튼 다음 줄):
```tsx
                                {selectedInquiry.status !== 'resolved' && (
```
이 부분은 그대로 유지하되, 저장 버튼 블록 전체 이후에 아래 닫는 태그를 추가한다:
```tsx
                                </div>
                            </div>
```
즉 최종 하단 버튼 영역 구조는 아래와 같아야 한다:
```tsx
                            <div className="p-5 border-t border-gray-700 flex justify-between items-center bg-gray-800/80 rounded-b-2xl">
                                {/* 왼쪽: 상태 전환 버튼 */}
                                <div className="flex gap-2">
                                    {selectedInquiry.status !== 'pending' && ( ... 접수대기로 변경 버튼 ... )}
                                    {selectedInquiry.status !== 'in_progress' && ( ... 처리중으로 변경 버튼 ... )}
                                    {selectedInquiry.status !== 'resolved' && ( ... 답변완료로 변경 버튼 ... )}
                                </div>
                                {/* 오른쪽: 닫기 + 저장 버튼 */}
                                <div className="flex gap-2">
                                    <button ... 닫기 ... />
                                    {selectedInquiry.status !== 'resolved' && (
                                        <button ... 저장 및 답변 완료 처리 ... />
                                    )}
                                </div>
                            </div>
```

---

## 작업 완료 후
- 위 6개 작업 외 다른 코드 일절 수정 금지
- HISTORY.md 상단에 1줄 추가: [오늘날짜 / 1:1문의 페이지네이션 + 상태전환버튼 추가 / admin/page.tsx / DB변경없음]
- SYNC_STATE.md [Current Workflow] 비우기
- 완료 후 출력: "✅ 페이지네이션 + 상태전환 버튼 추가 완료. 디렉터님, 확인 후 다음 스텝을 지시해 주십시오."
````