[CRITICAL WARNING - 절대 준수 사항]
============================================
⛔ 이 지시문에 명시된 부분 외 어떠한 코드도 절대 수정하지 말 것
⛔ 스크립트 실행 금지
⛔ 정규식 일괄 치환 금지
⛔ 리팩토링 금지
⛔ "더 나은 방법"으로 개선 시도 금지
⛔ 위반 시 즉시 작업 중단 후 디렉터님께 보고할 것
============================================
[System Core Prerequisite: 비파괴적 확장 및 회귀 방지]
[WARNING FOR ANTIGRAVITY]: 명시적으로 지시받은 파일과 대상 범위 내에서만 작업하고, 구조 충돌 위험 발견 시 즉시 작업을 중단하고 보고하라.

## 작업 대상
frontend/src/app/page.tsx
frontend/messages/en.json
frontend/messages/ko.json

---

## STEP 1: frontend/messages/en.json 에 키 추가
기존 JSON 최하단 닫는 } 바로 앞에 아래 항목 추가:

  "landing": {
    "suspendedTitle": "Your account has been suspended by an admin.",
    "suspendedContact": "Contact: support@hiddenpro.kr",
    "withdrawnTitle": "Your account has been successfully deleted.",
    "withdrawnSub": "Thank you for using HiddenPro.",
    "proSignupBtn": "Join as Pro",
    "loginAriaLabel": "Login",
    "heroTitle1": "Philippines #1 Home Service,",
    "heroTitle2": "Meet the Perfect Professional.",
    "heroSubtitle": "Check real reviews from verified pros,\nand transact safely.",
    "searchPlaceholder": "What service do you need?",
    "searching": "Searching...",
    "noResults": "Can't find the service you're looking for?\nYour search term will be forwarded to our team for service expansion.",
    "recommendedServices": "🔥 Recommended Services",
    "collapseServices": "Collapse ∧",
    "viewAllServices": "View All Services",
    "trustBadge": "100% Identity Verified",
    "floatingReview": "Kind and perfect!",
    "floatingBooking": "Booking complete in 3 minutes",
    "reviewSectionTitle": "Live Customer Reviews",
    "reviewSectionSub": "Real reviews from customers just completed.",
    "loadingReviews": "Loading live data...",
    "noReviews": "No reviews yet. Be the first to leave one!",
    "anonymousCustomer": "Anonymous",
    "defaultService": "Home Service",
    "profileAlt": "Profile",
    "whyTitle1": "Philippines #1 Matching,",
    "whyTitle2": "There's a Reason.",
    "whyDesc": "We cut the commission fees and deepened the trust.\nExperience the fastest and safest O2O platform chosen by 1M users.",
    "feature1Title": "100% Identity-Verified Masters",
    "feature1Desc": "All professionals have passed ID and contact verification. We've completely eliminated the anxiety of letting a stranger into your home.",
    "feature2Title": "Zero Commission, Transparent Payment",
    "feature2Desc": "HiddenPro charges absolutely zero commission. Trade directly and transparently through 1:1 chat between customer and pro.",
    "feature3Title": "First-Come-First-Served 5 Pros, Fatigue-Free Matching",
    "feature3Desc": "No more spam calls and messages. Compare only the top 5 verified pro quotes to save your precious time and money.",
    "proBannerTitle1": "Are you a professional?",
    "proBannerTitle2": "Meet new customers with",
    "proBannerDesc": "Find nearby jobs quickly and easily,\nand send quotes to the customers you want at a reasonable cost.",
    "proBannerBtn": "Start as a Pro",
    "loginTitle": "Login",
    "proSignupTitle": "Pro Sign Up",
    "signupTitle": "Sign Up",
    "proSignupDesc": "💰 Register as a professional and meet new customers",
    "proSignupDescSub": "Complete your profile after signing up to start sending quotes",
    "googleLogin": "Continue with Google",
    "facebookLogin": "Continue with Facebook",
    "termsAgreement": "By continuing, you agree to HiddenPro's",
    "termsLink": "Terms of Service",
    "privacyLink": "Privacy Policy",
    "termsAnd": "and",
    "socialLoginError": "Social login error: ",
    "hiddenProServiceFallback": "HiddenPro Service"
  }

