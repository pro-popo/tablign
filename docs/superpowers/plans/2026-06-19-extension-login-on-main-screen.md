# 확장 프로그램 로그인을 메인 화면으로 이동 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 확장 프로그램의 로그인을 작은 팝업에서 제거하고, 메인 화면(새 탭)에서 이메일/비밀번호 + 회원가입 + 구글 로그인으로 처리한다.

**Architecture:** 팝업을 완전히 제거하고(매니페스트 `default_popup` 삭제 + 서비스워커로 아이콘 클릭 시 새 탭 열기), 메인 화면(`NewTab.tsx`)의 로그아웃 placeholder를 새 `AuthScreen` 컴포넌트로 교체한다. 구글 로그인은 `chrome.identity.launchWebAuthFlow` + Supabase PKCE 코드 교환으로 구현한다.

**Tech Stack:** Vite + React 18 + TypeScript, Chrome MV3 (manifest/service worker/identity), `@supabase/supabase-js` v2, Vitest + Testing Library.

---

## 참고 자료 (구현 전 읽을 것)

- 설계 문서: `docs/superpowers/specs/2026-06-19-extension-login-on-main-screen-design.md`
- 메인 화면: `apps/extension/src/newtab/NewTab.tsx` (로그아웃 분기는 라인 321-328)
- 제거 대상 팝업: `apps/extension/src/popup/Popup.tsx` (로그인 폼 라인 103-123 참고)
- 웹앱 로그인 참고: `apps/web/src/app/login/page.tsx`
- 확장 supabase 클라이언트: `apps/extension/src/lib/supabase.ts`
- 매니페스트(유일): `apps/extension/public/manifest.json`
- 빌드 설정: `apps/extension/vite.config.ts`
- 기존 컴포넌트 테스트 패턴: `apps/extension/src/newtab/OpenTabsPanel.test.tsx`

**검증된 환경 사실:**
- `@types/chrome`가 설치돼 있고 `apps/extension/tsconfig.json`의 `types`에 `"chrome"` 포함 → `chrome.identity` 타입 사용 가능.
- 매니페스트는 `public/manifest.json` 하나뿐 (vite가 `public/`을 `dist/`로 복사). 루트 `manifest.json`은 없음.
- 명령은 모노레포 루트에서 `pnpm --filter @tablign/extension <script>`로 실행. extension scripts: `dev`, `build`(`vite build`), `lint`(`tsc --noEmit`), `test`(`vitest run`).

---

## File Structure

| 파일 | 책임 | 작업 |
|---|---|---|
| `apps/extension/public/manifest.json` | MV3 매니페스트 | 수정(팝업 제거, identity/background 추가) |
| `apps/extension/src/background.ts` | 아이콘 클릭 → 새 탭 열기 | 생성 |
| `apps/extension/vite.config.ts` | 빌드 엔트리 | 수정(popup 제거, background 추가) |
| `apps/extension/popup.html` | 팝업 HTML | 삭제 |
| `apps/extension/src/popup/Popup.tsx` | 팝업 UI | 삭제 |
| `apps/extension/src/popup/main.tsx` | 팝업 엔트리 | 삭제 |
| `apps/extension/src/newtab/AuthScreen.tsx` | 메인 화면 로그인 UI | 생성 |
| `apps/extension/src/newtab/AuthScreen.test.tsx` | AuthScreen 테스트 | 생성 |
| `apps/extension/src/lib/oauth.ts` | 구글 OAuth 헬퍼(redirect 코드 파싱 포함) | 생성 |
| `apps/extension/src/lib/oauth.test.ts` | redirect 코드 파서 테스트 | 생성 |
| `apps/extension/src/newtab/NewTab.tsx` | 메인 화면 | 수정(placeholder → AuthScreen) |
| `supabase/config.toml` | 로컬 Supabase 설정 | 수정(google provider) |
| `docs/extension-google-oauth-setup.md` | 외부 설정 안내 | 생성 |

---

## Task 1: 팝업 제거 + 서비스워커로 아이콘 클릭 처리

**Files:**
- Create: `apps/extension/src/background.ts`
- Modify: `apps/extension/public/manifest.json`
- Modify: `apps/extension/vite.config.ts`
- Delete: `apps/extension/popup.html`, `apps/extension/src/popup/Popup.tsx`, `apps/extension/src/popup/main.tsx`

