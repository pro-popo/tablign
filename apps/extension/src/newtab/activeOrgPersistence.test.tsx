import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@tablign/ui";
import { NewTab } from "./NewTab";

/**
 * 회귀: 팀 조직에 있다가 새로고침을 연속으로 누르면 개인 조직으로 넘어가던 문제.
 *
 * 원인은 로드 시 폴백까지 chrome.storage에 저장한 것이었다. 조직 조회가 한 번이라도
 * 어긋나면 그 순간의 폴백(개인 조직 또는 null)이 디스크에 박히고, 저장된 null은
 * 복원 조건(typeof === "string")을 통과하지 못해 이후 모든 새로고침이 개인 조직으로 떨어졌다.
 *
 * 그래서 이 테스트는 "화면이 무엇을 보여주는가"가 아니라 **무엇이 저장되는가**를 본다.
 */

// 실제 supabase처럼 onAuthStateChange가 새 세션 객체를 한 번 더 흘려준다(INITIAL_SESSION).
const session = { user: { id: "u1", email: "u1@test.local" } };
let authCb: ((e: string, s: unknown) => void) | null = null;
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        authCb = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => Promise.resolve(),
    },
  },
}));
vi.mock("./TossEmojiPicker", () => ({ TossEmojiPicker: () => null }));

const ORGS = [
  { id: "org-personal", name: "개인", icon: null, color: null, owner_id: "u1", is_personal: true, created_at: "1" },
  { id: "org-team", name: "팀", icon: null, color: null, owner_id: "u1", is_personal: false, created_at: "2" },
];
const SPACES = [
  { id: "s-personal", user_id: "u1", name: "개인공간", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
  { id: "s-team", user_id: "u1", name: "팀공간", icon: null, position: 1000, created_at: "x", org_id: "org-team" },
];

let orgsImpl: () => Promise<typeof ORGS> = () => Promise.resolve(ORGS);
let spacesImpl: () => Promise<typeof SPACES> = () => Promise.resolve(SPACES);

vi.mock("@tablign/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tablign/core")>();
  return {
    ...actual,
    listOrganizations: () => orgsImpl(),
    listSpaces: () => spacesImpl(),
    listMyOrgMemberships: () => Promise.resolve([]),
    listMyMemberships: () => Promise.resolve([]),
    listCollections: () => Promise.resolve([]),
    listLinks: () => Promise.resolve([]),
    listMembers: () => Promise.resolve([]),
    listSpaceInvitations: () => Promise.resolve([]),
    listMyInvitations: () => Promise.resolve([]),
    listOrgMembers: () => Promise.resolve([]),
    listOrgInvitations: () => Promise.resolve([]),
    listMyOrgInvitations: () => Promise.resolve([]),
  };
});

const ORG_KEY = "tablign.activeOrg";
const SPACE_KEY = "tablign.activeSpace";
let store: Record<string, unknown> = {};

beforeEach(() => {
  authCb = null;
  orgsImpl = () => Promise.resolve(ORGS);
  spacesImpl = () => Promise.resolve(SPACES);
  // 팀 조직·팀 스페이스에 있던 상태로 시작한다
  store = { [ORG_KEY]: "org-team", [SPACE_KEY]: "s-team" };
  vi.stubGlobal("chrome", {
    tabs: { query: vi.fn().mockResolvedValue([]), getCurrent: vi.fn().mockResolvedValue({ id: 1 }) },
    storage: {
      local: {
        // 실제 chrome.storage는 비동기다 — 동기 스텁은 로드 순서 문제를 숨긴다
        get: (keys: string | string[], cb: (items: Record<string, unknown>) => void) => {
          const ks = Array.isArray(keys) ? keys : [keys];
          const out: Record<string, unknown> = {};
          for (const k of ks) if (k in store) out[k] = store[k];
          setTimeout(() => cb(out), 0);
        },
        set: (items: Record<string, unknown>, cb?: () => void) => {
          Object.assign(store, items);
          cb?.();
        },
        remove: (_k: unknown, cb?: () => void) => cb?.(),
      },
    },
  });
});

/** 새로고침 1회 — 마운트하고 실제처럼 세션을 한 번 더 흘린다 */
async function mountOnce() {
  render(<ToastProvider><NewTab /></ToastProvider>);
  await waitFor(() => expect(authCb).not.toBeNull());
  authCb!("INITIAL_SESSION", { user: { id: "u1", email: "u1@test.local" } });
}