---

## STEP 2: frontend/messages/ko.json 에 키 추가
기존 JSON 최하단 닫는 } 바로 앞에 아래 항목 추가:

  "landing": {
    "suspendedTitle": "관리자에 의해 이용이 정지된 계정입니다.",
    "suspendedContact": "문의: support@hiddenpro.kr",
    "withdrawnTitle": "탈퇴가 완료되었습니다.",
    "withdrawnSub": "그동안 HiddenPro를 이용해 주셔서 감사합니다.",
    "proSignupBtn": "고수 가입",
    "loginAriaLabel": "로그인",
    "heroTitle1": "필리핀 최고의 홈서비스,",
    "heroTitle2": "완벽한 전문가를 만나보세요.",
    "heroSubtitle": "전문가의 생생한 리뷰를 확인하고,\n안전하게 거래하세요.",
    "searchPlaceholder": "어떤 서비스가 필요하신가요?",
    "searching": "검색 중...",
    "noResults": "찾으시는 서비스가 없나요?\n해당 검색어는 담당팀에 전달되어 서비스 확장에 참고됩니다.",
    "recommendedServices": "🔥 추천 서비스",
    "collapseServices": "접기 ∧",
    "viewAllServices": "전체 서비스 보기",
    "trustBadge": "100% 신원 검증 완료",
    "floatingReview": "친절하고 완벽해요!",
    "floatingBooking": "3분 만에 예약 완료",
    "reviewSectionTitle": "실시간 생생한 리뷰",
    "reviewSectionSub": "방금 전까지 진행된 실제 고객들의 생생한 리뷰입니다.",
    "loadingReviews": "실시간 데이터를 불러오는 중...",
    "noReviews": "아직 등록된 리뷰가 없습니다. 첫 리뷰의 주인공이 되어보세요!",
    "anonymousCustomer": "익명 고객",
    "defaultService": "홈서비스",
    "profileAlt": "프로필",
    "whyTitle1": "필리핀 1위 매칭,",
    "whyTitle2": "이유가 있습니다.",
    "whyDesc": "수수료의 거품은 빼고, 신뢰의 깊이는 더했습니다.\n100만 유저가 선택한 가장 빠르고 안전한 O2O 플랫폼의 차이를 경험하세요.",
    "feature1Title": "100% 신원 검증 마스터",
    "feature1Desc": "모든 전문가는 신분증 및 연락처 인증을 통과한 안심 마스터들입니다. 낯선 사람을 부르는 불안감을 완벽하게 지웠습니다.",
    "feature2Title": "수수료 0원, 투명한 결제",
    "feature2Desc": "히든프로는 결제 중개 수수료를 단 1페소도 요구하지 않습니다. 고객과 고수 간의 1:1 채팅을 통해 투명하게 직거래하세요.",
    "feature3Title": "선착순 5명, 피로도 없는 매칭",
    "feature3Desc": "무분별한 알람과 연락은 그만. 가장 빠르고 검증된 상위 5명의 마스터 견적만 비교하여 고객님의 소중한 시간과 비용을 절약합니다.",
    "proBannerTitle1": "전문가이신가요?",
    "proBannerTitle2": "HiddenPro와 함께 새로운 고객을 만나보세요.",
    "proBannerDesc": "내 주변의 일거리를 가장 빠르고 편하게 확인하고\n원하는 고객에게 합리적인 비용으로 견적을 발송하세요.",
    "proBannerBtn": "고수로 시작하기",
    "loginTitle": "로그인",
    "proSignupTitle": "고수 가입",
    "signupTitle": "회원가입",
    "proSignupDesc": "💰 전문가로 등록하고 새로운 고객을 만나보세요",
    "proSignupDescSub": "가입 후 프로필을 완성하면 견적 발송이 가능합니다",
    "googleLogin": "Google로 계속하기",
    "facebookLogin": "Facebook으로 계속하기",
    "termsAgreement": "계속 진행하면 HiddenPro의",
    "termsLink": "이용약관",
    "privacyLink": "개인정보처리방침",
    "termsAnd": "및",
    "socialLoginError": "소셜 로그인 오류: ",
    "hiddenProServiceFallback": "HiddenPro 서비스"
  }