- [ ] **Step 1: 서비스워커 생성**

`apps/extension/src/background.ts`:
```ts
// 팝업을 제거했으므로, 확장 아이콘 클릭 시 빈 새 탭을 연다.
// 새 탭은 manifest의 chrome_url_overrides.newtab 덕분에 메인 화면(newtab.html)으로 렌더된다.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({});
});
```

- [ ] **Step 2: 매니페스트 수정**

`apps/extension/public/manifest.json` 전체를 아래로 교체:
```json
{
  "manifest_version": 3,
  "name": "tablign",
  "version": "0.0.1",
  "description": "시각적 북마크·탭 관리",
  "action": { "default_title": "tablign" },
  "background": { "service_worker": "assets/background.js", "type": "module" },
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "permissions": ["tabs", "storage", "identity"],
  "host_permissions": ["http://127.0.0.1:54321/*"]
}
```
변경점: `action.default_popup` 삭제, `background` 추가, `permissions`에 `"identity"` 추가.
(`"key"`는 구글 OAuth 설정 단계에서 다룬다 — Task 5 참고. 지금은 추가하지 않는다.)

- [ ] **Step 3: vite 빌드 엔트리 수정**

`apps/extension/vite.config.ts`의 `rollupOptions.input`을 아래로 교체:
```ts
      input: {
        newtab: resolve(__dirname, "newtab.html"),
        background: resolve(__dirname, "src/background.ts"),
      },
```
(`popup` 라인 제거, `background` 추가. 기존 `entryFileNames: "assets/[name].js"` 덕분에 `assets/background.js`로 출력됨.)

- [ ] **Step 4: 팝업 파일 삭제**

```bash
git rm apps/extension/popup.html apps/extension/src/popup/Popup.tsx apps/extension/src/popup/main.tsx
```

- [ ] **Step 5: 빌드해서 background.js 생성 및 popup 부재 확인**

Run: `pnpm --filter @tablign/extension build`
Expected: 빌드 성공. 확인:
```bash
ls apps/extension/dist/assets/background.js   # 존재해야 함
ls apps/extension/dist/popup.html             # "No such file" 여야 함
grep -c default_popup apps/extension/dist/manifest.json  # 0 이어야 함
```

- [ ] **Step 6: 타입 체크**

Run: `pnpm --filter @tablign/extension lint`
Expected: 에러 없음 (`tsc --noEmit` 통과).

- [ ] **Step 7: 커밋**

```bash
git add apps/extension/public/manifest.json apps/extension/vite.config.ts apps/extension/src/background.ts
git commit -m "feat(extension): 팝업 제거, 아이콘 클릭 시 메인 화면(새 탭) 열기"
```

---

## Task 2: AuthScreen 컴포넌트 (이메일/비밀번호 + 회원가입 토글)

**Files:**
- Create: `apps/extension/src/newtab/AuthScreen.tsx`
- Test: `apps/extension/src/newtab/AuthScreen.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/extension/src/newtab/AuthScreen.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthScreen } from "./AuthScreen";

// supabase 클라이언트 모킹: 로그인/가입 호출만 확인
const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
const signUp = vi.fn().mockResolvedValue({ error: null });
vi.mock("../lib/supabase", () => ({
  supabase: { auth: { signInWithPassword: (...a: unknown[]) => signInWithPassword(...a), signUp: (...a: unknown[]) => signUp(...a) } },
}));
// 구글 헬퍼 모킹(Task 3에서 실제 구현)
vi.mock("../lib/oauth", () => ({ signInWithGoogle: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => { signInWithPassword.mockClear(); signUp.mockClear(); });

describe("AuthScreen", () => {
  it("기본은 로그인 모드이고, 제출 시 signInWithPassword 호출", async () => {
    render(<AuthScreen />);
    fireEvent.change(screen.getByPlaceholderText("이메일"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("비밀번호"), { target: { value: "pw123456" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "pw123456" });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("가입 모드로 토글하면 제출 시 signUp 호출", async () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole("button", { name: "계정 만들기" }));
    fireEvent.change(screen.getByPlaceholderText("이메일"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("비밀번호"), { target: { value: "pw123456" } });
    fireEvent.click(screen.getByRole("button", { name: "가입" }));
    expect(signUp).toHaveBeenCalledWith({ email: "a@b.com", password: "pw123456" });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @tablign/extension test -- AuthScreen`
