# tablign Plan 4 — 크롬 확장 프로그램 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MV3 크롬 확장으로 (1) 현재 탭 저장, (2) 창의 모든 탭을 새 컬렉션으로 저장, (3) 새 탭 페이지를 보드 대시보드로 대체, (4) 컬렉션 Open all을 제공한다.

**Architecture:** `apps/extension`을 Vite 멀티페이지(popup.html, newtab.html)로 빌드한다. 인증은 `chrome.storage.local`을 세션 저장소로 쓰는 Supabase 클라이언트로 처리하고, 로그인은 팝업 안에서 이메일/비밀번호로 직접 수행한다. 데이터 접근은 기존 `@tablign/core`, 보드 표시는 `@tablign/ui`의 `CollectionColumn`/`Board`를 재사용한다. 탭→링크 변환은 순수 함수로 분리해 `chrome` API를 모킹하여 단위 테스트한다.

**Tech Stack:** Vite 5, @vitejs/plugin-react, React 18, TypeScript, @types/chrome, Vitest, `@tablign/core`, `@tablign/ui`, `@supabase/supabase-js`.

**설계 대비 변경(의도적 단순화):** 원 설계는 "확장이 웹 로그인 페이지로 세션을 위임받는" 방식이었으나, MVP·테스트 용이성을 위해 **팝업에서 직접 이메일/비밀번호 로그인**한다. OAuth(구글)와 웹↔확장 세션 핸드오프는 후속 과제로 남긴다.

**Prerequisites:** Plan 1·2·3 완료. 로컬 Supabase 실행 중. 로컬 키: URL `http://127.0.0.1:54321`, anon `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`.

---

## File Structure

```
apps/extension/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env                      # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (git 제외)
├── public/
│   └── manifest.json         # MV3 매니페스트 (dist 루트로 복사됨)
├── popup.html
├── newtab.html
└── src/
    ├── lib/
    │   ├── supabase.ts        # chrome.storage 세션 어댑터 + 클라이언트
    │   └── tabs.ts            # tabsToLinkInputs 순수 함수
    │   └── tabs.test.ts       # 단위 테스트(모킹)
    ├── popup/
    │   ├── main.tsx
    │   └── Popup.tsx
    └── newtab/
        ├── main.tsx
        └── NewTab.tsx

packages/core/src/data/collections.ts  # (수정) listAllCollections 추가
packages/core/src/__tests__/data.test.ts # (수정) 테스트 추가
```

---

## Task 1: core — listAllCollections (TDD)

팝업의 "현재 탭 저장" 드롭다운에서 사용자의 모든 컬렉션을 보여주기 위해 스페이스 무관 전체 조회 함수를 추가한다.

**Files:**
- Modify: `packages/core/src/data/collections.ts`
- Modify: `packages/core/src/__tests__/data.test.ts`

- [ ] **Step 1: data.test.ts에 import 추가 + describe 추가**

`../data/collections` import 목록에 `listAllCollections` 추가:

```typescript
import { listCollections, createCollection, updateCollection, deleteCollection, listAllCollections } from "../data/collections";
```

파일 끝에 추가:

```typescript
describe("listAllCollections", () => {
  it("스페이스에 상관없이 사용자의 모든 컬렉션을 반환한다", async () => {
    const user = await makeUser(`allcols-${Date.now()}@test.local`);
    const s1 = await createSpace(user.client, { user_id: user.id, name: "S1" });
    const s2 = await createSpace(user.client, { user_id: user.id, name: "S2" });
    await createCollection(user.client, { user_id: user.id, space_id: s1.id, title: "A" });
    await createCollection(user.client, { user_id: user.id, space_id: s2.id, title: "B" });
    const all = await listAllCollections(user.client);
    expect(all.some((c) => c.title === "A")).toBe(true);
    expect(all.some((c) => c.title === "B")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tablign/core test data`
Expected: FAIL — `listAllCollections` export 없음.

- [ ] **Step 3: 구현 추가**

`packages/core/src/data/collections.ts`의 `listCollections` 함수 바로 아래에 추가:

```typescript
export async function listAllCollections(
  client: SupabaseClient,
): Promise<Collection[]> {
  const { data, error } = await client
    .from("collections")
    .select()
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Collection[];
}
```

- [ ] **Step 4: 통과 확인 + lint**

Run: `pnpm --filter @tablign/core test data`  → 통과.
Run: `pnpm --filter @tablign/core lint` → tsc PASS.

