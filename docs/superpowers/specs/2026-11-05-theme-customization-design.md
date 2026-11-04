# 테마 커스텀 설계

## 배경 / 목표

새 탭 화면의 모양을 사용자가 고를 수 있게 한다. **모드(라이트·다크·시스템) + 강조색 + 배경(단색·그라데이션·사진)**. 지금은 `packages/ui/src/theme.ts`의 고정 색 객체를 인라인 스타일로 직접 쓰고, 다크 모드·배경 개념이 없다.

UI는 시안(`docs/design/theme-custom-*.html`, 1~18차)을 거쳐 정했다. 이 문서는 시안 없이도 구현할 수 있게 그 결과를 옮겨 적는다.

## 정한 것

사용자가 고른 것:

- 범위: 모드 + 강조색 + 배경. 여는 곳은 **옆 패널**(열린 탭 패널 자리를 덮음).
- 저장: **tablign 계정 기준**(서버). 처음 기본 모드: **라이트**. 테마는 **한 사람에게 하나**(조직마다 다르지 않음).
- 강조색: '익숙한 앱 색' 9개 + 직접 고르기.
- 배경: 없음 · 단색 · 그라데이션 · 사진(+덮개). **화면 전체**에 깔고, 레일·사이드바·오른쪽 패널·컬렉션 판은 **투명도** 슬라이더만큼 비친다.
- 다크 모드에서 밝게 고른 배경: **고른 색 그대로** 쓴다(자동으로 어둡게 하지 않음).
- 그라데이션 편집: 미리보기에서 점을 끈다 + 직선·원형 고르기 옆 **한 줄 도구**(뒤집기 · 추가 · 빼기 | 초기화). 색을 잇는 선은 **점선**.
- 직접 고르기: 빠른 색 끝 **무지개 칸** → **칸 아래 팝오버**(색 판 + 색상 막대 + 색 코드 + 스포이드). 그라데이션 점을 끄는 동안에도 팝오버를 유지하고, 깜빡이지 않는다.
- 고른 색 표시: **하늘색 링**(`#4DABF7`), 칸에 바짝(틈 1.5px).
- UI 안에 안내·설명 문구를 넣지 않는다.

제 판단으로 정한 것(사용자가 따로 정하지 않음):

- 다크 색표는 아래 표의 값. 위험 빨강·초록은 다크에서 한 단계 밝힌다.
- 초기화('기본으로 되돌리기', 그라데이션 ↺)는 **색까지** 처음 값으로 되돌린다.
- 새 탭 첫 화면을 깜빡임 없이 그리려고 작은 설정은 `localStorage`에 캐시한다(동기로 읽음).
- 사진 예시는 확장에 넣는 일러스트 2장(산·바다).
- 링크 카드는 투명도와 상관없이 불투명.

## 1. 색 토큰

### 방식

`theme.ts`의 색 값을 CSS 변수 문자열로 바꾼다. 예: `accent: "var(--tb-accent)"`. 지금 430곳이 `theme.x`를 인라인 스타일에 그대로 끼우므로 호출부는 바뀌지 않는다. 모드를 바꿔도 다시 렌더할 필요 없이 변수만 갈아 끼운다.

- 순수 함수 `computeTokens(settings, systemDark): Record<string, string>`가 실제 색 표를 만든다.
- `applyTokens(map)`가 `document.documentElement.style`에 `--tb-*`를 쓴다. 앱 첫 렌더 전에 한 번 부른다.
- 반지름(`radius*`)·`iconFont`는 그대로 둔다.

### 토큰 표

라이트 값은 **지금 화면과 같아야 한다**(1단계에서 화면 변화 없음). 아래 새 토큰의 라이트 값은 지금 하드코딩된 값이다. 하드코딩 조사 결과에 따라 1단계 계획에서 목록을 확정한다.