Expected: FAIL ("Cannot find module './AuthScreen'" 또는 컴포넌트 없음).

- [ ] **Step 3: AuthScreen 구현**

`apps/extension/src/newtab/AuthScreen.tsx`:
```tsx
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { signInWithGoogle } from "../lib/oauth";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    // 성공 시 NewTab의 onAuthStateChange가 세션을 감지해 자동 렌더 전환
  }

  async function handleGoogle() {
    setError(null);
    const err = await signInWithGoogle();
    if (err) setError(err);
  }

  return (
    <main style={{ maxWidth: 360, margin: "120px auto", fontFamily: "system-ui", padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>tablign 로그인</h1>
      <form onSubmit={handleEmail} style={{ display: "grid", gap: 8 }}>
        <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" disabled={loading}>
          {mode === "signin" ? "로그인" : "가입"}
        </button>
      </form>
      <button onClick={handleGoogle} style={{ marginTop: 8, width: "100%" }}>
        Google로 계속
      </button>
      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        style={{ marginTop: 8, background: "none", border: "none", color: "#06c", cursor: "pointer" }}
      >
        {mode === "signin" ? "계정 만들기" : "로그인으로"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </main>
  );
}
```

- [ ] **Step 4: oauth 헬퍼 임시 스텁 생성 (테스트 통과용, Task 3에서 실제 구현)**

`apps/extension/src/lib/oauth.ts`:
```ts
/** 구글 로그인. 성공 시 undefined, 실패 시 에러 메시지 문자열 반환. */
export async function signInWithGoogle(): Promise<string | undefined> {
  return "아직 구현되지 않았습니다";
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @tablign/extension test -- AuthScreen`
Expected: PASS (2 tests).

- [ ] **Step 6: 커밋**

```bash
git add apps/extension/src/newtab/AuthScreen.tsx apps/extension/src/newtab/AuthScreen.test.tsx apps/extension/src/lib/oauth.ts
git commit -m "feat(extension): 메인 화면 로그인 AuthScreen(이메일/비번/가입) 추가"
```

---

## Task 3: 구글 로그인 (chrome.identity + Supabase PKCE)

**Files:**
- Modify: `apps/extension/src/lib/oauth.ts`
- Test: `apps/extension/src/lib/oauth.test.ts`

- [ ] **Step 1: redirect URL 코드 파서 실패 테스트 작성**

`apps/extension/src/lib/oauth.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { extractCodeFromRedirect } from "./oauth";

describe("extractCodeFromRedirect", () => {
  it("쿼리스트링의 code를 추출", () => {
    expect(extractCodeFromRedirect("https://abc.chromiumapp.org/?code=xyz123")).toBe("xyz123");
  });
  it("code가 없으면 null", () => {
    expect(extractCodeFromRedirect("https://abc.chromiumapp.org/")).toBeNull();
  });
  it("redirectUrl이 undefined면 null", () => {
    expect(extractCodeFromRedirect(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @tablign/extension test -- oauth`
Expected: FAIL ("extractCodeFromRedirect is not a function").

- [ ] **Step 3: oauth 헬퍼 실제 구현**

`apps/extension/src/lib/oauth.ts` 전체를 교체:
```ts
import { supabase } from "./supabase";

/** chrome.identity가 돌려준 redirect URL에서 OAuth code 추출. 없으면 null. */
export function extractCodeFromRedirect(redirectUrl: string | undefined): string | null {
  if (!redirectUrl) return null;
  try {
    return new URL(redirectUrl).searchParams.get("code");
  } catch {
    return null;
  }
}

/**
 * 구글 로그인. chrome.identity.launchWebAuthFlow로 구글 인증 → Supabase PKCE 코드 교환.
 * 성공 시 undefined, 실패 시 사용자에게 보여줄 에러 메시지 반환.
 * 성공하면 세션이 chrome.storage에 저장되고 onAuthStateChange가 발화한다.
 */
export async function signInWithGoogle(): Promise<string | undefined> {
  const redirectTo = chrome.identity.getRedirectURL(); // https://<id>.chromiumapp.org/
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return error.message;
  if (!data?.url) return "로그인 URL을 받지 못했습니다";

  let resultUrl: string | undefined;
  try {
    resultUrl = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
  } catch (e) {
    return e instanceof Error ? e.message : "구글 인증이 취소되었습니다";
  }

  const code = extractCodeFromRedirect(resultUrl);
  if (!code) return "인증 코드를 받지 못했습니다";

  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) return exErr.message;
  return undefined;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @tablign/extension test -- oauth`
