import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
const listCollections = vi.fn();
const listMyMemberships = vi.fn();
const listLinks = vi.fn();
const getShareCodeInfo = vi.fn();
const deleteCollection = vi.fn();
const importCollectionByCode = vi.fn();
const listMembers = vi.fn();
const listSpaceInvitations = vi.fn();
const inviteToSpace = vi.fn();
const listMyInvitations = vi.fn();
const acceptInvitation = vi.fn();
const listOrganizations = vi.fn();
const listMyOrgMemberships = vi.fn();
const createOrganization = vi.fn();
vi.mock("@tablign/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tablign/core")>();
  return {
    ...actual,
    listSpaces: (...a: unknown[]) => listSpaces(...a),
    createSpace: (...a: unknown[]) => createSpace(...a),
    createCollection: (...a: unknown[]) => createCollection(...a),
    listCollections: (...a: unknown[]) => listCollections(...a),
    listMyMemberships: (...a: unknown[]) => listMyMemberships(...a),
    listLinks: (...a: unknown[]) => listLinks(...a),
    getShareCodeInfo: (...a: unknown[]) => getShareCodeInfo(...a),
    deleteCollection: (...a: unknown[]) => deleteCollection(...a),
    importCollectionByCode: (...a: unknown[]) => importCollectionByCode(...a),
    listMembers: (...a: unknown[]) => listMembers(...a),
    listSpaceInvitations: (...a: unknown[]) => listSpaceInvitations(...a),
    inviteToSpace: (...a: unknown[]) => inviteToSpace(...a),
    listMyInvitations: (...a: unknown[]) => listMyInvitations(...a),
    acceptInvitation: (...a: unknown[]) => acceptInvitation(...a),
    listOrganizations: (...a: unknown[]) => listOrganizations(...a),
    listMyOrgMemberships: (...a: unknown[]) => listMyOrgMemberships(...a),
    createOrganization: (...a: unknown[]) => createOrganization(...a),
  };
});

beforeEach(() => {
  listSpaces.mockReset();
  createSpace.mockReset();
  createCollection.mockReset();
  listCollections.mockReset();
  listCollections.mockResolvedValue([]);
  listMyMemberships.mockReset();
  listMyMemberships.mockResolvedValue([]);
  listLinks.mockReset();
  listLinks.mockResolvedValue([]);
  getShareCodeInfo.mockReset();
  deleteCollection.mockReset();
  deleteCollection.mockResolvedValue(undefined);
  importCollectionByCode.mockReset();
  listMembers.mockReset();
  listMembers.mockResolvedValue([]);
  listSpaceInvitations.mockReset();
  listSpaceInvitations.mockResolvedValue([]);
  inviteToSpace.mockReset();
  listMyInvitations.mockReset();
  listMyInvitations.mockResolvedValue([]);
  acceptInvitation.mockReset();
  listOrganizations.mockReset();
  listOrganizations.mockResolvedValue([
    { id: "org-personal", name: "개인", icon: null, color: null, owner_id: "u1", is_personal: true, created_at: "" },
  ]);
  listMyOrgMemberships.mockReset();
  listMyOrgMemberships.mockResolvedValue([]);
  createOrganization.mockReset();
  // jsdom 전역 chrome 스텁(test-setup)에 tabs API를 보강하고,
  // activeSpace와 동일하게 activeOrg도 저장값 없이 {}를 돌려주게 해 컴포넌트의 개인 조직 폴백을 태운다.
  vi.stubGlobal("chrome", {
    ...(globalThis as unknown as { chrome: object }).chrome,
    tabs: { query: vi.fn().mockResolvedValue([]) },
    storage: {
      local: {
        get: (_keys: unknown, cb?: (items: Record<string, unknown>) => void) => cb?.({}),
        set: (_items: unknown, cb?: () => void) => cb?.(),
        remove: (_keys: unknown, cb?: () => void) => cb?.(),
      },
    },
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
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    renderNewTab();
    // 스페이스 이름이 보드 헤더에 나타나고, 온보딩 문구는 없어야 한다.
    expect((await screen.findAllByText("개인")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/매일 여는 탭, 매번 찾고 있나요/)).not.toBeInTheDocument();
  });
});