| 토큰 | 라이트 | 다크 |
|---|---|---|
| bg | `#fcfcfd` | `#141619` |
| surface | `#ffffff` | `#1c1f24` |
| surface2 | `#f1f3f5` | `#262a30` |
| border | `#eaecef` | `#2a2e35` |
| borderCard | `#e9ebee` | `#30343b` |
| text | `#1f2430` | `#e8eaed` |
| textSub (새) | `#495057` | `#c4c9d0` |
| textMuted | `#868e96` | `#9aa0a8` |
| textFaint | `#adb5bd` | `#6b727b` |
| rail (새) | `#f5f6f8` | `#17191d` |
| railBox (새) | `#eef0f3` | `#24272d` |
| railBoxOn (새) | `#e2e6ec` | `#30343b` |
| divider (새) | `#e2e5ea` | `#2a2e35` |
| danger | `#e03131` | `#ff6b6b` |
| greenDeep | `#2f9e63` | `#51cf66` |
| shadow (새) | 지금 값 | `rgba(0,0,0,.55)` |
| overlay (새, 대화상자 뒤 dim) | 지금 값 | `rgba(0,0,0,.6)` |

강조색에서 계산하는 토큰:

- `accent`: 고른 색. 모드와 상관없이 같은 색.
- `accentWeak`: 라이트는 `accent`를 흰색에 9% 섞는다. 다크는 `surface`에 22% 섞는다.
- `accentInk`: `accentWeak` 위에서 4.5:1이 될 때까지 `accent`를 라이트는 `text`, 다크는 흰색 쪽으로 민 색. 선택된 스페이스 글자 등에 쓴다.
- `onAccent`: `accent` 위 흰 글자 대비가 4.5:1 이상이거나 `text`보다 나으면 흰색, 아니면 `#1f2430`. 채운 버튼 글자에 쓴다.
- `accentTint`(새): 지금 `#c9d4ff`·`#e4e9fd`·`#f5f7ff`처럼 강조색을 옅게 쓴 곳에 쓴다. 단계별 섞음 비율은 1단계 계획에서 지금 값과 맞춘다.

### 1단계에서 옮길 것

- 하드코딩된 **화면 색**(글자·테두리·바탕·그림자·dim, 약 120곳)을 위 토큰으로 바꾼다. 주요 파일: `OrgRail`, `OrgFormDialog`, `AuthScreen`, `TossEmojiPicker`, `ImportBookmarksDialog`, `NewTab`(끌기 카드), `OrgHeader`, `AddCollectionButton`, `CollectionMoreMenu`, `ExtSearchBar`, `OpenTabsPanel`, `Button`, `ColorGradientPicker`.
- 강조색을 직접 적은 곳(`#3b5bdb`, `rgba(59,91,219,…)`, `#c9d4ff` 계열 약 10곳)과 `AuthScreen`의 `${theme.accent}33` 덧붙이기를 바꾼다. `color-mix(in srgb, var(--tb-accent) 20%, transparent)`처럼 쓴다.
- **내용 색은 그대로 둔다:** 조직 아이콘 색·그라데이션 프리셋, 파비콘 대체 색, 구글 로고, 온보딩 일러스트, 색 판(ColorPicker) 그라데이션.
- 파일 맨 위에서 한 번 만드는 CSS 문자열(10곳)은 변수 문자열을 끼우므로 그대로 동작한다.
- 색 값을 직접 확인하던 테스트(`CollectionOnboarding.test.tsx`)를 고친다.

## 2. 저장하는 테마

```ts
type ThemeSettings = {
  v: 1;
  mode: "light" | "dark" | "system";                 // 처음: "light"
  accent: { preset: number } | { custom: string };   // 처음: { preset: 0 } (인디고)
  background: {
    kind: "none" | "solid" | "gradient" | "photo";   // 처음: "none"
    solid: string;                                    // hex, 처음 #E9E4FE
    gradient: {
      type: "linear" | "radial";
      points: [[number, number], [number, number]];  // 화면 %, 직선: 시작·끝 / 원형: 중심·크기 점
      stops: { color: string; pos: number }[];        // 2~4개, pos 0~100(시작→끝 비율)
    };
    photo: { source: "mountain" | "sea" | "upload"; path: string | null; veil: number }; // veil 0~80, 처음 35
  };
  glass: number;                                      // 0~80, 처음 30
};
```