Expected: PASS (3 tests).

- [ ] **Step 5: 전체 테스트 + 타입 체크 (AuthScreen이 실제 signInWithGoogle를 import해도 정상)**

Run: `pnpm --filter @tablign/extension test`
Expected: 전체 PASS.
Run: `pnpm --filter @tablign/extension lint`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add apps/extension/src/lib/oauth.ts apps/extension/src/lib/oauth.test.ts
git commit -m "feat(extension): chrome.identity 기반 구글 로그인 구현"
```

---

## Task 4: NewTab 로그아웃 분기를 AuthScreen으로 교체

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx` (라인 321-328, import 추가)

- [ ] **Step 1: AuthScreen import 추가**

`apps/extension/src/newtab/NewTab.tsx`의 import 블록(다른 `./` import 근처, 예: 라인 29 `import { DndLinkList } ...` 아래)에 추가:
```tsx
import { AuthScreen } from "./AuthScreen";
```

- [ ] **Step 2: placeholder 분기 교체**

`apps/extension/src/newtab/NewTab.tsx`의 아래 블록(라인 321-328):
```tsx
  if (!session) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        <h2>tablign</h2>
        <p>팝업(확장 아이콘)에서 로그인하면 여기에 컬렉션이 표시됩니다.</p>
      </div>
    );
  }
```
를 아래로 교체:
```tsx
  if (!session) {
    return <AuthScreen />;
  }
```

- [ ] **Step 3: 타입 체크 + 전체 테스트**

Run: `pnpm --filter @tablign/extension lint`
Expected: 에러 없음.
Run: `pnpm --filter @tablign/extension test`
Expected: 전체 PASS.

- [ ] **Step 4: 빌드**

Run: `pnpm --filter @tablign/extension build`
Expected: 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/newtab/NewTab.tsx
git commit -m "feat(extension): 메인 화면 로그아웃 시 AuthScreen 렌더"
```

---

## Task 5: 외부 설정 (Supabase google provider + Google Console 안내)

> 이 Task는 코드가 아니라 설정/문서다. `client_id`/`secret`은 사용자가 직접 발급/입력한다.

**Files:**
- Modify: `supabase/config.toml`
- Create: `docs/extension-google-oauth-setup.md`

- [ ] **Step 1: config.toml에 google provider 섹션 추가**

`supabase/config.toml`의 `[auth.external.apple]` 블록(파일 내 검색: `[auth.external.apple]`) **바로 위 또는 아래**에 아래 블록 추가:
```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
# 로컬에서 구글 로그인 시 nonce 검사 비활성화 필요
skip_nonce_check = true
```

- [ ] **Step 2: config.toml의 additional_redirect_urls에 확장 redirect 추가**

`supabase/config.toml`에서 `additional_redirect_urls = [...]` 라인(검색: `additional_redirect_urls`)을 아래처럼 확장 redirect URL을 포함하도록 수정. `<EXTENSION_ID>`는 실제 확장 ID로 치환한다(아래 안내 문서 참고):
```toml
additional_redirect_urls = ["https://127.0.0.1:3000", "https://<EXTENSION_ID>.chromiumapp.org/"]
```

- [ ] **Step 3: 설정 안내 문서 작성**

`docs/extension-google-oauth-setup.md`:
```markdown
# 확장 프로그램 구글 로그인 설정

확장 프로그램의 "Google로 계속" 버튼은 아래 설정이 끝나야 동작한다.
(이메일/비밀번호·회원가입은 설정 없이 바로 동작한다.)