(이미 `export * from "./data/collections"`가 index.ts에 있으므로 재export 추가 불필요.)

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/data/collections.ts packages/core/src/__tests__/data.test.ts
git commit -m "feat(core): listAllCollections 추가"
```

---

## Task 2: 확장 스캐폴딩 (Vite 멀티페이지 + MV3 매니페스트)

**Files:**
- Create: `apps/extension/package.json`
- Create: `apps/extension/vite.config.ts`
- Create: `apps/extension/tsconfig.json`
- Create: `apps/extension/.env`
- Create: `apps/extension/public/manifest.json`
- Create: `apps/extension/popup.html`
- Create: `apps/extension/newtab.html`
- Create: `apps/extension/src/popup/main.tsx`
- Create: `apps/extension/src/popup/Popup.tsx` (자리표시)
- Create: `apps/extension/src/newtab/main.tsx`
- Create: `apps/extension/src/newtab/NewTab.tsx` (자리표시)
- Modify: 루트 `.gitignore` (apps/extension/.env)

- [ ] **Step 1: package.json**

```json
{
  "name": "@tablign/extension",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@tablign/core": "workspace:*",
    "@tablign/ui": "workspace:*",
    "@supabase/supabase-js": "^2.45.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.270",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        newtab: resolve(__dirname, "newtab.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
```

- [ ] **Step 3: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: .env (로컬 키)**

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

그리고 루트 `.gitignore`에 추가:
```bash
echo "apps/extension/.env" >> .gitignore
```

- [ ] **Step 5: public/manifest.json**

```json
{
  "manifest_version": 3,
  "name": "tablign",
  "version": "0.0.1",
  "description": "시각적 북마크·탭 관리",
  "action": { "default_popup": "popup.html", "default_title": "tablign" },
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "permissions": ["tabs", "storage"],
  "host_permissions": ["http://127.0.0.1:54321/*"]
}
```

- [ ] **Step 6: HTML 진입점**

`popup.html`:
```html
<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8" /><title>tablign</title></head>
  <body style="width: 320px; margin: 0; font-family: sans-serif;">
    <div id="root"></div>
    <script type="module" src="/src/popup/main.tsx"></script>
  </body>
</html>
```

`newtab.html`:
```html
<!doctype html>
<html lang="ko">
  <head><meta charset="utf-8" /><title>tablign</title></head>
  <body style="margin: 0; font-family: sans-serif;">
    <div id="root"></div>
    <script type="module" src="/src/newtab/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: React 진입점 + 자리표시 컴포넌트**

`src/popup/main.tsx`:
```tsx
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";

createRoot(document.getElementById("root")!).render(<Popup />);
```

`src/popup/Popup.tsx`:
```tsx
export function Popup() {
  return <div style={{ padding: 16 }}>tablign 팝업 (구현 예정)</div>;
}
```

`src/newtab/main.tsx`:
```tsx
import { createRoot } from "react-dom/client";
import { NewTab } from "./NewTab";

createRoot(document.getElementById("root")!).render(<NewTab />);
```

`src/newtab/NewTab.tsx`:
```tsx
export function NewTab() {
  return <div style={{ padding: 32 }}>tablign 새 탭 (구현 예정)</div>;
}
```

- [ ] **Step 8: 설치 + 빌드 검증**

Run: `pnpm install`
Run: `pnpm --filter @tablign/extension build`
Expected: 빌드 성공. `apps/extension/dist/`에 `manifest.json`, `popup.html`, `newtab.html`, `assets/popup.js`, `assets/newtab.js`가 생성됨.

검증:
Run: `ls apps/extension/dist apps/extension/dist/assets`
Expected: 위 파일들 존재.

- [ ] **Step 9: 커밋**

```bash
git add apps/extension .gitignore pnpm-lock.yaml
git commit -m "feat(extension): Vite 멀티페이지 MV3 스캐폴딩"
```

---

## Task 3: chrome.storage 세션 어댑터 + Supabase 클라이언트

**Files:**
- Create: `apps/extension/src/lib/supabase.ts`

- [ ] **Step 1: 구현**

```typescript
import { createClient } from "@supabase/supabase-js";

/** Supabase 세션을 chrome.storage.local에 보관하는 어댑터 */
const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> =>
    new Promise((resolve) =>
      chrome.storage.local.get(key, (res) => resolve(res[key] ?? null)),
    ),
  setItem: (key: string, value: string): Promise<void> =>
    new Promise((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve())),
  removeItem: (key: string): Promise<void> =>
    new Promise((resolve) => chrome.storage.local.remove(key, () => resolve())),
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  {
    auth: {
      storage: chromeStorageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm --filter @tablign/extension lint`
Expected: tsc PASS (`import.meta.env` 타입은 Vite client 타입이 없어도 `as string` 캐스팅으로 통과; 만약 `import.meta.env` 에러가 나면 `apps/extension/src/vite-env.d.ts`에 `/// <reference types="vite/client" />` 한 줄을 추가한다).

- [ ] **Step 3: 커밋**

```bash
git add apps/extension/src/lib/supabase.ts
git commit -m "feat(extension): chrome.storage 세션 어댑터 Supabase 클라이언트"
```

---

## Task 4: 탭→링크 변환 순수 함수 (TDD)

**Files:**
- Create: `apps/extension/src/lib/tabs.ts`
- Create: `apps/extension/src/lib/tabs.test.ts`
- Create: `apps/extension/vitest.config.ts`

- [ ] **Step 1: vitest 설정**

`apps/extension/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { globals: true, environment: "node" },
});
```

- [ ] **Step 2: 실패 테스트**

`apps/extension/src/lib/tabs.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { tabsToLinkInputs } from "./tabs";

const tabs = [
  { url: "https://example.com", title: "예시", favIconUrl: "https://example.com/fav.ico" },
  { url: "chrome://extensions", title: "확장", favIconUrl: undefined },
  { url: "https://b.com", title: undefined, favIconUrl: undefined },
  { url: undefined, title: "no url", favIconUrl: undefined },
];

describe("tabsToLinkInputs", () => {
  it("http(s) 탭만 링크 입력으로 변환한다", () => {
    const inputs = tabsToLinkInputs(tabs, "u1", "c1");
    expect(inputs).toHaveLength(2);
    expect(inputs.map((i) => i.url)).toEqual(["https://example.com", "https://b.com"]);
  });

  it("user_id/collection_id/제목/파비콘을 매핑한다", () => {
    const inputs = tabsToLinkInputs(tabs, "u1", "c1");
    expect(inputs[0]).toMatchObject({
      user_id: "u1",
      collection_id: "c1",
      url: "https://example.com",
      title: "예시",
      favicon_url: "https://example.com/fav.ico",
    });
  });

  it("제목/파비콘이 없으면 null로 둔다", () => {
    const inputs = tabsToLinkInputs(tabs, "u1", "c1");
    expect(inputs[1].title).toBeNull();
    expect(inputs[1].favicon_url).toBeNull();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter @tablign/extension test`
Expected: FAIL — `./tabs` 없음.

- [ ] **Step 4: 구현**

`apps/extension/src/lib/tabs.ts`:
```typescript
import type { CreateLinkInput } from "@tablign/core";

export interface TabLike {
  url?: string;
  title?: string;
  favIconUrl?: string;
}

function isHttp(url: string | undefined): url is string {
  return !!url && (url.startsWith("http://") || url.startsWith("https://"));
}

export function tabsToLinkInputs(
  tabs: TabLike[],
  userId: string,
  collectionId: string,
): CreateLinkInput[] {
  return tabs
    .filter((t) => isHttp(t.url))
    .map((t) => ({
      user_id: userId,
      collection_id: collectionId,
      url: t.url!,
      title: t.title ?? null,
      favicon_url: t.favIconUrl ?? null,
    }));
}
```

- [ ] **Step 5: 통과 확인 + lint**

Run: `pnpm --filter @tablign/extension test` → 3 PASS.
Run: `pnpm --filter @tablign/extension lint` → tsc PASS.

- [ ] **Step 6: 커밋**

```bash
git add apps/extension/src/lib/tabs.ts apps/extension/src/lib/tabs.test.ts apps/extension/vitest.config.ts
git commit -m "feat(extension): 탭→링크 변환 순수 함수 추가"
```

---

## Task 5: 팝업 — 로그인 + 현재 탭/모든 탭 저장

**Files:**
- Modify: `apps/extension/src/popup/Popup.tsx`

- [ ] **Step 1: Popup 구현**

`apps/extension/src/popup/Popup.tsx`:
```tsx
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  listAllCollections,
  createLink,
  createCollection,
  listSpaces,
  createSpace,
  type Collection,
} from "@tablign/core";
import { supabase } from "../lib/supabase";
import { tabsToLinkInputs } from "../lib/tabs";

export function Popup() {
  const [session, setSession] = useState<Session | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    listAllCollections(supabase).then((cs) => {
      setCollections(cs);
      if (cs[0]) setSelectedId(cs[0].id);
    });
  }, [session]);

  if (!session) return <Login onError={setStatus} status={status} />;

  const userId = session.user.id;

  async function saveCurrentTab() {
    setStatus("저장 중…");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !selectedId) return setStatus("탭 또는 컬렉션 없음");
    const [input] = tabsToLinkInputs([tab], userId, selectedId);
    if (!input) return setStatus("이 탭은 저장할 수 없습니다");
    await createLink(supabase, input);
    setStatus("현재 탭 저장됨 ✓");
  }

  async function saveAllTabs() {
    setStatus("저장 중…");
    const title = prompt("새 컬렉션 이름", "저장한 탭");
    if (!title) return setStatus("");
    const spaces = await listSpaces(supabase);
    let spaceId = spaces[0]?.id;
    if (!spaceId) spaceId = (await createSpace(supabase, { user_id: userId, name: "개인" })).id;
    const col = await createCollection(supabase, { user_id: userId, space_id: spaceId, title });
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const inputs = tabsToLinkInputs(tabs, userId, col.id);
    for (const input of inputs) await createLink(supabase, input);
    setStatus(`${inputs.length}개 탭 저장됨 ✓`);
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 8 }}>
      <strong>tablign</strong>
      <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        {collections.length === 0 && <option value="">컬렉션 없음</option>}
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <button onClick={saveCurrentTab} disabled={!selectedId}>
        현재 탭 저장
      </button>
      <button onClick={saveAllTabs}>이 창의 모든 탭을 새 컬렉션으로</button>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          setStatus("");
        }}
        style={{ background: "none", border: "none", color: "#06c", cursor: "pointer" }}
      >
        로그아웃
      </button>
      {status && <div style={{ fontSize: 12, color: "#444" }}>{status}</div>}
    </div>
  );
}

function Login({ onError, status }: { onError: (s: string) => void; status: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onError("로그인 중…");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    onError(error ? error.message : "");
  }

  return (
    <form onSubmit={submit} style={{ padding: 16, display: "grid", gap: 8 }}>
      <strong>tablign 로그인</strong>
      <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit">로그인</button>
      {status && <div style={{ fontSize: 12, color: "red" }}>{status}</div>}
    </form>
  );
}
```

- [ ] **Step 2: lint + 빌드**

Run: `pnpm --filter @tablign/extension lint` → tsc PASS.
Run: `pnpm --filter @tablign/extension build` → 빌드 성공.

- [ ] **Step 3: 커밋**

```bash
git add apps/extension/src/popup/Popup.tsx
git commit -m "feat(extension): 팝업 로그인 + 현재 탭/모든 탭 저장"
```

---

## Task 6: 새 탭 페이지 — 보드 재사용 + Open all

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`

- [ ] **Step 1: NewTab 구현**

`@tablign/ui`의 `Board`/`CollectionColumn`을 재사용해 첫 스페이스의 컬렉션을 보여준다. 로그인 안 되어 있으면 안내.

`apps/extension/src/newtab/NewTab.tsx`:
```tsx
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Board, CollectionColumn } from "@tablign/ui";
import {
  listSpaces,
  listCollections,
  listLinks,
  createLink,
  deleteCollection,
  type Collection,
  type Link,
} from "@tablign/core";
import { supabase } from "../lib/supabase";

function openUrl(url: string) {
  window.open(url, "_blank", "noopener");
}

function Column({ collection, userId }: { collection: Collection; userId: string }) {
  const [links, setLinks] = useState<Link[]>([]);

  async function reload() {
    setLinks(await listLinks(supabase, collection.id));
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection.id]);

  return (
    <CollectionColumn
      collection={collection}
      links={links}
      onOpenLink={openUrl}
      onAddLink={async (url) => {
        await createLink(supabase, { user_id: userId, collection_id: collection.id, url });
        reload();
      }}
      onOpenAll={() => links.forEach((l) => openUrl(l.url))}
      onDeleteCollection={async (id) => {
        await deleteCollection(supabase, id);
        location.reload();
      }}
    />
  );
}