---

## STEP 3: frontend/src/app/page.tsx 수정

### 3-1. import 추가
import { useTranslations } from 'next-intl';

### 3-2. HomePage 컴포넌트 최상단에 추가
const t = useTranslations();

### 3-3. placeholderTexts 배열 교체
기존:
const placeholderTexts = [
"어떤 서비스 찾으세요?",
"에어컨 청소 맡겨보세요",
"가사도우미 구하기",
"출장 수리 전문가",
];
교체 후:
const placeholderTexts = [
"What service are you looking for?",
"Try AC cleaning",
"Find a housekeeper",
"On-site repair expert",
];
※ 이 배열은 UI 애니메이션용이므로 t() 없이 영어 직접 교체

### 3-4. categoryUI 객체 desc 값 영어로 직접 교체
"이사/청소": desc → 'Moving, Cleaning'
"설치/수리": desc → 'AC, Plumbing, Repair'
"인테리어/시공": desc → 'Remodeling, Construction'
"비즈니스/외주": desc → 'Translation, Design'
"이벤트/파티": desc → 'Event Planning, Catering'
"레슨/튜터링": desc → 'Language, Arts Lessons'

### 3-5. fallbackCategories desc 교체
`categoryUI[key]?.desc || ' HiddenPro 서비스'` → `categoryUI[key]?.desc || t('landing.hiddenProServiceFallback')`

### 3-6. handleSocialLogin alert 교체
`alert('소셜 로그인 오류: ' + error.message)` → `alert(t('landing.socialLoginError') + error.message)`

### 3-7. 정지/탈퇴 배너 교체
- `관리자에 의해 이용이 정지된 계정입니다.` p → `{t('landing.suspendedTitle')}`
- `문의: support@hiddenpro.kr` p → `{t('landing.suspendedContact')}`
- `탈퇴가 완료되었습니다.` p → `{t('landing.withdrawnTitle')}`
- `그동안 HiddenPro를 이용해 주셔서 감사합니다.` p → `{t('landing.withdrawnSub')}`

### 3-8. 헤더 버튼 교체
- `고수 가입` 버튼 → `{t('landing.proSignupBtn')}`
- `aria-label="로그인"` → `aria-label={t('landing.loginAriaLabel')}`

### 3-9. 히어로 섹션 교체
- `alt="HiddenPro 서비스 전문가"` → `alt="HiddenPro Service Professional"`
- `필리핀 최고의 홈서비스,` span → `{t('landing.heroTitle1')}`
- `완벽한 전문가를 만나보세요.` span → `{t('landing.heroTitle2')}`
- `전문가의 생생한 리뷰를 확인하고,<br /> 안전하게 거래하세요.` p → `{t('landing.heroSubtitle')}`
- `placeholder={animatedPlaceholder || '어떤 서비스가 필요하신가요?'}` → `placeholder={animatedPlaceholder || t('landing.searchPlaceholder')}`
- `검색 중...` div → `{t('landing.searching')}`
- `찾으시는 서비스가 없나요?...` div → `{t('landing.noResults')}`
- `🔥 추천 서비스` span → `{t('landing.recommendedServices')}`
- `접기 ∧` span → `{t('landing.collapseServices')}`
- `전체 서비스 보기` span → `{t('landing.viewAllServices')}`
- `100% 신원 검증 완료` span (플로팅 카드) → `{t('landing.trustBadge')}`
- `친절하고 완벽해요!` div → `{t('landing.floatingReview')}`
- `3분 만에 예약 완료` span → `{t('landing.floatingBooking')}`
- `alt="고수"` → `alt="Pro"`

