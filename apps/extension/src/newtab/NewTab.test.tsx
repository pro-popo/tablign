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

// 커스텀 토스 피커는 데이터(@emoji-mart/data)를 읽어 렌더하는 컴포넌트라
// jsdom 테스트에서는 가벼운 스텁으로 대체하고, 이모지 선택 플로우만 검증한다.
vi.mock("./TossEmojiPicker", () => ({
  TossEmojiPicker: ({ onSelect }: { onSelect: (n: string) => void }) => (
    <button type="button" onClick={() => onSelect("🎉")}>toss-picker-stub</button>
  ),
}));

// 데이터 계층 모킹: 함수만 대체하고 타입·정렬 헬퍼 등 나머지는 실제 모듈을 쓴다.
const listSpaces = vi.fn();
const createSpace = vi.fn();
const createCollection = vi.fn();
const createLink = vi.fn();
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
const updateOrganization = vi.fn();
const deleteOrganization = vi.fn();
const listOrgMembers = vi.fn();
const listOrgInvitations = vi.fn();
const listMyOrgInvitations = vi.fn();
const inviteToOrg = vi.fn();
const acceptOrgInvitation = vi.fn();
const declineOrgInvitation = vi.fn();
const cancelOrgInvitation = vi.fn();
const removeOrgMember = vi.fn();
const updateOrgMemberRole = vi.fn();
const importBookmarks = vi.fn();
vi.mock("@tablign/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tablign/core")>();
  return {
    ...actual,
    listSpaces: (...a: unknown[]) => listSpaces(...a),
    createSpace: (...a: unknown[]) => createSpace(...a),
    createCollection: (...a: unknown[]) => createCollection(...a),
    createLink: (...a: unknown[]) => createLink(...a),
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
    updateOrganization: (...a: unknown[]) => updateOrganization(...a),
    deleteOrganization: (...a: unknown[]) => deleteOrganization(...a),
    listOrgMembers: (...a: unknown[]) => listOrgMembers(...a),
    listOrgInvitations: (...a: unknown[]) => listOrgInvitations(...a),
    listMyOrgInvitations: (...a: unknown[]) => listMyOrgInvitations(...a),
    inviteToOrg: (...a: unknown[]) => inviteToOrg(...a),
    acceptOrgInvitation: (...a: unknown[]) => acceptOrgInvitation(...a),
    declineOrgInvitation: (...a: unknown[]) => declineOrgInvitation(...a),
    cancelOrgInvitation: (...a: unknown[]) => cancelOrgInvitation(...a),
    removeOrgMember: (...a: unknown[]) => removeOrgMember(...a),
    updateOrgMemberRole: (...a: unknown[]) => updateOrgMemberRole(...a),
    importBookmarks: (...a: unknown[]) => importBookmarks(...a),
  };
});