- 배경 종류를 바꿔도 다른 종류의 값은 남는다(돌아오면 그대로).
- `normalizeTheme(json)`이 모르는 버전·빠진 값·범위 밖 값을 처음 값으로 채우고 잘라낸다. 서버·캐시에서 읽을 때 모두 거친다.
- 강조색 프리셋(순서대로): 인디고 `#3B5BDB` · 파랑 `#2563EB` · 하늘 `#0369A1` · 청록 `#0F766E` · 초록 `#15803D` · 주황 `#C2410C` · 분홍 `#DB2777` · 보라 `#7C3AED` · 슬레이트 `#475569`.
- 단색 빠른 색: `#E9E4FE #FEDFE2 #FFE1CF #CCF2E6 #D0EDFE #F4E7CC`.
- 그라데이션 빠른 색: `#BAC8FF #FFD8C2 #C3F0DC #FFC9DE #FFF0B3 #D0BCFF`.
- 그라데이션 처음 값:
  - 직선: 점 `(10,12)→(90,88)`, 색 `#BAC8FF 0` · `#FFD8C2 100`.
  - 원형: 중심 `(50,50)`, 크기 점 `(88,88)`.

### 서버

마이그레이션 `0025_user_settings.sql`:

- `user_settings(user_id uuid pk → auth.users on delete cascade, theme jsonb not null default '{}', updated_at timestamptz default now())`.
- RLS로 본인만 select·insert·update. `authenticated`에 권한을 준다.
  - `profiles`는 같은 스페이스 멤버도 읽을 수 있어서 쓰지 않는다.
- Storage 비공개 버킷 `backgrounds`. `storage.objects` 정책은 `bucket_id = 'backgrounds' and (storage.foldername(name))[1] = auth.uid()::text`일 때만 select·insert·update·delete.
- 원격 Supabase(ref `njteyuixwdsclsrpcvqt`)에 `db push`로 적용한다.

### 읽기·쓰기 흐름

1. 새 탭을 열면 `localStorage["tablign.theme"]`을 동기로 읽어 바로 `applyTokens`한다(없으면 처음 값). 사진은 `chrome.storage.local["tablign.themePhoto"]`의 줄인 사본(data URL)을 비동기로 읽어 깐다.
2. 로그인이 확인되면 `user_settings`를 읽는다. 캐시와 다르면 서버 값을 적용하고 캐시를 갱신한다. 서버 사진 경로가 캐시와 다르면 `download`해 표시하고, 줄인 사본으로 캐시한다.
3. 사용자가 바꾸면 즉시 적용하고 캐시에 쓴다. 0.5초 모아서 서버에 upsert한다.
4. 같은 기기의 다른 새 탭은 `storage` 이벤트로 따라 바뀐다.
5. 서버 저장이 실패하면 캐시 값은 둔다. 다음 변경이나 다음 새 탭에서 다시 보낸다. 충돌은 마지막에 저장한 쪽이 이긴다.
6. 로그인 전 화면(`AuthScreen`)도 캐시된 테마를 따른다.

다른 기기에서 바꾼 테마는 새 탭을 다시 열 때 반영된다(실시간 구독은 하지 않음).

## 3. 화면

### 여는 곳

- 조직 레일 아래 버튼 영역(받은 초대함 버튼 옆)에 **팔레트 버튼**을 둔다.
- 누르면 오른쪽 패널 자리가 **테마 패널**로 바뀐다. 패널이 접혀 있으면 펼치면서 바꾼다. 테마 패널의 ×를 누르면 열린 탭 패널로 돌아간다.
- `NewTab`에 `rightView: "tabs" | "theme"` 상태를 둔다. `AppShell`의 접힌 레일 문구('열린 탭 열기')는 prop으로 받는다.

### 패널 구성(위에서 아래로)

1. **모드:** 라이트 · 다크 · 시스템(세 칸 토글).
2. **강조색:** 9개 + 무지개 칸(직접 고르기). 5칸 × 2줄.
3. **배경:** 없음 · 단색 · 그라데이션 · 사진(네 칸 토글) 아래에 종류별 내용.
   - 단색: 빠른 색 6개 + 무지개 칸.
   - 그라데이션: 편집기(아래) + 빠른 색 6개 + 무지개 칸. 빠른 색·무지개 칸은 **고른 점**의 색을 바꾼다.
   - 사진: 예시 2장 + 올리기 칸, 덮개 슬라이더(0~80).
   - 배경이 '없음'이 아니면 맨 아래 **투명도** 슬라이더(0~80).
4. 아래 고정줄: **기본으로 되돌리기**.

안내·설명 문구는 넣지 않는다.

