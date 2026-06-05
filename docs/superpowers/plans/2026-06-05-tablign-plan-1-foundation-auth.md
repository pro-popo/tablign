# tablign Plan 1 — 기반(Foundation) + 인증 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모노레포·로컬 Supabase·DB 스키마·RLS를 구축하고, 이메일/구글 로그인과 보호된 빈 대시보드까지 동작하게 만든다.

**Architecture:** pnpm 워크스페이스 모노레포. `packages/core`가 DB 타입과 Supabase 클라이언트 팩토리를 제공하고, `apps/web`(Next.js App Router)이 이를 사용한다. 보안은 Postgres RLS로 강제하며, RLS 정책은 통합 테스트로 검증한다. 인증은 Supabase Auth + `@supabase/ssr`(쿠키 세션) + 미들웨어 보호.

**Tech Stack:** pnpm workspaces, Next.js 15 (App Router), TypeScript, Supabase (CLI 로컬, Postgres, Auth), `@supabase/ssr`, Vitest.

**Prerequisites:** Node 20+, pnpm 10+, Docker 실행 중(로컬 Supabase용). Supabase CLI는 `pnpm dlx supabase`로 호출한다.

---

## File Structure

```
tablign/
├── package.json                      # 루트 워크스페이스 정의
├── pnpm-workspace.yaml               # 워크스페이스 경로
├── .nvmrc                            # node 버전 고정
├── packages/
│   └── core/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── types.ts              # DB 행(Row) 타입 + Database 타입
│           ├── client.ts             # createSupabaseClient 팩토리 (테스트/확장용)
│           ├── index.ts              # 공개 export
│           └── __tests__/
│               └── rls.test.ts       # RLS 정책 통합 테스트
├── apps/
│   └── web/
│       ├── package.json
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── .env.local                # Supabase URL/anon key (git 제외)
│       ├── middleware.ts             # /dashboard 보호
│       └── src/
│           ├── lib/supabase/
│           │   ├── browser.ts        # 브라우저용 클라이언트
│           │   ├── server.ts         # 서버 컴포넌트/액션용 클라이언트
│           │   └── middleware.ts     # 미들웨어용 세션 갱신 헬퍼
│           └── app/
│               ├── layout.tsx
│               ├── login/page.tsx    # 이메일 + 구글 로그인
│               ├── auth/
│               │   ├── callback/route.ts   # OAuth 코드 교환
│               │   └── signout/route.ts     # 로그아웃
│               └── dashboard/page.tsx       # 보호된 빈 대시보드
└── supabase/
    ├── config.toml                   # supabase init 생성
    └── migrations/
        ├── 0001_schema.sql           # 테이블
        └── 0002_rls.sql              # RLS 정책
```

---

