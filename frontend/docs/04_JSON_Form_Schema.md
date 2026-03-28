# HiddenPro MVP 동적 폼 JSON 표준 스키마 (04_JSON_Form_Schema)

## 📌 설계 목적 및 규칙

- **프론트엔드 UI 자동화:** 이 JSON 규격만 앱(Front-end)으로 내려주면, 앱은 카테고리가 10개든 100개든 하드코딩 없이 이 JSON을 읽고 자동으로 챗봇형 질문 화면(UI)을 렌더링해야 합니다.
- **백엔드 파싱 최적화:** 모든 카테고리의 요청서 응답(Answers)은 예외 없이 아래의 `question_type` 규격을 준수하여 `Match_Requests` 테이블의 `dynamic_answers` 컬럼에 저장되어야 합니다.

---

### 🧱 1. 동적 요청서 응답 저장 규격 (DB 저장용 JSONB)

고객이 챗봇 UI를 통해 질문에 답을 완료하고 제출할 때, 서버로 전송되어 DB에 저장되는 최종 데이터의 형태입니다. 배열(Array) 형태로 관리하여 질문의 순서를 보장합니다.

```json
[
  {
    "question_id": "q_001",
    "question_type": "SINGLE_CHOICE",
    "question_text": "어떤 청소 서비스를 원하시나요?",
    "answer": "이사/입주 청소"
  },
  {
    "question_id": "q_002",
    "question_type": "MULTI_CHOICE",
    "question_text": "추가로 필요한 옵션이 있나요? (중복 선택 가능)",
    "answer": ["새집 증후군 시공", "냉장고 내부 청소"]
  },
  {
    "question_id": "q_003",
    "question_type": "TEXT_INPUT",
    "question_text": "고수님께 전달할 특이사항을 적어주세요.",
    "answer": "오후 2시 이후에 방문 부탁드립니다. 집에 강아지가 있습니다."
  },
  {
    "question_id": "q_004",
    "question_type": "DATE_PICKER",
    "question_text": "서비스 희망일을 선택해주세요.",
    "answer": "2026-03-15"
  }
]
```
