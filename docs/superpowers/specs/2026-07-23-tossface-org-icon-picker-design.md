# 조직 아이콘 토스페이스(Tossface) 전환 · 커스텀 이모지 피커 설계

- 작성일: 2026-07-23
- 대상: `apps/extension` (새 탭)
- 관련 시안: 브라우저 시안(`tossface-mock.html`, 옵션 B) — 이 문서는 그 상태를 기준으로 한다.

## 1. 목표

조직(organization) 아이콘 이모지를 **토스페이스(Tossface)** 스타일로 표시하고, 아이콘을 고르는 피커를 **토스 이모지 전용 커스텀 피커**로 교체한다. emoji-mart 컴포넌트 의존을 걷어내되, 이모지 목록·검색어 데이터(`@emoji-mart/data`)는 재사용한다.

범위: **조직 아이콘만**. 사용자 프로필(이미지 아바타), 스페이스/컬렉션 아이콘은 이번 범위 밖.

## 2. 현재 구조 (요약)

- 조직 아이콘 = native 이모지 문자열 1개(`icon`) + 위치·크기(`icon_scale/x/y`). 저장 스키마 변경 없음.
- 렌더 3지점 모두 `<span>`에 이모지 텍스트 + `fontSize`:
  - `OrgRail.tsx:91` (32px), `OrgHeader.tsx:36` (28px), `OrgFormDialog.tsx:260` (44px)
  - 공통 스타일 헬퍼: `orgIcon.ts` `orgIconStyle()`
- 피커 = `OrgFormDialog.tsx`의 `@emoji-mart/react` `Picker` (native 세트) + 22개 언어 i18n 정적 import.
- 의존성: `@emoji-mart/data`, `@emoji-mart/react`, `emoji-mart`.

## 3. 설계

### 3.1 폰트 번들 (CSP·라이선스)

- 토스페이스 **woff2를 로컬 번들**로 포함(CDN 금지 — 확장 CSP 원칙 유지). `@font-face { font-family: "Tossface"; src: ... }`를 새 탭 전역 CSS에 추가.
- **원본 폰트 무변형** — 서브셋/변환 금지(라이선스). 풀 컬러 폰트를 그대로 동봉.
- **라이선스 전문 파일 동봉** + **출처 표시**: "토스팀에서 제공한 토스페이스"를 설정/정보 영역에 명시.
- 폰트 파일 취득은 별도 단계(다운로드는 사용자 승인 후). GitHub 릴리스/공식 배포본의 woff2 사용.

### 3.2 렌더 지점 — 폰트 적용

- `orgIcon.ts` `orgIconStyle()`에 `fontFamily: '"Tossface", <기존 시스템 이모지 스택>'` 추가.
  - 이 한 곳으로 레일·헤더·다이얼로그 프리뷰가 모두 토스로 바뀐다(세 지점 모두 `orgIconStyle` 사용).
- 폰트 스택에 토스를 **1순위**로 두어, 토스에 있는 글리프는 토스로, 없으면 시스템으로 자연 fallback.

### 3.3 커스텀 토스 피커 컴포넌트 (`TossEmojiPicker.tsx`)

시안 옵션 B 상태 그대로 구현. `OrgFormDialog`의 emoji-mart `Picker`(팝오버 내용)를 이 컴포넌트로 교체.

구성:
- **카테고리 탭** — `@emoji-mart/data`의 `categories` 순서. 각 탭 아이콘은 대표 토스 이모지. 클릭 시 해당 섹션으로 스크롤.
  - 한글 라벨 매핑(people/nature/foods/activity/places/objects/symbols/flags → 스마일리&사람/동물&자연/음식&음료/활동/여행&장소/사물/기호/깃발).
- **검색창** — `@emoji-mart/data`의 `keywords + name`(영문)으로 필터. (한글 검색은 별도 과제 — 4절.)
- **그리드** — 카테고리별 섹션 라벨(sticky) + 8열 그리드. 버튼 텍스트 = native 이모지, `font-family: Tossface`.
- **하단 미리보기** — hover/포커스한 이모지의 이모지 + 이름 표시.
- 접근성: 각 버튼 `aria-label`(이모지 이름), 검색 input `aria-label`, 키보드 포커스 이동.

**토스 커버 범위만 노출**: `@emoji-mart/data`의 emoji `version` 필드로 `version <= 14`(Unicode 14.0)만 포함 → fallback 섞임 없음. 모듈 스코프에서 한 번 구성.

### 3.4 무작위 기본 아이콘 풀

- `OrgFormDialog`의 `randomIcon()` 풀도 `version <= 14`로 추가 필터(현행 symbols/flags 제외 유지). 생성 시 기본 아이콘이 항상 토스로 렌더되도록.

### 3.5 emoji-mart 정리

- `@emoji-mart/react`, `emoji-mart` 의존성 및 `OrgFormDialog`의 22개 i18n import 제거.
- `@emoji-mart/data`는 **유지**(피커 데이터 소스).
- 프리셋 칩(🚀💡🎯🏢🌱🎨)·커스텀 슬롯·＋버튼·팝오버 위치(up/down) 로직은 그대로. 팝오버 내부만 새 피커로 교체.

### 3.6 테스트

- `NewTab.test.tsx`의 `@emoji-mart/react`·`@emoji-mart/data` 목을 새 피커에 맞게 갱신.
- `TossEmojiPicker` 단위 테스트: 카테고리 렌더, 검색 필터, `version<=14` 필터, 선택 콜백, hover 미리보기, 빈 결과 표시.
- TDD로 진행.

## 4. 범위 밖 / 후속

- **한글 검색**: `@emoji-mart/data` 검색어가 영문 → 한글 키워드 매핑은 별도 결정/과제.
- 스페이스/컬렉션 아이콘 토스화.
- 프로필(이미지 아바타)의 이모지화.

## 5. 리스크

- 컬러 폰트 파일 용량(수 MB) — 첫 렌더 폰트 로드. 새 탭 확장이라 감내 가능하나 로드 전 시스템 이모지가 잠깐 보일 수 있음(FOUT). `font-display` 조정 검토.
- 라이선스 준수(무변형·전문 동봉·출처) 이행 필요.
- 작은 크기(28~32px)에서 토스 글리프 가독성 — 시안에서 확인됨(양호), 필요 시 비율(0.57) 미세조정.