export function NewTab() {
  const [session, setSession] = useState<Session | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const spaces = await listSpaces(supabase);
      if (!spaces[0]) return setCollections([]);
      setCollections(await listCollections(supabase, spaces[0].id));
    })();
  }, [session]);

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h2>tablign</h2>
        <p>
          팝업(확장 아이콘)에서 로그인하면 여기에 컬렉션이 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header style={{ padding: 16 }}>
        <strong>tablign</strong>
      </header>
      <Board>
        {collections.map((c) => (
          <Column key={c.id} collection={c} userId={session.user.id} />
        ))}
      </Board>
    </div>
  );
}
```

- [ ] **Step 2: lint + 빌드**

Run: `pnpm --filter @tablign/extension lint` → tsc PASS.
Run: `pnpm --filter @tablign/extension build` → 빌드 성공.
Run: `ls apps/extension/dist apps/extension/dist/assets`
Expected: manifest.json, popup.html, newtab.html, assets/popup.js, assets/newtab.js 존재.

- [ ] **Step 3: 커밋**

```bash
git add apps/extension/src/newtab/NewTab.tsx
git commit -m "feat(extension): 새 탭 페이지 보드 재사용 + Open all"
```

---

## Task 7: 수동 로드/검증 + README

**Files:**
- Create: `apps/extension/README.md`

- [ ] **Step 1: README 작성**

`apps/extension/README.md`:
```markdown
# tablign 크롬 확장