beforeEach(() => {
  listSpaces.mockReset();
  createSpace.mockReset();
  createCollection.mockReset();
  createCollection.mockImplementation(async (_s: unknown, input: { title: string }) => ({ id: `col-${input.title}`, title: input.title }));
  createLink.mockReset();
  createLink.mockResolvedValue({ id: "link-1" });
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
  // 인자를 반영한 org를 resolve — 다이얼로그 제출 후 화면에 새 조직이 실제로 나타나는지 검증할 수 있도록 한다.
  createOrganization.mockImplementation(
    async (_supabase: unknown, input: { name: string; owner_id: string; icon?: string | null; color?: string | null }) => ({
      id: "org-new",
      name: input.name,
      icon: input.icon ?? null,
      color: input.color ?? null,
      owner_id: input.owner_id,
      is_personal: false,
      created_at: "x",
    }),
  );
  updateOrganization.mockReset();
  updateOrganization.mockImplementation(
    async (_supabase: unknown, id: string, patch: { name: string; icon?: string | null; color?: string | null }) => ({
      id,
      name: patch.name,
      icon: patch.icon ?? null,
      color: patch.color ?? null,
      owner_id: "owner-x",
      is_personal: false,
      created_at: "x",
    }),
  );
  deleteOrganization.mockReset();
  deleteOrganization.mockResolvedValue(undefined);
  listOrgMembers.mockReset();
  listOrgMembers.mockResolvedValue([]);
  listOrgInvitations.mockReset();
  listOrgInvitations.mockResolvedValue([]);
  listMyOrgInvitations.mockReset();
  listMyOrgInvitations.mockResolvedValue([]);
  inviteToOrg.mockReset();
  acceptOrgInvitation.mockReset();
  declineOrgInvitation.mockReset();
  cancelOrgInvitation.mockReset();
  removeOrgMember.mockReset();
  updateOrgMemberRole.mockReset();
  importBookmarks.mockReset();
  importBookmarks.mockResolvedValue({ space_ids: ["space-new"], first_space_id: "space-new", links: 2 });
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

describe("NewTab — 컬렉션이 0개일 때", () => {
  const onlySpace = [
    { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
  ];
  /** 창 10 = http 2개 + tablign 새 탭, 창 20 = chrome:// 만(담을 게 없음) */
  function stubTabs(tabs: unknown[]) {
    vi.stubGlobal("chrome", {
      ...(globalThis as unknown as { chrome: object }).chrome,
      tabs: {
        query: vi.fn().mockResolvedValue(tabs),
        getCurrent: vi.fn().mockResolvedValue({ id: 3 }),
      },
    });
  }
  const MIXED = [
    { id: 1, windowId: 10, url: "https://a.com", title: "탭 A" },
    { id: 2, windowId: 10, url: "https://b.com", title: "탭 B" },
    { id: 3, windowId: 10, url: "chrome-extension://xyz/newtab.html", title: "tablign — 새 탭" },
    { id: 4, windowId: 20, url: "chrome://settings", title: "설정" },
  ];

  it("담을 수 있는 탭만 세어 안내한다 — 새 탭 자신과 chrome:// 는 제외", async () => {
    listSpaces.mockResolvedValue(onlySpace);
    stubTabs(MIXED);
    renderNewTab();

    // 첫 마운트는 스페이스→컬렉션→멤버십→조직을 순차로 기다린다.
    // findBy*가 돌려준 노드는 직후 리렌더(groups 도착)로 분리될 수 있으므로
    // 존재 확인은 재조회(getByText)로 한다.
    await screen.findByText("탭을 담을 첫 컬렉션을 만들어요", {}, { timeout: 4000 });
    // 담을 수 있는 탭은 https 2개, 그것이 있는 창은 1개뿐이므로 단일 창 문구로 갈린다
    await screen.findByText("지금 창의 탭 2개 담기", {}, { timeout: 4000 });
    expect(screen.getByText("탭을 담을 첫 컬렉션을 만들어요")).toBeInTheDocument();
    expect(screen.getByText("컬렉션은 탭을 모아두는 서랍이에요")).toBeInTheDocument();
  });

  it("'담기'는 담을 탭이 있는 창만 컬렉션으로 만든다 — 빈 창은 건너뛴다", async () => {
    listSpaces.mockResolvedValue(onlySpace);
    stubTabs(MIXED);
    renderNewTab();

    // groups 도착으로 리렌더되므로, 라벨이 확정된 뒤 클릭 시점에 버튼을 새로 조회한다.
    // 미리 캡처한 노드를 누르면 분리된 노드를 클릭해 아무 일도 일어나지 않는다.
    await screen.findByText("지금 창의 탭 2개 담기", {}, { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: /지금 창의 탭 2개 담기/ }));

    // 창 20(chrome:// 뿐)은 건너뛰므로 컬렉션은 1개만 생겨야 한다
    await waitFor(() => expect(createCollection).toHaveBeenCalledTimes(1));
    expect(createCollection.mock.calls[0][1]).toMatchObject({ space_id: "s1", title: "창 1" });
    // 링크는 http 2개만 — 새 탭 자신은 저장되지 않는다
    await waitFor(() => expect(createLink).toHaveBeenCalledTimes(2));
    expect(createLink.mock.calls.map((c) => (c[1] as { url: string }).url)).toEqual(["https://a.com", "https://b.com"]);
  });

  it("담을 수 있는 탭이 없으면 첫 카드를 비활성하고 아무것도 만들지 않는다", async () => {
    listSpaces.mockResolvedValue(onlySpace);
    stubTabs([{ id: 3, windowId: 10, url: "chrome-extension://xyz/newtab.html", title: "tablign — 새 탭" }]);
    renderNewTab();

    const dead = await screen.findByRole("button", { name: /열린 창 담기/ }, { timeout: 4000 });
    expect(dead).toBeDisabled();
    fireEvent.click(dead);
    expect(createCollection).not.toHaveBeenCalled();
  });
});

describe("NewTab — 공유 코드로 추가", () => {
  it("현재 활성 스페이스로 추가하면 보드를 즉시 재조회한다", async () => {
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    getShareCodeInfo.mockResolvedValue({ title: "공유 자료", icon: null, link_count: 2, shared_by: "앨리스" });
    importCollectionByCode.mockResolvedValue("new-col-id");
    renderNewTab();
    await screen.findAllByText("개인"); // 보드 로드 완료 대기

    const callsBefore = listCollections.mock.calls.length;

    // 진입점: 보드 헤더의 '＋ 컬렉션' split 버튼 ▾ → 메뉴 → 코드 입력 → 조회 → 추가.
    // 현재 스페이스가 기본 선택이라 스페이스 칩을 다시 누르지 않는다.
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 추가 방법" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "공유 코드로 추가" }));
    const dialog = screen.getByRole("dialog", { name: "공유 코드로 추가" });
    fireEvent.change(within(dialog).getByPlaceholderText(/공유 코드/), { target: { value: "ABCD2345" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /조회/ }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "추가" }));

    await waitFor(() => expect(importCollectionByCode).toHaveBeenCalledTimes(1));
    // 같은 스페이스라 activeSpaceId가 안 바뀌어도 보드가 다시 조회되어야 한다
    await waitFor(() => expect(listCollections.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});

describe("NewTab — 컬렉션 삭제", () => {
  const space = [
    { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
  ];
  const oneCollection = [
    { id: "c1", space_id: "s1", user_id: "u1", title: "읽을거리", icon: null, note: null, position: 1000, created_at: "x" },
  ];

  it("링크가 있으면 확인 다이얼로그를 거쳐야 실제 삭제한다", async () => {
    listSpaces.mockResolvedValue(space);
    listCollections.mockResolvedValue(oneCollection);
    listLinks.mockResolvedValue([
      { id: "l1", collection_id: "c1", user_id: "u1", url: "https://a.com", title: "A", favicon_url: null, thumbnail_url: null, custom_title: null, note: null, position: 1000, created_at: "x" },
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

  it("링크가 하나도 없으면 확인 없이 바로 삭제한다", async () => {
    listSpaces.mockResolvedValue(space);
    listCollections.mockResolvedValue(oneCollection);
    listLinks.mockResolvedValue([]); // 빈 컬렉션
    renderNewTab();
    await screen.findByText("읽을거리");

    fireEvent.click(screen.getByRole("button", { name: "컬렉션 삭제" }));
    await waitFor(() => expect(deleteCollection).toHaveBeenCalledTimes(1));
    expect(deleteCollection.mock.calls[0][1]).toBe("c1");
    // 다이얼로그는 뜨지 않고, 대신 토스트로 알린다
    expect(screen.queryByRole("alertdialog", { name: "컬렉션 삭제" })).not.toBeInTheDocument();
    expect(await screen.findByText(/'읽을거리' 컬렉션을 삭제했어요/)).toBeInTheDocument();
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

describe("NewTab — 조직(팀) 협업", () => {
  it("팀 조직 선택 시 조직 관리 메뉴에서 멤버 관리 다이얼로그가 열린다", async () => {
    listOrganizations.mockResolvedValue([
      { id: "org-personal", name: "개인", icon: null, color: null, owner_id: "u1", is_personal: true, created_at: "" },
      { id: "org-team", name: "우리팀", icon: null, color: null, owner_id: "owner-x", is_personal: false, created_at: "x" },
    ]);
    listMyOrgMemberships.mockResolvedValue([
      { org_id: "org-team", user_id: "u1", role: "admin", created_at: "x" },
    ]);
    listOrgMembers.mockResolvedValue([
      { user_id: "u2", role: "member", display_name: "밥", avatar_url: null },
    ]);
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    renderNewTab();
    await screen.findAllByText("개인");

    fireEvent.click(screen.getByText("우리팀"));

    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "멤버 관리" }));
    expect(await screen.findByRole("dialog", { name: "멤버 관리" })).toBeInTheDocument();
  });

  it("조직 초대를 수락하면 acceptOrgInvitation을 호출한다", async () => {
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    listMyOrgInvitations.mockResolvedValue([
      { id: "oinv1", org_id: "org-team", inviter_id: "o9", invitee_email: "u1@test.local", role: "member", status: "pending", created_at: "x", org_name: "다른팀", inviter_name: "캐롤" },
    ]);
    acceptOrgInvitation.mockResolvedValue(undefined);
    renderNewTab();
    fireEvent.click(await screen.findByRole("button", { name: /초대/ }));
    fireEvent.click(await screen.findByRole("button", { name: "수락" }));
    await waitFor(() => expect(acceptOrgInvitation).toHaveBeenCalledWith(expect.anything(), "oinv1"));
  });
});

describe("NewTab — 조직 생성·편집 다이얼로그", () => {
  it("레일 '조직 만들기'를 클릭하면 즉시 생성되지 않고 다이얼로그가 열리며, 제출 시 createOrganization을 호출한다", async () => {
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    renderNewTab();
    await screen.findAllByText("개인");

    fireEvent.click(screen.getByText("조직 만들기"));
    // 즉시 생성되지 않는다 — 다이얼로그가 뜬다.
    expect(createOrganization).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", { name: "새 조직 만들기" });

    fireEvent.change(within(dialog).getByPlaceholderText("조직 이름"), { target: { value: "새싹팀" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "만들기" }));

    await waitFor(() => expect(createOrganization).toHaveBeenCalledTimes(1));
    // 아이콘은 이제 필수 — 이모지를 고르지 않아도 무작위 기본 이모지가 실려 간다(값은 매번 달라질 수 있어 비어있지 않은 문자열인지만 확인한다).
    expect(createOrganization.mock.calls[0][1]).toMatchObject({ name: "새싹팀", owner_id: "u1" });
    const createdIcon = createOrganization.mock.calls[0][1].icon;
    expect(typeof createdIcon).toBe("string");
    expect(createdIcon.length).toBeGreaterThan(0);
    // 제출 후 다이얼로그는 닫힌다.
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "새 조직 만들기" })).not.toBeInTheDocument());
  });

  it("조직 다이얼로그에서 이모지 ＋(전체 선택)을 누르면 토스 피커가 열리고, 이모지를 고르면 커스텀 슬롯과 제출 값에 반영된다", async () => {
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    renderNewTab();
    await screen.findAllByText("개인");

    fireEvent.click(screen.getByText("조직 만들기"));
    const dialog = await screen.findByRole("dialog", { name: "새 조직 만들기" });

    // 이모지 ＋(전체 선택) 버튼을 눌러 토스 피커를 연다.
    fireEvent.click(within(dialog).getByRole("button", { name: "이모지 전체 선택" }));
    fireEvent.click(await within(dialog).findByText("toss-picker-stub"));

    // 선택한(대표 외) 이모지가 커스텀 슬롯에 반영되고, 피커는 닫힌다.
    expect(within(dialog).getByRole("button", { name: "이모지 🎉" })).toBeInTheDocument();
    expect(within(dialog).queryByText("toss-picker-stub")).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText("조직 이름"), { target: { value: "새싹팀2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "만들기" }));

    await waitFor(() =>
      expect(createOrganization.mock.calls.at(-1)?.[1]).toMatchObject({ name: "새싹팀2", icon: "🎉" }),
    );
  });

  it("팀 조직 관리자가 헤더 아바타(편집)를 클릭하면 기존 값으로 편집 다이얼로그가 열리고, 저장 시 updateOrganization이 반영된 이름으로 호출된다", async () => {
    listOrganizations.mockResolvedValue([
      { id: "org-personal", name: "개인", icon: null, color: null, owner_id: "u1", is_personal: true, created_at: "" },
      { id: "org-team", name: "우리팀", icon: null, color: "#20a97e", owner_id: "owner-x", is_personal: false, created_at: "x" },
    ]);
    listMyOrgMemberships.mockResolvedValue([
      { org_id: "org-team", user_id: "u1", role: "admin", created_at: "x" },
    ]);
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    renderNewTab();
    await screen.findAllByText("개인");

    fireEvent.click(screen.getByText("우리팀"));

    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" })); // 팀 헤더 로드 대기 겸
    fireEvent.click(await screen.findByRole("menuitem", { name: "프로필 설정" }));
    const dialog = await screen.findByRole("dialog", { name: "프로필 설정" });
    expect(within(dialog).getByPlaceholderText("조직 이름")).toHaveValue("우리팀");

    fireEvent.change(within(dialog).getByPlaceholderText("조직 이름"), { target: { value: "우리팀2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(updateOrganization).toHaveBeenCalledWith(expect.anything(), "org-team", expect.objectContaining({ name: "우리팀2" })),
    );
    expect((await screen.findAllByText("우리팀2")).length).toBeGreaterThan(0);
  });

  it("팀 조직 소유자는 설정 다이얼로그에서 '조직 삭제' → 확인 시 deleteOrganization을 호출한다", async () => {
    listOrganizations.mockResolvedValue([
      { id: "org-personal", name: "개인", icon: null, color: null, owner_id: "u1", is_personal: true, created_at: "" },
      { id: "org-team", name: "우리팀", icon: null, color: "#20a97e", owner_id: "u1", is_personal: false, created_at: "x" },
    ]);
    listMyOrgMemberships.mockResolvedValue([
      { org_id: "org-team", user_id: "u1", role: "owner", created_at: "x" },
    ]);
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    renderNewTab();
    await screen.findAllByText("개인");

    fireEvent.click(screen.getByText("우리팀"));
    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "조직 삭제" }));
    // 확인 모달의 삭제 버튼
    fireEvent.click(await screen.findByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(deleteOrganization).toHaveBeenCalledWith(expect.anything(), "org-team"),
    );
  });

  it("개인 조직도 '조직 관리'(톱니 메뉴)가 노출되고, 메뉴에는 '프로필 설정'만 있다(멤버 관리·조직 삭제 없음)", async () => {
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    renderNewTab();
    await screen.findAllByText("개인");

    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    expect(await screen.findByRole("menuitem", { name: "프로필 설정" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "멤버 관리" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "조직 삭제" })).not.toBeInTheDocument();
  });

  it("개인 조직 프로필 설정 다이얼로그는 이름 입력이 없고, 저장 시 name: '개인'·개인 기본색(옐로우 그라데이션)으로 호출된다", async () => {
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    renderNewTab();
    await screen.findAllByText("개인");

    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "프로필 설정" }));
    const dialog = await screen.findByRole("dialog", { name: "프로필 설정" });
    expect(within(dialog).queryByPlaceholderText("조직 이름")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() =>
      // 개인은 color=null이라 다이얼로그가 개인 기본색(옐로우 그라데이션)으로 떠야 레일·헤더 배경과 일치한다(인디고 기본색 아님).
      expect(updateOrganization).toHaveBeenCalledWith(expect.anything(), "org-personal", expect.objectContaining({ name: "개인", color: expect.stringMatching(/ffd43b/i) })),
    );
  });

  it("프로필 설정에서 그라데이션을 지정하면 그라데이션 문자열로 저장된다", async () => {
    listOrganizations.mockResolvedValue([
      { id: "org-personal", name: "개인", icon: null, color: null, owner_id: "u1", is_personal: true, created_at: "" },
      { id: "org-team", name: "우리팀", icon: null, color: "#20a97e", owner_id: "owner-x", is_personal: false, created_at: "x" },
    ]);
    listMyOrgMemberships.mockResolvedValue([
      { org_id: "org-team", user_id: "u1", role: "admin", created_at: "x" },
    ]);
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    renderNewTab();
    await screen.findAllByText("개인");

    fireEvent.click(screen.getByText("우리팀"));
    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "프로필 설정" }));
    const dialog = await screen.findByRole("dialog", { name: "프로필 설정" });

    // 색상 섹션의 '그라데이션' 줄에서 그라데이션 프리셋을 클릭해 지정한다.
    fireEvent.click(within(dialog).getByRole("button", { name: "그라데이션 1" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(updateOrganization).toHaveBeenCalledWith(
        expect.anything(), "org-team",
        expect.objectContaining({ color: expect.stringMatching(/^linear-gradient\(135deg,/) }),
      ),
    );
  });
});

describe("NewTab — 북마크 가져오기", () => {
  /** beforeEach의 chrome 스텁(tabs·storage)을 유지하면서 bookmarks만 보강한다. */
  function stubBookmarks(children: unknown[]) {
    vi.stubGlobal("chrome", {
      ...(globalThis as unknown as { chrome: object }).chrome,
      bookmarks: {
        getTree: () => Promise.resolve([{ id: "0", title: "", children }]),
      },
    });
  }

  const bar = [{
    id: "1", title: "북마크바", children: [
      { id: "dev", title: "개발", children: [
        { id: "l1", title: "A", url: "https://a.com/1" },
        { id: "l2", title: "B", url: "https://b.com/1" },
      ]},
    ],
  }];

  it("조직 메뉴에서 열면 내 북마크가 미리보기로 나온다", async () => {
    stubBookmarks(bar);
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "가져오기" }));
    fireEvent.click(await screen.findByRole("button", { name: /Chrome 북마크/ }));

    expect(await screen.findByTestId("preview-space-dev")).toBeInTheDocument();
    // 링크 2개가 폴더 직속이므로 공유 폴더 컬렉션 하나가 된다
    expect(screen.getByTestId("preview-col-dev")).toHaveTextContent("공유 폴더");
  });

  it("조직이 개인 하나뿐이면 목적지를 읽기 전용으로 보여준다", async () => {
    stubBookmarks(bar);
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "가져오기" }));
    fireEvent.click(await screen.findByRole("button", { name: /Chrome 북마크/ }));

    expect(await screen.findByTestId("import-org-fixed")).toHaveTextContent("개인");
    expect(screen.queryByLabelText("가져올 조직")).not.toBeInTheDocument();
  });

  it("가져오기를 누르면 계획을 그대로 넘기고 토스트를 띄운다", async () => {
    stubBookmarks(bar);
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "가져오기" }));
    fireEvent.click(await screen.findByRole("button", { name: /Chrome 북마크/ }));
    await screen.findByTestId("preview-space-dev");

    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));

    await waitFor(() => expect(importBookmarks).toHaveBeenCalledTimes(1));
    const [, orgId, plan] = importBookmarks.mock.calls[0] as [unknown, string, {
      spaces: { name: string; collections: { title: string; links: { url: string; favicon_url: string | null }[] }[] }[];
    }];
    expect(orgId).toBe("org-personal");
    expect(plan.spaces).toHaveLength(1);
    expect(plan.spaces[0].name).toBe("개발");
    expect(plan.spaces[0].collections[0].title).toBe("공유 폴더");
    expect(plan.spaces[0].collections[0].links.map((l) => l.url))
      .toEqual(["https://a.com/1", "https://b.com/1"]);
    expect(plan.spaces[0].collections[0].links[0].favicon_url).toBe("https://a.com/favicon.ico");

    expect(await screen.findByText(/스페이스 1개를 만들었어요/)).toBeInTheDocument();
  });

  it("가져오기가 실패하면 다이얼로그를 닫지 않는다", async () => {
    stubBookmarks(bar);
    importBookmarks.mockRejectedValue(new Error("boom"));
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "가져오기" }));
    fireEvent.click(await screen.findByRole("button", { name: /Chrome 북마크/ }));
    await screen.findByTestId("preview-space-dev");

    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));

    expect(await screen.findByText(/가져오지 못했어요/)).toBeInTheDocument();
    expect(screen.getByTestId("preview-space-dev")).toBeInTheDocument();
  });

  it("온보딩 화면에서도 가져오기로 들어갈 수 있다", async () => {
    stubBookmarks(bar);
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    await screen.findByRole("button", { name: /첫 스페이스 만들기/ });

    fireEvent.click(screen.getByRole("button", { name: /북마크·Toby 가져오기/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Chrome 북마크/ }));

    expect(await screen.findByTestId("preview-space-dev")).toBeInTheDocument();
  });

  it("Toby 파일을 고르면 group→스페이스, list→컬렉션으로 미리보기가 나온다", async () => {
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "가져오기" }));

    const toby = JSON.stringify({
      version: 4,
      groups: [{
        name: "KB 검진대행", type: "public", lists: [{
          title: "Client", labelIds: [], cards: [
            { title: "assist-frontend", url: "https://github.com/huray/assist",
              favIconUrl: "https://github.githubassets.com/favicon.svg", customTitle: "" },
          ],
        }],
      }],
      labels: {},
    });
    const file = new File([toby], "Huray-export.json", { type: "application/json" });
    fireEvent.change(await screen.findByTestId("toby-file-input"), { target: { files: [file] } });

    // group이 스페이스, list가 컬렉션
    expect(await screen.findByTestId("preview-space-toby:0")).toBeInTheDocument();
    expect(screen.getByTestId("preview-col-toby:0:0")).toHaveTextContent("Client");
    expect(screen.getByRole("dialog", { name: "Toby 가져오기" })).toBeInTheDocument();

    // 가져오기 실행 — Toby가 준 파비콘이 그대로 페이로드에 실린다
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    await waitFor(() => expect(importBookmarks).toHaveBeenCalledTimes(1));
    const [, , plan] = importBookmarks.mock.calls[0] as [unknown, string, {
      spaces: { name: string; collections: { title: string; links: { favicon_url: string | null }[] }[] }[];
    }];
    expect(plan.spaces[0].name).toBe("KB 검진대행");
    expect(plan.spaces[0].collections[0].links[0].favicon_url)
      .toBe("https://github.githubassets.com/favicon.svg");
  });

  it("Toby 파일이 아니면 토스트를 띄우고 미리보기를 열지 않는다", async () => {
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "가져오기" }));

    const file = new File(["{\"foo\":1}"], "wrong.json", { type: "application/json" });
    fireEvent.change(await screen.findByTestId("toby-file-input"), { target: { files: [file] } });

    expect(await screen.findByText(/Toby 내보내기 파일이 아니에요/)).toBeInTheDocument();
    expect(screen.queryByTestId("import-summary")).not.toBeInTheDocument();
  });
});