### 3-10. 리뷰 섹션 교체
- `실시간 생생한 리뷰` h2 → `{t('landing.reviewSectionTitle')}`
- `방금 전까지 진행된 실제 고객들의 생생한 리뷰입니다.` p → `{t('landing.reviewSectionSub')}`
- `실시간 데이터를 불러오는 중...` span → `{t('landing.loadingReviews')}`
- `review.users?.nickname || review.users?.name || '익명 고객'` → `review.users?.nickname || review.users?.name || t('landing.anonymousCustomer')`
- `review.chat_rooms?.match_requests?.service_type || '홈서비스'` → `review.chat_rooms?.match_requests?.service_type || t('landing.defaultService')`
- `alt="프로필"` → `alt={t('landing.profileAlt')}`
- `.toLocaleDateString('ko-KR')` → `.toLocaleDateString('en-US')`
- `아직 등록된 리뷰가 없습니다...` div → `{t('landing.noReviews')}`

### 3-11. 신뢰도 섹션 교체
- `필리핀 1위 매칭,` → `{t('landing.whyTitle1')}`
- `이유가 있습니다.` span → `{t('landing.whyTitle2')}`
- `수수료의 거품은 빼고...` p → `{t('landing.whyDesc')}`
- `100% 신원 검증 마스터` h3 → `{t('landing.feature1Title')}`
- `모든 전문가는 신분증...` p → `{t('landing.feature1Desc')}`
- `수수료 0원, 투명한 결제` h3 → `{t('landing.feature2Title')}`
- `히든프로는 결제 중개...` p → `{t('landing.feature2Desc')}`
- `선착순 5명, 피로도 없는 매칭` h3 → `{t('landing.feature3Title')}`
- `무분별한 알람과...` p → `{t('landing.feature3Desc')}`

### 3-12. 고수 영입 배너 교체
- `전문가이신가요?` → `{t('landing.proBannerTitle1')}`
- `HiddenPro와 함께 새로운 고객을 만나보세요.` → `<span className="text-[#FFD335]">HiddenPro</span>{t('landing.proBannerTitle2').replace('HiddenPro', '')}`
  ※ 단순하게: `전문가이신가요?<br /><span>HiddenPro</span>와 함께 새로운 고객을 만나보세요.` 구조에서
  교체 후: `{t('landing.proBannerTitle1')}<br /><span className="text-[#FFD335]">HiddenPro</span> {t('landing.proBannerTitle2')}`
  단, ko.json의 proBannerTitle2는 `"와 함께 새로운 고객을 만나보세요."`, en.json은 `"with new customers."`로 수정
- `내 주변의 일거리를...` p → `{t('landing.proBannerDesc')}`
- `고수로 시작하기` span → `{t('landing.proBannerBtn')}`

### 3-13. 로그인/가입 모달 교체
- `authMode === 'login' ? '로그인' : authMode === 'pro_signup' ? '고수 가입' : '회원가입'` →
  `authMode === 'login' ? t('landing.loginTitle') : authMode === 'pro_signup' ? t('landing.proSignupTitle') : t('landing.signupTitle')`
- `💰 전문가로 등록하고 새로운 고객을 만나보세요` p → `{t('landing.proSignupDesc')}`
- `가입 후 프로필을 완성하면 견적 발송이 가능합니다` p → `{t('landing.proSignupDescSub')}`
- `Google로 계속하기` → `{t('landing.googleLogin')}`
- `Facebook으로 계속하기` → `{t('landing.facebookLogin')}`
- 약관 동의 p 교체:
  기존: `계속 진행하면 HiddenPro의 <span>이용약관</span> 및 <span>개인정보처리방침</span>에 동의하는 것으로 간주됩니다.`
  교체 후: `{t('landing.termsAgreement')} <span className="underline cursor-pointer">{t('landing.termsLink')}</span> {t('landing.termsAnd')} <span className="underline cursor-pointer">{t('landing.privacyLink')}</span>.`