### 고른 색 표시

강조색·빠른 색·사진 칸 모두 `box-shadow: 0 0 0 1.5px var(--tb-surface), 0 0 0 3.5px #4DABF7`. 다른 테두리(열림 표시 등)를 겹쳐 그리지 않는다.

### 직접 고르기 팝오버

- 무지개 칸을 누르면 **그 칸 줄 바로 밑에** 떠서 아래 내용 위에 겹친다(내용을 밀지 않음). 꼬리가 누른 칸을 가리키고, 패널을 스크롤하면 같이 움직인다.
- 내용은 기존 `ColorPicker`(색 판 + 색상 막대 + 색 코드)에 **스포이드**를 더한다. 스포이드는 `EyeDropper`가 있을 때만 보인다.
- 열 때 패널 아래로 넘치면 그만큼 패널을 스크롤한다. 나타나는 움직임은 **열 때 한 번만**(다시 그릴 때 돌지 않음).
- 같은 칸을 다시 누르거나, 바깥을 누르거나, Esc를 누르면 닫힌다.
- 직접 고른 색이 빠른 색에 없으면 무지개 칸이 그 색으로 채워지고 링을 받는다.
- 그라데이션: 팝오버를 연 채 미리보기의 다른 점을 누르면 그 점의 색으로 바뀐다. **점을 끄는 동안에도 열려 있고**, 끄는 동안엔 미리보기와 배경만 다시 그려서 깜빡이지 않는다.

### 그라데이션 편집기

- **위 한 줄:** 직선·원형 토글 + 도구 막대(뒤집기 · 추가 · 빼기 | 초기화, 아이콘 + 마우스를 올리면 이름).
- **미리보기:** 패널 폭, 높이 170px. 화면 비율과 달라도 같은 모양이 되게 화면 기준 그라데이션을 늘려 그린다. 점은 화면 % 좌표.
  - 직선: 시작·끝 점. 원형: 중심 점 + 크기 점(점선 원).
  - 점끼리 잇는 선은 **흰 점선**(어두운 바탕선 위).
  - 선에서 14px 안쪽 빈 곳을 누르면 그 자리에 색이 생긴다(빠른 색 중 아직 안 쓴 색). 생기자마자 끌 수 있다. 최대 4색, 이웃과 5% 띄운다.
  - 끝점을 끌면 방향·길이가, 중간 점을 끌면 선 위 위치가 바뀐다. 누르기만 하면 그 점이 골라진다(링).
- **도구:**
  - 뒤집기: 색 순서를 거꾼다.
  - 추가: 가장 넓은 틈 가운데에 추가한다.
  - 빼기: 고른 색을 뺀다. 두 색이면 꺼진다.
  - 초기화: 지금 종류의 처음 값으로 되돌린다.
  - 지우기 키(⌫·Delete)도 고른 색을 뺀다. 입력 칸에 있을 땐 동작하지 않는다.
- **끝점을 빼면** 옆 색 자리까지 선을 줄여 모양을 유지한다. 원형 중심을 빼면 중심은 그대로 두고 옆 색이 새 중심 색이 된다.
- 직선↔원형을 바꾸면 점은 그 종류의 처음 자리로 간다(색은 유지).

### 배경 그리기

- `AppShell` 맨 바닥에 배경을 깐다(지금 `theme.bg` 자리).
  - 단색: 그 색.
  - 그라데이션: 위 계산.
  - 사진: `cover`. 덮개는 라이트면 흰색, 다크면 `rgba(12,14,18,·)`이고 덮개 값만큼 겹친다.
- 배경이 있으면 레일·사이드바·오른쪽 패널·컬렉션 판은 `--tb-pane`(그 판의 원래 바탕색을 `1 − glass/100` 불투명도로) + `backdrop-filter: blur(16px)`. 링크 카드는 불투명 `surface`.
- 배경 위에 바로 놓인 글자(스페이스 제목 등)는 배경 색들에 대해 지금 모드의 글자색이 4.5:1에 못 미치면 반대 모드 글자색으로 바꾼다.

### 사진 올리기