## 개발 빌드 & 로드

1. 로컬 Supabase 실행: `pnpm dlx supabase start`
2. 빌드: `pnpm --filter @tablign/extension build`
3. 크롬에서 `chrome://extensions` → "개발자 모드" 켜기 → "압축해제된 확장 프로그램을 로드합니다" → `apps/extension/dist` 선택.
4. 확장 아이콘 클릭 → 팝업에서 이메일/비밀번호로 로그인(웹 앱과 동일 계정).
5. "현재 탭 저장": 컬렉션 선택 후 버튼 → 현재 탭이 그 컬렉션에 저장됨.
6. "모든 탭을 새 컬렉션으로": 이름 입력 → 창의 모든 http(s) 탭이 새 컬렉션에 저장됨.
7. 새 탭 열기 → 첫 스페이스의 컬렉션·링크가 보드로 표시됨. 링크 클릭 시 열림, "↗"로 컬렉션 전체 열기.

## 주의
- 코드 변경 후에는 다시 `build` 하고 `chrome://extensions`에서 새로고침(↻).
- 로컬 키는 `apps/extension/.env`에 있음(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). 클라우드 배포 시 매니페스트의 `host_permissions`와 `.env`를 클라우드 URL로 교체.
```

- [ ] **Step 2: 전체 검증 (자동 가능 범위)**

Run: `pnpm --filter @tablign/extension lint` → tsc PASS.
Run: `pnpm --filter @tablign/extension test` → tabs 3 PASS.
Run: `pnpm --filter @tablign/extension build` → 빌드 성공, dist 산출물 확인.

- [ ] **Step 3: 수동 검증 (사람이 크롬에서)**

README 절차대로 확장을 로드해 로그인 → 현재 탭 저장 → 모든 탭 저장 → 새 탭 페이지 표시 → Open all을 확인. (헤드리스 자동화 불가 구간.)

- [ ] **Step 4: 커밋**

```bash
git add apps/extension/README.md
git commit -m "docs(extension): 로드/검증 README 추가"
```

---

## Self-Review 결과

- **Spec 커버리지:** 구현순서 8(팝업 현재 탭/모든 탭 저장: Task 5), 9(새 탭 페이지 보드 재사용: Task 6), 10(Open all + 마무리: Task 6의 onOpenAll, Task 7)을 구현. core 보조함수(Task 1)와 확장 기반(Task 2~4) 포함.
- **타입 일관성:** `tabsToLinkInputs`는 `@tablign/core`의 `CreateLinkInput`을 반환. 팝업/새탭은 core 데이터 함수와 `@tablign/ui` 컴포넌트(`Board`, `CollectionColumn`)를 그대로 사용. `listAllCollections` 시그니처(Task 1)와 팝업 사용처 일치.
- **Placeholder 스캔:** 모든 코드/명령 실제 내용 포함. 크롬 로드·UI 동작 검증은 헤드리스 불가라 README 절차로 사람이 확인하도록 명시.
- **설계 대비 변경:** 팝업 직접 로그인(원 설계의 웹 세션 핸드오프 대신). 의도적 MVP 단순화로 문서화함. OAuth/세션 핸드오프는 후속.
- **주의:** 새 탭 페이지는 첫 스페이스의 컬렉션만 표시(스페이스 전환 UI는 후속). Realtime 구독은 새 탭에 미연결(Plan 3의 useRealtimeSync는 웹 전용) — 새 탭은 열릴 때 1회 로드.

---

## 다음 단계

Plan 4 완료 시 MVP(웹 + 확장)의 모든 구현순서(1~10)가 끝난다. 이후 후속 사이클: 팀 워크스페이스/공유, OAuth·세션 핸드오프, 멀티 브라우저 확장, 진짜 위치 재정렬, 검색 하이라이트 등.