describe("활성 조직 영속화", () => {
  it("정상 로드에서는 팀 조직이 유지된다", async () => {
    await mountOnce();
    await waitFor(() => expect(screen.queryAllByText("팀공간").length).toBeGreaterThan(0), { timeout: 4000 });
    expect(store[ORG_KEY]).toBe("org-team");
    expect(store[SPACE_KEY]).toBe("s-team");
  });

  it("조직 조회가 비어 와도 저장값을 덮어쓰지 않는다", async () => {
    orgsImpl = () => Promise.resolve([] as unknown as typeof ORGS);
    await mountOnce();
    // 조회·폴백이 모두 끝날 시간을 준다
    await new Promise((r) => setTimeout(r, 300));
    // 화면은 비어도 좋지만 저장값이 오염되면 다음 새로고침부터 영구히 개인 조직이 된다
    expect(store[ORG_KEY]).toBe("org-team");
  });

  it("스페이스 조회가 비어 와도 저장값을 덮어쓰지 않는다", async () => {
    spacesImpl = () => Promise.resolve([] as unknown as typeof SPACES);
    await mountOnce();
    await new Promise((r) => setTimeout(r, 300));
    expect(store[SPACE_KEY]).toBe("s-team");
    expect(store[ORG_KEY]).toBe("org-team");
  });

  it("한 번 어긋난 뒤 조회가 정상으로 돌아오면 팀 조직으로 복귀한다", async () => {
    // 새로고침 ①: 조회가 비어 온다
    orgsImpl = () => Promise.resolve([] as unknown as typeof ORGS);
    const first = render(<ToastProvider><NewTab /></ToastProvider>);
    await waitFor(() => expect(authCb).not.toBeNull());
    authCb!("INITIAL_SESSION", { user: { id: "u1", email: "u1@test.local" } });
    await new Promise((r) => setTimeout(r, 300));
    first.unmount();

    // 새로고침 ②: 정상 응답 — 저장값이 살아 있으므로 팀으로 돌아와야 한다
    authCb = null;
    orgsImpl = () => Promise.resolve(ORGS);
    await mountOnce();
    await waitFor(() => expect(screen.queryAllByText("팀공간").length).toBeGreaterThan(0), { timeout: 4000 });
    expect(store[ORG_KEY]).toBe("org-team");
  });
});

describe("빠른 새로고침 타이밍", () => {
  it("저장소 읽기가 네트워크보다 늦게 와도 팀 조직이 유지된다", async () => {
    // 빠른 연속 새로고침에서 chrome.storage IPC가 지연되는 상황
    const slowGet = 120;
    vi.stubGlobal("chrome", {
      tabs: { query: vi.fn().mockResolvedValue([]), getCurrent: vi.fn().mockResolvedValue({ id: 1 }) },
      storage: {
        local: {
          get: (keys: string | string[], cb: (i: Record<string, unknown>) => void) => {
            const ks = Array.isArray(keys) ? keys : [keys];
            const out: Record<string, unknown> = {};
            for (const k of ks) if (k in store) out[k] = store[k];
            setTimeout(() => cb(out), slowGet);
          },
          set: (items: Record<string, unknown>, cb?: () => void) => { Object.assign(store, items); cb?.(); },
          remove: (_k: unknown, cb?: () => void) => cb?.(),
        },
      },
    });
    await mountOnce();
    await waitFor(() => expect(screen.queryAllByText("팀공간").length).toBeGreaterThan(0), { timeout: 4000 });
    expect(store[ORG_KEY]).toBe("org-team");
  });

  it("세션이 잠시 끊겼다 돌아와도(토큰 회전) 팀 조직이 유지된다", async () => {
    await mountOnce();
    await waitFor(() => expect(screen.queryAllByText("팀공간").length).toBeGreaterThan(0), { timeout: 4000 });

    // supabase가 갱신 실패로 SIGNED_OUT을 흘렸다가 곧 새 세션으로 복구되는 흐름
    authCb!("SIGNED_OUT", null);
    await new Promise((r) => setTimeout(r, 30));
    authCb!("TOKEN_REFRESHED", { user: { id: "u1", email: "u1@test.local" } });

    await waitFor(() => expect(screen.queryAllByText("팀공간").length).toBeGreaterThan(0), { timeout: 4000 });
    expect(store[ORG_KEY]).toBe("org-team");
  });
});