describe("NewTab — 코드로 가져오기", () => {
  it("현재 활성 스페이스로 가져오면 보드를 즉시 재조회한다", async () => {
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    getShareCodeInfo.mockResolvedValue({ title: "공유 자료", icon: null, link_count: 2, shared_by: "앨리스" });
    importCollectionByCode.mockResolvedValue("new-col-id");
    renderNewTab();
    await screen.findAllByText("개인"); // 보드 로드 완료 대기

    const callsBefore = listCollections.mock.calls.length;

    // 사이드바 진입점 → 코드 입력 → 조회 → (현재와 같은) 스페이스 선택 → 가져오기
    fireEvent.click(screen.getByRole("button", { name: "코드로 가져오기" }));
    const dialog = screen.getByRole("dialog", { name: "코드로 가져오기" });
    fireEvent.change(within(dialog).getByPlaceholderText(/공유 코드/), { target: { value: "ABCD2345" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /조회/ }));
    fireEvent.click(await within(dialog).findByRole("button", { name: /개인/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /가져오기/ }));

    await waitFor(() => expect(importCollectionByCode).toHaveBeenCalledTimes(1));
    // 같은 스페이스라 activeSpaceId가 안 바뀌어도 보드가 다시 조회되어야 한다
    await waitFor(() => expect(listCollections.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});

describe("NewTab — 컬렉션 삭제", () => {
  it("삭제 버튼은 확인 다이얼로그를 거쳐야 실제 삭제한다", async () => {
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    listCollections.mockResolvedValue([
      { id: "c1", space_id: "s1", user_id: "u1", title: "읽을거리", icon: null, note: null, position: 1000, created_at: "x" },
    ]);
    renderNewTab();
    await screen.findByText("읽을거리");

    fireEvent.click(screen.getByRole("button", { name: "컬렉션 삭제" }));
    // 아직 삭제 안 됨 — 확인 다이얼로그가 떠야 한다
    expect(deleteCollection).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog", { name: "컬렉션 삭제" });
    expect(within(dialog).getByText(/읽을거리/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteCollection).toHaveBeenCalledTimes(1));
    expect(deleteCollection.mock.calls[0][1]).toBe("c1");
  });
});

describe("NewTab — viewer 모드", () => {
  it("viewer로 연 공유 스페이스에서는 '＋ 컬렉션' 버튼이 숨겨진다", async () => {
    listSpaces.mockResolvedValue([
      { id: "shared1", user_id: "owner-x", name: "공유됨", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    listMyMemberships.mockResolvedValue([
      { space_id: "shared1", user_id: "u1", role: "viewer", position: 1000, created_at: "x" },
    ]);
    listCollections.mockResolvedValue([]);
    renderNewTab();
    await screen.findAllByText("공유됨");
    expect(screen.queryByRole("button", { name: /컬렉션$/ })).not.toBeInTheDocument();
  });

  it("editor로 연 공유 스페이스에서는 '＋ 컬렉션' 버튼이 보인다", async () => {
    listSpaces.mockResolvedValue([
      { id: "shared1", user_id: "owner-x", name: "공유됨", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    listMyMemberships.mockResolvedValue([
      { space_id: "shared1", user_id: "u1", role: "editor", position: 1000, created_at: "x" },
    ]);
    listCollections.mockResolvedValue([]);
    renderNewTab();
    await screen.findAllByText("공유됨");
    expect(screen.getByRole("button", { name: /컬렉션$/ })).toBeInTheDocument();
  });

  it("viewer로 연 공유 스페이스에서 링크 삭제 버튼이 렌더되지 않는다", async () => {
    listSpaces.mockResolvedValue([
      { id: "shared1", user_id: "owner-x", name: "공유됨", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    listMyMemberships.mockResolvedValue([
      { space_id: "shared1", user_id: "u1", role: "viewer", position: 1000, created_at: "x" },
    ]);
    listCollections.mockResolvedValue([
      { id: "c1", space_id: "shared1", user_id: "owner-x", title: "공유 컬렉션", icon: null, note: null, position: 1000, created_at: "x" },
    ]);
    listLinks.mockResolvedValue([
      { id: "l1", collection_id: "c1", user_id: "owner-x", url: "https://a.com", title: "A", favicon_url: null, thumbnail_url: null, custom_title: null, note: null, position: 1000, created_at: "x" },
    ]);
    renderNewTab();
    await screen.findByText("A");
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
  });

  it("editor로 연 공유 스페이스에서는 링크 삭제 버튼이 렌더된다", async () => {
    listSpaces.mockResolvedValue([
      { id: "shared1", user_id: "owner-x", name: "공유됨", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    listMyMemberships.mockResolvedValue([
      { space_id: "shared1", user_id: "u1", role: "editor", position: 1000, created_at: "x" },
    ]);
    listCollections.mockResolvedValue([
      { id: "c1", space_id: "shared1", user_id: "owner-x", title: "공유 컬렉션", icon: null, note: null, position: 1000, created_at: "x" },
    ]);
    listLinks.mockResolvedValue([
      { id: "l1", collection_id: "c1", user_id: "owner-x", url: "https://a.com", title: "A", favicon_url: null, thumbnail_url: null, custom_title: null, note: null, position: 1000, created_at: "x" },
    ]);
    renderNewTab();
    await screen.findByText("A");
    expect(screen.queryByRole("button", { name: "삭제" })).not.toBeNull();
  });
});

describe("NewTab — 멤버 관리·초대 알림", () => {
  it("오너 스페이스에서 멤버 버튼을 누르면 멤버 다이얼로그가 열린다", async () => {
    listSpaces.mockResolvedValue([{ id: "s1", user_id: "u1", name: "내 스페이스", icon: null, position: 1000, created_at: "x", org_id: "org-personal" }]);
    listMyMemberships.mockResolvedValue([]); // 내가 오너
    listCollections.mockResolvedValue([]);
    listMembers.mockResolvedValue([]);
    listSpaceInvitations.mockResolvedValue([]);
    renderNewTab();
    await screen.findAllByText("내 스페이스");
    fireEvent.click(screen.getByRole("button", { name: "멤버" }));
    expect(await screen.findByRole("dialog", { name: "멤버 관리" })).toBeInTheDocument();
  });

  it("받은 초대가 있으면 알림 배지가 보이고 수락하면 acceptInvitation을 호출한다", async () => {
    listSpaces.mockResolvedValue([{ id: "s1", user_id: "u1", name: "내 스페이스", icon: null, position: 1000, created_at: "x", org_id: "org-personal" }]);
    listMyMemberships.mockResolvedValue([]);
    listCollections.mockResolvedValue([]);
    listMyInvitations.mockResolvedValue([{ id: "inv1", space_id: "s9", inviter_id: "o9", invitee_email: "u1@test.local", role: "viewer", status: "pending", created_at: "x", space_name: "초대된 스페이스", inviter_name: "앨리스" }]);
    acceptInvitation.mockResolvedValue(undefined);
    renderNewTab();
    fireEvent.click(await screen.findByRole("button", { name: /초대/ }));
    fireEvent.click(await screen.findByRole("button", { name: "수락" }));
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith(expect.anything(), "inv1"));
  });
});
