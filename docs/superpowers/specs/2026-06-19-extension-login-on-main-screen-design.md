# 확장 프로그램 로그인을 메인 화면으로 이동

작성일: 2026-06-19

## 배경 / 목적

현재 tablign 확장 프로그램은 로그인을 **작은 팝업**(`apps/extension/src/popup/Popup.tsx`)의
이메일/비밀번호 폼에서 처리한다. 메인 화면(새 탭 override, `apps/extension/src/newtab/NewTab.tsx`)은
로그아웃 상태일 때 *"팝업(확장 아이콘)에서 로그인하면 여기에 컬렉션이 표시됩니다."* 라는
안내만 보여준다.

사용자는 로그인을 **팝업이 아니라 메인 화면에서** 직접 하길 원한다. 더 나아가 팝업 자체가
불필요하므로 제거하고, 로그인 방식은 웹앱처럼 **이메일/비밀번호 + 회원가입 + 구글 로그인**을
지원한다.

## 현재 구조 (조사 결과)

- **매니페스트**: `apps/extension/public/manifest.json` (vite가 `public/`을 `dist/`로 복사).
  MV3. `action.default_popup: "popup.html"`, `chrome_url_overrides.newtab: "newtab.html"`.
  `permissions: ["tabs", "storage"]`. 서비스워커 없음.
- **빌드**: `vite.config.ts`의 rollup `input`에 `popup`, `newtab` 두 HTML 엔트리.
  `entryFileNames: "assets/[name].js"`.
- **Supabase 클라이언트**: `apps/extension/src/lib/supabase.ts`.
  세션을 `chrome.storage.local`에 저장(커스텀 어댑터). `persistSession: true`,
  `autoRefreshToken: true`, `detectSessionInUrl: false`. OAuth 미설정.
- **팝업**: 로그아웃 시 `Login`(이메일/비밀번호) 폼, 로그인 시 컬렉션 선택 + "현재 탭 저장"
  + "이 창의 모든 탭을 새 컬렉션으로" + "로그아웃".
- **메인 화면(`NewTab.tsx`)**: `onAuthStateChange`로 세션 감지. `!session`이면 placeholder만
  렌더(라인 321-328). 로그인 상태면 사이드바 + 보드 + 오른쪽 `OpenTabsPanel`(열린 탭을 창별로
  보여주고 창 저장 / 탭 드래그).
- **웹앱 로그인 참고**: `apps/web/src/app/login/page.tsx` — 이메일/비번 로그인·가입 토글 +
  `signInWithOAuth({ provider: "google", redirectTo: .../auth/callback })`.
- **중요 사실**: `supabase/config.toml`에 `[auth.external.google]` 섹션이 **없다.**
  즉 로컬 Supabase에서 구글 provider가 활성화돼 있지 않아, 웹앱의 "Google로 계속" 버튼도
  로컬에선 실제로 동작하지 않을 가능성이 높다. 구글 로그인을 켜려면 별도 설정이 필요하다.

## 결정 사항

1. **팝업은 제거한다.** 확장 아이콘 클릭 시 메인 화면(새 탭)을 연다.
2. **로그인은 메인 화면에서** 한다 — 이메일/비밀번호 + 회원가입 + 구글.
3. **구글 로그인은 `chrome.identity`** 정식 방식으로 구현한다(웹앱의 리다이렉트 방식은 확장에서
   불가). 외부 설정(Supabase google provider + Google Cloud OAuth 자격증명)이 필요하며,
   이 설정은 단계별 안내 문서로 제공한다.
4. 팝업의 "현재 탭/모든 탭 저장" 기능은 이미 메인 화면 `OpenTabsPanel`(창 저장 + 탭 드래그)로
   대체돼 있어 기능 손실이 없다.

## 변경 상세

### A. 팝업 제거

- `public/manifest.json`
  - `action.default_popup` 삭제 (`default_title`은 유지)
  - `permissions`에 `"identity"` 추가
  - `background` 추가: `{ "service_worker": "assets/background.js", "type": "module" }`
  - 안정적 OAuth redirect URL을 위해 `"key"`(고정 확장 ID용 공개키) 추가
- `src/background.ts` 신규
  ```ts
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({});
  });
  ```
  빈 새 탭은 `chrome_url_overrides.newtab` 덕분에 `newtab.html`(메인 화면)으로 렌더된다.
- `vite.config.ts`: rollup `input`에서 `popup` 제거, `background: resolve(__dirname, "src/background.ts")`
  추가. 출력은 `assets/background.js`.
- 삭제: `apps/extension/popup.html`, `apps/extension/src/popup/`(`Popup.tsx`, `main.tsx`).