- 이미지 파일을 고르면 긴 쪽 2560px의 JPEG(품질 0.85)로 줄여 `backgrounds/{user_id}/{uuid}.jpg`에 올린다. 성공하면 설정의 `path`를 바꾸고 예전 파일을 지운다.
- 실패하면 예전 사진을 유지하고, 올리기 칸에 실패 상태(빨간 테두리 + 다시 시도)를 보인다.
- 캐시용 사본은 긴 쪽 1600px.

## 4. 구조

`packages/ui`(새):

- `themeTokens.ts`: `computeTokens`, 색 계산 도우미(섞기·대비·`readable`).
- `gradient.ts`: 그리기 문자열(`gradCss(G, box, viewport)`), `addStop`, `removeStop`, `flipStops`, `addInGap`, 처음 값. 순수 함수.
- `SwatchRow`: 색 칸 줄(링, 무지개 칸).
- `ColorPopover`: 칸 아래 팝오버(`ColorPicker` + 스포이드, 위치·꼬리·스크롤 맞춤).
- `GradientEditor`: 미리보기·점선·끌기·한 줄 도구·지우기 키.

`apps/extension`(새):

- `lib/themeSettings.ts`: 타입, `normalizeTheme`, 캐시 읽기·쓰기.
- `lib/useThemeSettings.ts`: 캐시 → 서버 동기화, 0.5초 모아 저장, `storage` 이벤트.
- `lib/backgroundPhoto.ts`: 줄이기·올리기·내려받기·지우기.
- `newtab/ThemePanel.tsx`: 패널 화면.
- `main.tsx`: 첫 렌더 전 캐시 테마 적용.
- `supabase/migrations/0025_user_settings.sql`.

기존 수정: `theme.ts`(변수 문자열), `AppShell`(배경·판·접힌 레일 문구), `OrgRail`(팔레트 버튼·레일 바탕 토큰), `NewTab`(`rightView`), `CollectionSection`(판 바탕), 하드코딩 색 파일들.

## 5. 단계

설계 문서는 하나, 계획·PR은 단계마다.

1. **토큰 기반:** `theme.ts` 변수화, `computeTokens`/`applyTokens`, 하드코딩 화면 색 이전. 라이트 고정이라 화면은 지금과 같아야 한다.
2. **테마 패널 + 모드 + 강조색 + 저장:** 팔레트 버튼, `rightView`, `ThemePanel`(모드·강조색), `SwatchRow`, `ColorPopover`, `user_settings` 마이그레이션, `useThemeSettings`, 캐시·첫 화면.
3. **배경:** 단색 · `GradientEditor` · 사진(버킷·올리기) · 화면 전체 판 · 투명도 · 배경 위 글자 뒤집기.

## 6. 오류 처리

- 서버 읽기 실패: 캐시로 계속 그린다. 저장 실패: 캐시 유지, 다음 기회에 재전송. 사용자에게 알리지 않는다.
- 잘못된 저장값: `normalizeTheme`이 처음 값으로 채운다.
- 사진 내려받기 실패: 캐시 사본으로 그리고, 그것도 없으면 배경 '없음'처럼 그린다(설정은 바꾸지 않음).
- 사진 올리기 실패: 위 '사진 올리기' 참고.

## 7. 테스트

- 단위:
  - `computeTokens`: 라이트 값이 지금 값과 같은지, 다크, 강조색 계산.
  - `gradient.ts`: 추가·빼기(끝점 줄이기 포함)·뒤집기·최대 4색·5% 간격·늘려 그리기.
  - `normalizeTheme`.
- 컴포넌트:
  - `ThemePanel`: 모드 전환, 강조색, 팝오버 열기·닫기·바깥·Esc, 무지개 칸 채움, 배경 종류 전환 시 값 유지, 투명도.
  - `GradientEditor`: 선 위 추가·끌기, 도구 넷, 지우기 키, 끄는 동안 팝오버 유지.
  - `OrgRail`: 팔레트 버튼으로 패널 전환.
- 훅: `useThemeSettings`는 supabase·chrome storage·localStorage를 흉내 낸다. 캐시 먼저 적용, 서버 값 반영, 0.5초 모아 저장, 실패 시 캐시 유지.
- 1단계는 라이트 화면이 그대로인지 직접 확인한다(주요 화면 스크린샷 비교).

## 범위 밖

조직별 테마, 이름 붙은 테마 저장, 다크용 파비콘, 서버 실시간 동기화, 다크에서 배경 자동으로 어둡게.