## Task 1: pnpm 모노레포 초기화

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.nvmrc`
- Modify: `.gitignore`

- [ ] **Step 1: 루트 `package.json` 작성**

```json
{
  "name": "tablign",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: `pnpm-workspace.yaml` 작성**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: `.nvmrc` 작성**

```
20
```

- [ ] **Step 4: `.gitignore`에 항목 추가**

기존 `.gitignore`에 다음 줄들을 추가한다(이미 `.superpowers/`가 있을 수 있음):

```
node_modules/
.next/
.env.local
.env*.local
dist/
coverage/
*.log
```

- [ ] **Step 5: 커밋**

```bash
git add package.json pnpm-workspace.yaml .nvmrc .gitignore
git commit -m "chore: pnpm 모노레포 초기화"
```

---

## Task 2: packages/core — DB 타입과 클라이언트 팩토리

`core`는 모든 클라이언트(웹/확장/테스트)가 공유하는 DB 타입과 Supabase 클라이언트 생성 함수를 제공한다.

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/client.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: `packages/core/package.json` 작성**

```json
{
  "name": "@tablign/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: `packages/core/tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: `packages/core/src/types.ts` 작성 — DB 행 타입**

이 타입들은 이후 모든 plan에서 사용한다. 스키마(Task 4)와 정확히 일치해야 한다.

```typescript
export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Space {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  position: number;
  created_at: string;
}

export interface Collection {
  id: string;
  space_id: string;
  user_id: string;
  title: string;
  icon: string | null;
  note: string | null;
  position: number;
  created_at: string;
}

export interface Link {
  id: string;
  collection_id: string;
  user_id: string;
  url: string;
  title: string | null;
  favicon_url: string | null;
  thumbnail_url: string | null;
  custom_title: string | null;
  position: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface CollectionTag {
  collection_id: string;
  tag_id: string;
}
```

- [ ] **Step 4: `packages/core/src/client.ts` 작성 — 클라이언트 팩토리**

테스트와 확장 프로그램이 쓰는 단순 클라이언트 생성기. (웹 앱은 별도의 SSR 클라이언트를 Task 8에서 만든다.)

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(
  url: string,
  key: string,
): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 5: `packages/core/src/index.ts` 작성 — 공개 export**

```typescript
export * from "./types";
export * from "./client";
```

- [ ] **Step 6: 의존성 설치**

Run: `pnpm install`
Expected: 워크스페이스 패키지가 링크되고 `node_modules`가 생성됨. 에러 없음.

- [ ] **Step 7: 타입 체크**

Run: `pnpm --filter @tablign/core lint`
Expected: 에러 없이 통과(출력 없음).

- [ ] **Step 8: 커밋**

```bash
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): DB 타입과 Supabase 클라이언트 팩토리 추가"
```

---

## Task 3: 로컬 Supabase 초기화 + 스키마 마이그레이션

**Files:**
- Create: `supabase/config.toml` (CLI가 생성)
- Create: `supabase/migrations/0001_schema.sql`

- [ ] **Step 1: Supabase 프로젝트 초기화**

Run: `pnpm dlx supabase init`
Expected: `supabase/config.toml`과 `supabase/` 디렉터리 생성. 프롬프트가 나오면 기본값(Enter) 수락.

- [ ] **Step 2: 로컬 Supabase 시작 (Docker 필요)**

Run: `pnpm dlx supabase start`
Expected: 컨테이너가 뜨고 마지막에 `API URL`, `anon key`, `service_role key` 등이 출력됨. 이 값들을 이후 단계에서 사용하므로 메모해 둔다.

- [ ] **Step 3: 스키마 마이그레이션 파일 작성**

Create `supabase/migrations/0001_schema.sql`:

```sql
-- profiles: auth.users 확장
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 신규 가입 시 프로필 자동 생성
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- spaces
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  position double precision not null default 1000,
  created_at timestamptz not null default now()
);
create index spaces_user_id_idx on public.spaces(user_id);

-- collections
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  icon text,
  note text,
  position double precision not null default 1000,
  created_at timestamptz not null default now()
);
create index collections_space_id_idx on public.collections(space_id);
create index collections_user_id_idx on public.collections(user_id);

-- links
create table public.links (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text,
  favicon_url text,
  thumbnail_url text,
  custom_title text,
  position double precision not null default 1000,
  created_at timestamptz not null default now()
);
create index links_collection_id_idx on public.links(collection_id);
create index links_user_id_idx on public.links(user_id);

-- tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);
create index tags_user_id_idx on public.tags(user_id);

-- collection_tags (다대다)
create table public.collection_tags (
  collection_id uuid not null references public.collections(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (collection_id, tag_id)
);
```

- [ ] **Step 4: 마이그레이션 적용**

Run: `pnpm dlx supabase migration up`
Expected: `0001_schema` 적용 성공 메시지. 에러 없음.

- [ ] **Step 5: 테이블 생성 확인**

Run: `pnpm dlx supabase db dump --local --data-only=false --schema public | grep -c "create table"` 대신 간단히:
Run: `pnpm dlx supabase migration list`
Expected: `0001_schema`가 적용됨(local에 체크 표시)으로 표시.

- [ ] **Step 6: 커밋**

```bash
git add supabase/
git commit -m "feat(db): 스키마 마이그레이션(spaces/collections/links/tags) 추가"
```

---

## Task 4: RLS 정책 마이그레이션

모든 테이블에서 "본인 데이터만 접근"을 강제한다.

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

- [ ] **Step 1: RLS 마이그레이션 파일 작성**

Create `supabase/migrations/0002_rls.sql`:

```sql
-- 모든 테이블 RLS 활성화
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.collections enable row level security;
alter table public.links enable row level security;
alter table public.tags enable row level security;
alter table public.collection_tags enable row level security;

-- profiles: 본인 행만
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- spaces
create policy "spaces_all_own" on public.spaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- collections
create policy "collections_all_own" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- links
create policy "links_all_own" on public.links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tags
create policy "tags_all_own" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- collection_tags: 연결된 컬렉션의 소유자만
create policy "collection_tags_all_own" on public.collection_tags
  for all using (
    exists (
      select 1 from public.collections c
      where c.id = collection_tags.collection_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_tags.collection_id and c.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: 마이그레이션 적용**

Run: `pnpm dlx supabase migration up`
Expected: `0002_rls` 적용 성공. 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/0002_rls.sql
git commit -m "feat(db): RLS 정책(본인 데이터만 접근) 추가"
```

---

## Task 5: RLS 통합 테스트 (TDD)

로컬 Supabase에 두 명의 사용자를 만들고, 서로의 데이터에 접근하지 못함을 자동 검증한다. **이 테스트가 보안의 핵심 안전망이다.**

**Files:**
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/__tests__/rls.test.ts`
- Create: `packages/core/.env.test` (git 제외 — anon/service key 보관)

- [ ] **Step 1: `packages/core/vitest.config.ts` 작성**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    env: {
      // .env.test에서 로드
    },
    setupFiles: [],
    testTimeout: 20000,
  },
});
```

- [ ] **Step 2: 로컬 Supabase 접속 정보 확인**

Run: `pnpm dlx supabase status`
Expected: `API URL`(보통 `http://127.0.0.1:54321`), `anon key`, `service_role key`가 출력됨.

- [ ] **Step 3: `packages/core/.env.test` 작성**

`supabase status` 출력값으로 채운다(키는 실제 출력값으로 교체):

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<status의 anon key>
SUPABASE_SERVICE_ROLE_KEY=<status의 service_role key>
```

그리고 `.gitignore`에 추가:

```bash
echo "packages/core/.env.test" >> .gitignore
```

- [ ] **Step 4: 실패하는 테스트 작성**

Create `packages/core/src/__tests__/rls.test.ts`:

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// .env.test 로드 (간단 파서)
const envText = readFileSync(resolve(__dirname, "../../.env.test"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

async function makeUser(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (createErr) throw createErr;

  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (signInErr) throw signInErr;

  return { client, id: created.user!.id };
}

describe("RLS 정책", () => {
  let alice: { client: SupabaseClient; id: string };
  let bob: { client: SupabaseClient; id: string };
  let aliceSpaceId: string;

  beforeAll(async () => {
    // 고유 이메일로 충돌 방지
    alice = await makeUser(`alice-${Date.now()}@test.local`);
    bob = await makeUser(`bob-${Date.now()}@test.local`);

    const { data, error } = await alice.client
      .from("spaces")
      .insert({ user_id: alice.id, name: "Alice 개인" })
      .select()
      .single();
    if (error) throw error;
    aliceSpaceId = data.id;
  });

  it("본인이 만든 space를 읽을 수 있다", async () => {
    const { data, error } = await alice.client.from("spaces").select();
    expect(error).toBeNull();
    expect(data!.some((s) => s.id === aliceSpaceId)).toBe(true);
  });

  it("타인의 space는 보이지 않는다", async () => {
    const { data, error } = await bob.client.from("spaces").select();
    expect(error).toBeNull();
    expect(data!.some((s) => s.id === aliceSpaceId)).toBe(false);
  });

  it("타인의 user_id로 space를 만들 수 없다(WITH CHECK 위반)", async () => {
    const { error } = await bob.client
      .from("spaces")
      .insert({ user_id: alice.id, name: "탈취 시도" });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 5: 테스트 실행 → 실패 확인**

먼저 `.env.test`가 비어 있거나 키가 틀린 상태면 실패한다. 키가 올바르면 이 테스트는 **통과**해야 정상이다(정책이 이미 Task 4에서 적용됨). 따라서 이 단계의 "실패"는 다음으로 확인한다:

임시로 `0002_rls.sql`의 `spaces_all_own` 정책 없이 동작하면 "타인의 space가 보임"이 되어 두 번째 테스트가 실패한다. 정책이 적용된 현재 상태에서는 통과가 정상이다.

Run: `pnpm --filter @tablign/core test`
Expected: 정책이 올바르면 3개 테스트 PASS. 만약 하나라도 FAIL이면 RLS 정책을 점검한다.

- [ ] **Step 6: (검증) 정책을 의도적으로 깨서 테스트가 잡아내는지 확인**

`supabase/migrations/0002_rls.sql`에서 `alter table public.spaces enable row level security;` 줄을 임시로 주석 처리하고 DB를 리셋한다:

Run: `pnpm dlx supabase db reset`
Run: `pnpm --filter @tablign/core test`
Expected: "타인의 space는 보이지 않는다" 테스트가 FAIL(RLS가 꺼져 모든 행이 보임). → 테스트가 보안 회귀를 잡아냄을 확인.

- [ ] **Step 7: 주석을 되돌리고 재검증**

주석을 제거하고:
Run: `pnpm dlx supabase db reset`
Run: `pnpm --filter @tablign/core test`
Expected: 3개 테스트 모두 PASS.

- [ ] **Step 8: 커밋**

```bash
git add packages/core/vitest.config.ts packages/core/src/__tests__/rls.test.ts .gitignore
git commit -m "test(core): RLS 정책 통합 테스트 추가"
```

---

## Task 6: Next.js 웹 앱 스캐폴딩

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/.env.local`

- [ ] **Step 1: `apps/web/package.json` 작성**

```json
{
  "name": "@tablign/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "echo \"no web unit tests in plan 1\" && exit 0"
  },
  "dependencies": {
    "@tablign/core": "workspace:*",
    "@supabase/ssr": "^0.5.0",
    "@supabase/supabase-js": "^2.45.0",
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: `apps/web/next.config.ts` 작성**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tablign/core"],
};

export default nextConfig;
```

- [ ] **Step 3: `apps/web/tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: `apps/web/src/app/layout.tsx` 작성**

```tsx
export const metadata = {
  title: "tablign",
  description: "시각적 북마크·탭 관리",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: `apps/web/src/app/page.tsx` 작성 (루트 → 대시보드로)**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 6: `apps/web/.env.local` 작성**

`pnpm dlx supabase status`의 값으로 채운다:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<status의 anon key>
```

- [ ] **Step 7: 설치 및 빌드 확인**

Run: `pnpm install`
Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공(로그인/대시보드는 다음 Task에서 추가하므로 현재는 루트 리다이렉트만 존재; `/dashboard` 미존재로 런타임 리다이렉트는 빌드에 영향 없음).

- [ ] **Step 8: 커밋**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): Next.js 앱 스캐폴딩"
```

---

## Task 7: Supabase SSR 클라이언트 + 세션 미들웨어

**Files:**
- Create: `apps/web/src/lib/supabase/browser.ts`
- Create: `apps/web/src/lib/supabase/server.ts`
- Create: `apps/web/src/lib/supabase/middleware.ts`
- Create: `apps/web/middleware.ts`

- [ ] **Step 1: 브라우저 클라이언트 작성**

Create `apps/web/src/lib/supabase/browser.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: 서버 클라이언트 작성**

Create `apps/web/src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서 호출되면 무시 (미들웨어가 갱신 담당)
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: 미들웨어 헬퍼 작성**

Create `apps/web/src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 보호 경로: 미로그인 시 /login으로
  const path = request.nextUrl.pathname;
  if (!user && path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 로그인 상태로 /login 접근 시 대시보드로
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 4: 루트 미들웨어 작성**

Create `apps/web/middleware.ts`:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth).*)"],
};
```

- [ ] **Step 5: 빌드 확인**

Run: `pnpm --filter @tablign/web build`
Expected: 타입/빌드 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/lib apps/web/middleware.ts
git commit -m "feat(web): Supabase SSR 클라이언트와 세션 미들웨어 추가"
```

---

## Task 8: 로그인 페이지 (이메일 + 구글) + OAuth 콜백 + 로그아웃

**Files:**
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/app/auth/callback/route.ts`
- Create: `apps/web/src/app/auth/signout/route.ts`

- [ ] **Step 1: OAuth 콜백 라우트 작성**

Create `apps/web/src/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
```

- [ ] **Step 2: 로그아웃 라우트 작성**

Create `apps/web/src/app/auth/signout/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
```

- [ ] **Step 3: 로그인 페이지 작성 (클라이언트 컴포넌트)**

Create `apps/web/src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>tablign 로그인</h1>
      <form onSubmit={handleEmail} style={{ display: "grid", gap: 8 }}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
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

- [ ] **Step 4: 빌드 확인**

Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/login apps/web/src/app/auth
git commit -m "feat(web): 이메일/구글 로그인, OAuth 콜백, 로그아웃 추가"
```

---

## Task 9: 보호된 빈 대시보드 + 수동 검증

**Files:**
- Create: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: 대시보드 페이지 작성 (서버 컴포넌트)**

Create `apps/web/src/app/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>tablign</h1>
        <form action="/auth/signout" method="post">
          <button type="submit">로그아웃</button>
        </form>
      </header>
      <p>{user.email} 님 환영합니다. (컬렉션은 Plan 2에서 추가됩니다.)</p>
    </main>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공.

- [ ] **Step 3: 개발 서버로 수동 검증**

로컬 Supabase가 떠 있는지 확인(`pnpm dlx supabase status`). 아니면 `pnpm dlx supabase start`.

Run: `pnpm --filter @tablign/web dev`
브라우저에서 `http://localhost:3000` 접속.
Expected:
- 미로그인 상태 → `/dashboard` 접근 시 `/login`으로 리다이렉트됨.
- 이메일로 "계정 만들기" → 가입 후 `/dashboard`로 이동, "환영합니다" 표시.
- 로그아웃 → `/login`으로 이동.
- 다시 `/dashboard` 직접 접근 → `/login`으로 막힘.

(구글 로그인은 Supabase 대시보드에 Google OAuth 자격증명 설정이 필요하므로, 로컬에서는 이메일 로그인으로 검증하면 충분하다. 구글 설정은 배포 단계에서 진행.)

- [ ] **Step 4: 가입한 사용자에 대해 프로필이 자동 생성됐는지 확인**

Run: `pnpm dlx supabase status` 로 Studio URL 확인 후 브라우저에서 Studio 접속 → `profiles` 테이블에 방금 가입한 사용자 행이 있는지 확인.
Expected: `handle_new_user` 트리거로 행이 자동 생성됨.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/dashboard
git commit -m "feat(web): 보호된 대시보드 자리표시 + 로그아웃"
```

---

## Self-Review 결과

- **Spec 커버리지:** 이 plan은 스펙의 구현순서 1(모노레포+Supabase+스키마+RLS)과 2(웹 인증)를 모두 구현한다. 컬렉션/링크/보드/태그/검색/Realtime/확장은 Plan 2~4로 명시적으로 분리됨.
- **타입 일관성:** `packages/core/src/types.ts`의 타입이 `0001_schema.sql`의 컬럼과 일치(예: `links.custom_title`, `position double precision`). 클라이언트 팩토리명 `createSupabaseClient`(core)와 웹의 `createClient`(SSR)로 역할 구분.
- **Placeholder 스캔:** 모든 코드/명령 블록에 실제 내용 포함. `.env.test`/`.env.local`의 키는 `supabase status` 실제 출력으로 채우라고 명시(로컬 환경마다 달라 하드코딩 불가).

---

## 다음 단계

Plan 1 완료 후 Plan 2(컬렉션 & 보드 — CRUD, 보드 UI, 메타데이터 라우트, 드래그앤드롭)를 같은 형식으로 작성한다.