## 1. 확장 ID 확인 (redirect URL)
1. `pnpm --filter @tablign/extension build`
2. Chrome `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램 로드" → `apps/extension/dist` 선택
3. 표시된 **확장 ID**를 복사. redirect URL은 `https://<확장ID>.chromiumapp.org/` 이다.
   - (참고: 확장 화면 콘솔에서 `chrome.identity.getRedirectURL()`로도 확인 가능)

> 확장 ID를 고정하려면 `public/manifest.json`에 `"key"` 필드를 추가한다(선택).
> 키 생성: `openssl genrsa 2048 | openssl rsa -pubout -outform DER | openssl base64 -A`
> 결과 문자열을 manifest의 `"key"`로 넣으면 ID가 고정된다. (안 넣으면 dist 재로드 시 ID가
> 유지되긴 하나, 다른 PC/프로필에선 달라질 수 있다.)

## 2. Google Cloud Console
1. https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보
2. "OAuth 클라이언트 ID 만들기" → 애플리케이션 유형: **웹 애플리케이션**
3. **승인된 리디렉션 URI**에 추가: `http://127.0.0.1:54321/auth/v1/callback`
4. 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀** 복사

## 3. 환경 변수 (Supabase가 읽음)
`supabase/` 작업 디렉터리에서 셸 환경 또는 `.env`에 설정:
```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<클라이언트 ID>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<클라이언트 보안 비밀>
```

## 4. config.toml의 redirect 치환
`supabase/config.toml`의 `additional_redirect_urls`에 있는 `<EXTENSION_ID>`를 1단계의 확장 ID로 치환.

## 5. Supabase 재기동
```
supabase stop
supabase start
```

## 6. 검증
확장 새 탭 → "Google로 계속" → 구글 로그인 창 → 완료 후 보드가 뜨면 성공.
```

- [ ] **Step 4: 커밋**

```bash
git add supabase/config.toml docs/extension-google-oauth-setup.md
git commit -m "chore(extension): 구글 OAuth provider 설정 + 안내 문서"
```

---

## Task 6: 수동 통합 검증

> 코드 변경 없음. 실제 브라우저에서 확인.

- [ ] **Step 1: 빌드 후 확장 로드**

Run: `pnpm --filter @tablign/extension build`
`chrome://extensions`에서 `apps/extension/dist`를 압축해제 로드(또는 새로고침).

- [ ] **Step 2: 체크리스트 수동 확인**

- [ ] 새 탭 열기 → `AuthScreen`(tablign 로그인) 표시
- [ ] 확장 아이콘 클릭 → 팝업 안 뜨고 새 탭(메인 화면) 열림
- [ ] 이메일/비밀번호 로그인 성공 → 보드 화면 전환
- [ ] "계정 만들기" 토글 → 가입 동작
- [ ] (Task 5 설정 완료 시) "Google로 계속" → 구글 로그인 → 보드 전환
- [ ] 로그아웃(사이드바 등 기존 경로) 후 다시 `AuthScreen` 복귀
- [ ] 기존 컬렉션/탭 저장(오른쪽 패널 창 저장, 탭 드래그) 정상 동작

---

## Self-Review 결과

- **스펙 커버리지:** 팝업 제거(Task 1) ✓, 메인 화면 로그인 UI(Task 2, 4) ✓, 구글 chrome.identity(Task 3) ✓, 외부 설정 안내(Task 5) ✓, 검증(Task 6) ✓. 설계의 모든 결정 사항이 태스크로 매핑됨.
- **Placeholder:** 모든 코드 스텝에 실제 코드 포함. `<EXTENSION_ID>`/`<클라이언트 ID>`는 사용자 입력이 필요한 실제 값 자리(설계상 의도된 사용자 제공 값)이며 안내 문서에서 치환 방법 명시.
- **타입 일관성:** `signInWithGoogle(): Promise<string | undefined>`(Task 2 스텁 → Task 3 실제 구현 시그니처 동일). `extractCodeFromRedirect(string | undefined): string | null` 일관. `AuthScreen` named export로 정의·import 일치.
- **빌드 의존성:** Task 2에서 oauth 스텁을 먼저 만들어 AuthScreen import가 깨지지 않게 함 → Task 3에서 실제 구현으로 교체.