### B. 메인 화면 로그인 UI

- 신규 `src/newtab/AuthScreen.tsx` — 웹앱 `login/page.tsx`를 본뜨되 확장 supabase 클라이언트 사용:
  - 상태: `email`, `password`, `mode("signin"|"signup")`, `error`, `loading`
  - 이메일 제출: `mode === "signin" ? signInWithPassword : signUp`
  - 로그인/가입 토글 버튼
  - "Google로 계속" 버튼 → 아래 C의 `signInWithGoogle()`
  - 화면 중앙 정렬 카드 형태(메인 화면이 전체 페이지이므로 팝업보다 여유 있는 레이아웃)
- `NewTab.tsx`: `!session` 분기(라인 321-328 placeholder)를 `<AuthScreen />`로 교체.
  로그인 성공 시 기존 `onAuthStateChange`가 세션을 잡아 자동으로 보드 렌더 → 추가 작업 불필요.

### C. 구글 로그인 (chrome.identity)

`AuthScreen` 내부 함수:
```ts
async function signInWithGoogle() {
  const redirectTo = chrome.identity.getRedirectURL(); // https://<id>.chromiumapp.org/
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) { /* 에러 표시 */ return; }
  const resultUrl = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
  const code = new URL(resultUrl).searchParams.get("code");
  if (!code) { /* 에러 표시 */ return; }
  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) { /* 에러 표시 */ }
  // 성공 시 세션이 chrome.storage에 저장되고 onAuthStateChange가 발화
}
```
- supabase-js v2 기본 `flowType: "pkce"`이므로 `exchangeCodeForSession` 사용 가능.
  `detectSessionInUrl: false` 유지(수동 교환이므로 무방).
- `src/vite-env.d.ts` 또는 타입: `chrome.identity` 사용 위해 `@types/chrome`가 필요할 수 있음
  (현재 chrome.tabs/storage를 쓰므로 이미 존재할 가능성 높음 — 구현 시 확인).

### D. 외부 설정 (구현과 별개, 사용자 직접 입력 — 단계별 안내 제공)

1. **Google Cloud Console**
   - OAuth 2.0 클라이언트 ID 생성(유형: 웹 애플리케이션)
   - 승인된 리디렉션 URI: `http://127.0.0.1:54321/auth/v1/callback`
   - 클라이언트 ID / 시크릿 발급
2. **Supabase `config.toml`**
   - `[auth.external.google]` 활성화: `enabled = true`, `client_id`, `secret = "env(...)"`,
     `skip_nonce_check = true`(로컬 구글 로그인에 필요)
   - `additional_redirect_urls`에 확장 redirect(`https://<extension-id>.chromiumapp.org/`) 추가
   - `supabase stop && supabase start`로 재기동
3. **고정 확장 ID**
   - manifest `"key"`로 확장 ID 고정 → redirect URL을 미리 알 수 있음.
   - (개발 중에는 `chrome.identity.getRedirectURL()`를 콘솔에 찍어 확인 후 위 allow-list에 반영)

## 영향 없는 부분 (YAGNI)

- `packages/core` 쿼리, 웹앱 전체, DnD/정렬 로직, 사이드바/검색바 등은 변경하지 않는다.
- 이메일 확인(email confirmation) 플로우, 비밀번호 재설정 등은 이번 범위 밖.

## 테스트 / 검증

- 단위: 새 순수 로직이 적기 때문에 기존 vitest 스위트 유지. `AuthScreen`의 분기(로그인/가입 모드
  토글) 정도는 컴포넌트 테스트 고려.
- 수동:
  - 확장 로드 → 새 탭에서 `AuthScreen` 노출 확인
  - 이메일/비번 로그인·가입 동작 확인
  - 확장 아이콘 클릭 → 새 탭(메인 화면) 열림 확인 (팝업 안 뜸)
  - (설정 완료 후) 구글 로그인 → `launchWebAuthFlow` → 세션 저장 → 보드 렌더 확인
  - 로그아웃 후 다시 `AuthScreen`로 복귀 확인
- 빌드: `pnpm --filter @tablign/extension build`로 `assets/background.js` 생성 및 manifest 참조 확인.

## 리스크 / 주의

- 구글 OAuth는 외부 설정 의존이 커서, 설정 전에는 이메일/비번만 동작한다(설계상 의도된 상태).
- manifest `"key"` 변경 시 확장 ID가 바뀌면 redirect allow-list도 갱신 필요.
- 서비스워커를 vite 엔트리로 빌드할 때 ES 모듈 출력이므로 manifest의 `"type": "module"` 필수.
