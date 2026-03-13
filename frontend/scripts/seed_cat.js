const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const SERVICE_CATEGORIES = {
    "이사/청소": {
        "가사/메이드": [
            "파트타임 가사도우미",
            "요리 도우미",
            "육아/베이비시터"
        ],
        "집 청소": [
            "거주/정기 청소",
            "이사/입주 딥클리닝",
            "콘도/수영장 유지보수 청소",
            "소파/매트리스 딥클리닝"
        ],
        "에어컨 청소": [
            "창문형 에어컨 딥클리닝",
            "스플릿/벽걸이형 에어컨 딥클리닝",
            "상업용/시스템 에어컨 청소"
        ],
        "특수 청소 및 방역": [
            "흰개미 퇴치",
            "일반 해충 방역",
            "곰팡이/악취 제거"
        ],
        "이사 및 운송": [
            "용달/화물 운송",
            "가정이사",
            "사무실/상업공간 이사"
        ],
        "폐기물 처리": [
            "대형 폐기물 수거 및 처리"
        ]
    },
    "설치/수리": {
        "수도/배관": ["(긴급) 누수 및 수도관 수리", "워터펌프 및 압력탱크 수리", "변기/하수구 막힘 뚫기", "온수기 설치 및 수리"],
        "전기": ["(긴급) 전기 누전/단락 수리", "발전기 설치 및 수리", "전등/조명/배선 공사", "태양광 패널 설치 및 유지보수"],
        "가전/기기 수리": ["에어컨 고장 수리 및 프리온 충전", "냉장고/세탁기 수리", "TV 설치 (벽걸이 등)", "CCTV 및 보안기기 설치"],
        "문/창문 및 조립": ["방충망 맞춤 제작 및 시공", "열쇠/도어락 수리 및 교체", "가구 조립 및 배치"],
        "기타 수리": ["LPG 가스 배달 및 라인 점검"]
    },
    "인테리어/시공": {
        "종합 시공": ["주택 리모델링 및 증축", "콘도/아파트 인테리어", "상업공간/매장 인테리어"],
        "부분 시공": ["타일 및 바닥재 시공", "페인트 시공 (실내/외벽)", "목공 및 맞춤 가구 제작", "가벽/석고보드 시공", "지붕 공사 및 방수 시공"],
        "야외 시공": ["조경 및 정원 관리", "간판 제작 및 설치", "데크 및 펜스 시공"]
    },
    "비즈니스/외주": {
        "가상 비서 및 BPO": ["가상 비서", "CS/콜센터 아웃소싱", "텔레마케팅/영업 대행"],
        "행정/세무 대행": ["SEC/DTI 법인 및 사업자 등록 대행", "BIR 세무 기장 및 세금 신고", "비자/이민 서류 처리 대행", "각종 인허가 대행"],
        "번역/통역": ["타갈로그어 통번역", "비사야어 통번역", "영어 통번역", "기타 다국어 통번역"],
        "디자인/개발": ["로고/그래픽 디자인", "웹/앱 기획 및 개발", "영상 편집", "SNS 마케팅 및 페이지 관리"]
    },
    "이벤트/파티": {
        "행사 기획": ["데뷰 기획 및 스타일링", "세례식 기획", "생일/기념일 파티 기획", "웨딩 플래닝", "기업 행사/코퍼레이트 파티"],
        "음식 및 케이터링": ["통돼지구이 배달 및 케이터링", "파티 뷔페/음식 케이터링", "푸드 카트 렌탈", "맞춤 디자인 케이크 제작"],
        "대여/렌탈": ["비디오케 및 사운드 시스템 대여", "텐트/테이블/의자 대여", "파티 소품/포토부스 대여"],
        "촬영 및 섭외": ["스냅 사진 및 영상 촬영", "행사 진행자 섭외", "라이브 밴드/DJ/가수 섭외", "헤어 및 메이크업"]
    },
    "레슨/튜터링": {
        "어학 레슨": ["외국인 대상 영어 회화", "기초 타갈로그어/비사야어 레슨", "비즈니스 영어 튜터링"],
        "취업/직무 준비": ["BPO/콜센터 취업 준비", "가상 비서 실무 교육", "프로그래밍/코딩 레슨"],
        "시험 준비": ["IELTS / OET / TOEFL 준비", "PRC 보드 시험 준비"],
        "예체능/취미": ["수영 레슨", "댄스/줌바 레슨", "요리/베이킹 레슨", "피아노/기타/보컬 레슨"]
    }
};

async function run() {
    const client = new Client({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
    await client.connect();

    try {
        console.log("Adding depth1 and depth2 columns...");
        await client.query(`
      ALTER TABLE categories 
      ADD COLUMN IF NOT EXISTS depth1 TEXT,
      ADD COLUMN IF NOT EXISTS depth2 TEXT;
    `);

        console.log("Removing dummy foreign key mappings...");
        await client.query(`ALTER TABLE match_requests ALTER COLUMN category_id DROP NOT NULL;`);
        await client.query(`UPDATE match_requests SET category_id = NULL;`);
        await client.query(`UPDATE pro_profiles SET category_ids = '{}';`);

        console.log("Truncating dummy categories...");
        await client.query(`DELETE FROM categories WHERE 1=1;`);

        console.log("Seeding authentic SERVICE_CATEGORIES...");
        for (const [depth1, depth2Groups] of Object.entries(SERVICE_CATEGORIES)) {
            for (const [depth2, items] of Object.entries(depth2Groups)) {
                for (const itemName of items) {
                    await client.query(`
            INSERT INTO categories (name, depth1, depth2, base_price, is_active)
            VALUES ($1, $2, $3, 500, true)
            ON CONFLICT (name) DO UPDATE 
            SET depth1 = EXCLUDED.depth1, depth2 = EXCLUDED.depth2;
          `, [itemName, depth1, depth2]);
                }
            }
        }

        // Remap match_requests
        console.log("Remapping match_requests.category_id based on service_type...");
        await client.query(`
      UPDATE match_requests mr
      SET category_id = c.id
      FROM categories c
      WHERE mr.service_type = c.name;
    `);

        console.log("Postgrest Reloading schema cache...");
        await client.query("NOTIFY pgrst, 'reload schema'");

        console.log("Category SSOT Seeding Complete.");
    } catch (err) {
        console.error("DB Error:", err);
    } finally {
        await client.end();
    }
}
run();
