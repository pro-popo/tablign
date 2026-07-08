import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider } from "@tablign/ui";
import { NewTab } from "./NewTab";

// supabase 클라이언트 모킹: 로그인된 세션을 즉시 돌려준다.
const session = { user: { id: "u1", email: "u1@test.local" } };
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve(),
    },
  },
}));

// 데이터 계층 모킹: 함수만 대체하고 타입·정렬 헬퍼 등 나머지는 실제 모듈을 쓴다.
const listSpaces = vi.fn();
const createSpace = vi.fn();
const createCollection = vi.fn();
vi.mock("@tablign/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tablign/core")>();
  return {
    ...actual,
    listSpaces: (...a: unknown[]) => listSpaces(...a),
    createSpace: (...a: unknown[]) => createSpace(...a),
    createCollection: (...a: unknown[]) => createCollection(...a),
    listCollections: vi.fn().mockResolvedValue([]),
    listLinks: vi.fn().mockResolvedValue([]),
  };
});

beforeEach(() => {
  listSpaces.mockReset();
  createSpace.mockReset();
  createCollection.mockReset();
  // jsdom 전역 chrome 스텁(test-setup)에 tabs API를 보강한다.
  vi.stubGlobal("chrome", {
    ...(globalThis as unknown as { chrome: object }).chrome,
    tabs: { query: vi.fn().mockResolvedValue([]) },
  });
});

function renderNewTab() {
  return render(
    <ToastProvider>
      <NewTab />
    </ToastProvider>,
  );
}

describe("NewTab — 스페이스가 없을 때", () => {
  it("온보딩 안내와 CTA 버튼을 보여준다", async () => {
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    expect(await screen.findByText(/매일 여는 탭, 매번 찾고 있나요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /첫 스페이스 만들기/ })).toBeInTheDocument();
  });

  it("CTA 클릭 시 '개인' 스페이스와 기본 컬렉션을 생성한다", async () => {
    listSpaces.mockResolvedValue([]);
    createSpace.mockResolvedValue({ id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x" });
    createCollection.mockResolvedValue({ id: "c1", space_id: "s1", user_id: "u1", title: "새 컬렉션", icon: null, note: null, position: 1000, created_at: "x" });
    renderNewTab();
    fireEvent.click(await screen.findByRole("button", { name: /첫 스페이스 만들기/ }));
    await waitFor(() => expect(createSpace).toHaveBeenCalledTimes(1));
    expect(createSpace.mock.calls[0][1]).toMatchObject({ name: "개인" });
    await waitFor(() => expect(createCollection).toHaveBeenCalledTimes(1));
  });

  it("스페이스가 있으면 온보딩 대신 보드를 보여준다", async () => {
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x" },
    ]);
    renderNewTab();
    // 스페이스 이름이 보드 헤더에 나타나고, 온보딩 문구는 없어야 한다.
    expect((await screen.findAllByText("개인")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/매일 여는 탭, 매번 찾고 있나요/)).not.toBeInTheDocument();
  });
});
