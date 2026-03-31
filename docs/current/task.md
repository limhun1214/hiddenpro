작업 요청: "How to Use the Service" 페이지 신규 생성 및 프로필 링크 연결

1. 작업 개요
   항목내용작업 유형신규 페이지 생성 + 기존 페이지 수정목적서비스 이용 가이드 페이지 신규 생성 및 프로필에서 링크 연결경로/support/how-to-use

2. 신규 파일 생성
   파일 경로: frontend/src/app/support/how-to-use/page.tsx
   tsx'use client';

import { useState } from 'react';

export default function HowToUseServicePage() {
const [activeTab, setActiveTab] = useState<'customer' | 'pro'>('customer');
const [openFaq, setOpenFaq] = useState<string | null>(null);

const toggleFaq = (id: string) => {
setOpenFaq(openFaq === id ? null : id);
};

return (

<div className="min-h-screen bg-gray-50 pb-20">
{/_ Hero Section _/}
<section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 text-white py-12 px-4">
<div className="max-w-4xl mx-auto text-center">
<h1 className="text-2xl md:text-3xl font-bold mb-2">
서비스 이용 가이드
</h1>
<p className="text-sm md:text-base opacity-90">
HiddenPro를 쉽고 빠르게 이용하는 방법을 알아보세요
</p>
</div>
</section>

      {/* What is HiddenPro */}
      <section className="py-8 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block bg-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-3">
              About
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">HiddenPro란?</h2>
            <p className="text-gray-500 text-sm">
              서비스가 필요한 고객과 전문가를 연결하는 매칭 플랫폼입니다
            </p>
          </div>

          {/* Platform Diagram */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-8">
            <div className="flex items-center justify-between gap-2">
              <div className="text-center flex-1">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl mx-auto mb-2">
                  👤
                </div>
                <div className="font-semibold text-sm">고객</div>
                <div className="text-xs opacity-80">서비스 요청</div>
              </div>
              <div className="text-xl opacity-60">→</div>
              <div className="text-center flex-1">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl mx-auto mb-2">
                  🔗
                </div>
                <div className="font-semibold text-sm">HiddenPro</div>
                <div className="text-xs opacity-80">매칭</div>
              </div>
              <div className="text-xl opacity-60">→</div>
              <div className="text-center flex-1">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl mx-auto mb-2">
                  💼
                </div>
                <div className="font-semibold text-sm">전문가</div>
                <div className="text-xs opacity-80">견적 발송</div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '✅', text: '무료 견적 요청' },
              { icon: '📊', text: '최대 5개 견적 비교' },
              { icon: '💬', text: '실시간 채팅' },
              { icon: '⭐', text: '검증된 리뷰' },
              { icon: '🔒', text: '안전한 매칭' },
              { icon: '💰', text: '수수료 없음' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                <span className="text-lg">{item.icon}</span>
                <span className="text-gray-700 text-xs font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* User Types */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <span className="inline-block bg-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-3">
              Users
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">이용자 유형</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-indigo-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white text-xl">
                  👤
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">고객 (Customer)</h3>
                  <p className="text-xs text-gray-500">서비스가 필요한 분</p>
                </div>
              </div>
              <div className="inline-block bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-lg mb-4">
                💰 완전 무료 이용
              </div>
              <ul className="space-y-2">
                {[
                  '간편한 서비스 요청',
                  '최대 5명 견적 비교',
                  '실시간 채팅 상담',
                  '서비스 대금 직접 지불',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-emerald-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center text-white text-xl">
                  💼
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">전문가 (Pro)</h3>
                  <p className="text-xs text-gray-500">서비스를 제공하는 분</p>
                </div>
              </div>
              <div className="inline-block bg-emerald-50 text-emerald-600 text-xs font-semibold px-3 py-1 rounded-lg mb-4">
                📈 비즈니스 성장 기회
              </div>
              <ul className="space-y-2">
                {[
                  'Credits로 견적 발송',
                  '프로필로 전문성 어필',
                  '리뷰 축적으로 신뢰도 상승',
                  '서비스 대금 100% 수령',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How to Use - Tabs */}
      <section className="py-8 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <span className="inline-block bg-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-3">
              How to Use
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">이용 방법</h2>
          </div>

          {/* Tabs */}
          <div className="flex justify-center gap-2 mb-8">
            <button
              onClick={() => setActiveTab('customer')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === 'customer'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              👤 고객 가이드
            </button>
            <button
              onClick={() => setActiveTab('pro')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === 'pro'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              💼 전문가 가이드
            </button>
          </div>

          {/* Customer Steps */}
          {activeTab === 'customer' && (
            <div className="space-y-4">
              {[
                { step: 1, title: '회원가입', desc: '소셜 로그인 또는 이메일로 가입 후 SMS 인증', icon: '📱' },
                { step: 2, title: '서비스 요청', desc: '카테고리 선택 → 챗봇 질문 답변 → 요청서 완성', icon: '📝' },
                { step: 3, title: '견적 비교', desc: '최대 5명의 전문가 견적을 비교하고 선택', icon: '📊' },
                { step: 4, title: '채팅 상담', desc: '선택한 전문가와 실시간 채팅으로 상세 상담', icon: '💬' },
                { step: 5, title: '매칭 확정', desc: '합의 완료 시 매칭 확정 버튼 클릭', icon: '🤝' },
                { step: 6, title: '리뷰 작성', desc: '서비스 이용 후 리뷰 작성으로 도움 주기', icon: '⭐' },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {item.step}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <span>{item.icon}</span> {item.title}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pro Steps */}
          {activeTab === 'pro' && (
            <div className="space-y-4">
              {[
                { step: 1, title: '전문가 전환', desc: '회원가입 후 전문가 정보 입력하여 전환', icon: '👔' },
                { step: 2, title: '프로필 작성', desc: '프로필 사진, 서비스 소개, 포트폴리오 등록', icon: '📋' },
                { step: 3, title: 'Credits 충전', desc: 'GCash, Maya 등으로 Credits 충전 (₱1 = 1 Credit)', icon: '💳' },
                { step: 4, title: '견적 발송', desc: '요청서 확인 후 견적 발송 (Credits 즉시 차감)', icon: '📤' },
                { step: 5, title: '채팅 상담', desc: '고객 선택 시 채팅방 개설, 상세 상담 진행', icon: '💬' },
                { step: 6, title: '서비스 제공', desc: '매칭 확정 후 서비스 제공, 대금 직접 수령', icon: '✅' },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {item.step}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <span>{item.icon}</span> {item.title}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Credits Section */}
      <section className="py-8 px-4 bg-gray-800 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <span className="inline-block bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
              Credits
            </span>
            <h2 className="text-xl md:text-2xl font-bold">Credits 안내</h2>
            <p className="text-gray-400 text-sm mt-2">견적 발송에 사용되는 디지털 유틸리티</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { icon: '➕', title: 'Top-up', desc: 'Credits 충전' },
              { icon: '💰', title: 'Available', desc: '보유 잔액' },
              { icon: '📜', title: 'History', desc: '사용 내역' },
              { icon: '🎁', title: 'Bonus', desc: '무상 지급' },
            ].map((item, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="font-semibold text-sm">{item.title}</div>
                <div className="text-xs text-gray-400">{item.desc}</div>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 bg-white/10 text-sm font-semibold">
              <div className="p-3 text-center">구분</div>
              <div className="p-3 text-center">💰 유상</div>
              <div className="p-3 text-center">🎁 무상</div>
            </div>
            {[
              { label: '획득 방법', paid: '직접 충전', bonus: '이벤트/보너스' },
              { label: '차감 순서', paid: '2순위', bonus: '1순위' },
              { label: '유효기간', paid: '없음', bonus: '30일' },
              { label: '출금 가능', paid: '✅ 가능', bonus: '❌ 불가' },
            ].map((row, idx) => (
              <div key={idx} className="grid grid-cols-3 text-sm border-t border-white/10">
                <div className="p-3 text-gray-300">{row.label}</div>
                <div className="p-3 text-center">{row.paid}</div>
                <div className="p-3 text-center">{row.bonus}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Refund Policy */}
      <section className="py-8 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <span className="inline-block bg-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-3">
              Refund
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">환불 정책</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Refundable */}
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                  ✓
                </div>
                <h3 className="font-bold text-emerald-700">자동 환불</h3>
              </div>
              <ul className="space-y-2">
                {[
                  '고객 미열람 상태에서 요청 취소',
                  '고객 미열람 상태에서 48시간 만료',
                  '다른 전문가 선택 시 미열람 견적',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-emerald-700">
                    <span className="mt-0.5">✅</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Non-refundable */}
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white">
                  ✕
                </div>
                <h3 className="font-bold text-red-700">환불 불가</h3>
              </div>
              <ul className="space-y-2">
                {[
                  '고객이 견적 열람 후 취소/만료',
                  '단순 변심으로 인한 충전 취소',
                  'Bonus Credits (현금화 불가)',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-red-700">
                    <span className="mt-0.5">❌</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <span className="inline-block bg-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-3">
              FAQ
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">자주 묻는 질문</h2>
          </div>

          <div className="space-y-3">
            {[
              { id: 'faq1', q: '서비스 이용료가 있나요?', a: '고객은 완전 무료입니다. 전문가는 견적 발송 시 Credits가 차감됩니다.' },
              { id: 'faq2', q: '서비스 대금은 어떻게 지불하나요?', a: '전문가에게 직접 지불합니다. 현금, GCash, Maya 등 협의하여 결정하세요.' },
              { id: 'faq3', q: '견적은 몇 개까지 받을 수 있나요?', a: '요청서당 최대 5개의 견적을 받을 수 있습니다.' },
              { id: 'faq4', q: '고객이 선택 안 하면 Credits는?', a: '고객이 열람하지 않은 견적은 자동 환불됩니다. 열람된 견적은 환불되지 않습니다.' },
              { id: 'faq5', q: 'Bonus Credits도 출금되나요?', a: '아니요, Bonus Credits는 출금 불가합니다. 플랫폼 내 사용만 가능합니다.' },
            ].map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleFaq(item.id)}
                  className="w-full flex justify-between items-center p-4 text-left"
                >
                  <span className="font-semibold text-gray-800 text-sm">{item.q}</span>
                  <span className={`text-gray-400 transition-transform ${openFaq === item.id ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {openFaq === item.id && (
                  <div className="px-4 pb-4 text-sm text-gray-600">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-8 px-4 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-2">도움이 필요하신가요?</h2>
          <p className="text-sm opacity-90 mb-6">고객센터로 언제든지 문의해 주세요</p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: '📱', title: '앱 내 문의', desc: '1:1 문의' },
              { icon: '📧', title: '이메일', desc: 'support@hiddenpro.ph' },
              { icon: '🕐', title: '운영시간', desc: '월-금 09:00-18:00' },
            ].map((item, idx) => (
              <div key={idx} className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="font-semibold text-xs">{item.title}</div>
                <div className="text-xs opacity-80">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>

);
}

3. 프로필 페이지 수정
   파일 경로: frontend/src/app/profile/page.tsx
   수정 내용: "How to Use the Service" 메뉴 항목의 링크를 새 페이지로 변경
   tsx// 기존 코드에서 "How to Use the Service" 링크 부분을 찾아서 수정

// 변경 전 (예시)

<Link href="/support/customer/guide">
  How to Use the Service
</Link>

// 변경 후

<Link href="/support/how-to-use">
  How to Use the Service
</Link>
또는 router.push 사용 시:
tsx// 변경 전
router.push('/support/customer/guide');

// 변경 후
router.push('/support/how-to-use');

4. 번역 파일 추가 (선택사항)
   i18n 적용이 필요한 경우:
   파일 경로: frontend/messages/en.json 및 frontend/messages/ko.json
   json// en.json에 추가
   {
   "HowToUse": {
   "title": "How to Use the Service",
   "subtitle": "Learn how to use HiddenPro easily",
   "aboutTitle": "What is HiddenPro?",
   // ... 추가 키
   }
   }

// ko.json에 추가
{
"HowToUse": {
"title": "서비스 이용 가이드",
"subtitle": "HiddenPro를 쉽고 빠르게 이용하는 방법을 알아보세요",
"aboutTitle": "HiddenPro란?",
// ... 추가 키
}
}

5. 체크리스트

frontend/src/app/support/how-to-use/page.tsx 파일 생성
프로필 페이지에서 링크 /support/how-to-use로 변경
로컬에서 페이지 정상 렌더링 확인
모바일/데스크톱 반응형 확인
탭 전환(고객/전문가) 동작 확인
FAQ 아코디언 동작 확인

✅ 위 계획대로 진행할까요? "OK"를 입력하시면 코딩을 시작합니다.
