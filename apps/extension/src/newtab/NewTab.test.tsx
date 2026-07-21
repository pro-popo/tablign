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

// emoji-mart는 shadow DOM 커스텀 엘리먼트를 실제로 마운트하는 무거운 컴포넌트라
// jsdom에서는 가벼운 스텁으로 대체하고, 이모지 선택 플로우 자체만 검증한다.
vi.mock("@emoji-mart/react", () => ({
  default: ({ onEmojiSelect }: { onEmojiSelect: (e: { native: string }) => void }) => (
    <button type="button" onClick={() => onEmojiSelect({ native: "🎉" })}>emoji-mart-stub</button>
  ),
}));
vi.mock("@emoji-mart/data", () => ({ default: {} }));

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
const updateOrganization = vi.fn();
const listOrgMembers = vi.fn();
const listOrgInvitations = vi.fn();
const listMyOrgInvitations = vi.fn();
const inviteToOrg = vi.fn();
const acceptOrgInvitation = vi.fn();
const declineOrgInvitation = vi.fn();
const cancelOrgInvitation = vi.fn();
const removeOrgMember = vi.fn();
const updateOrgMemberRole = vi.fn();
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
    updateOrganization: (...a: unknown[]) => updateOrganization(...a),
    listOrgMembers: (...a: unknown[]) => listOrgMembers(...a),
    listOrgInvitations: (...a: unknown[]) => listOrgInvitations(...a),
    listMyOrgInvitations: (...a: unknown[]) => listMyOrgInvitations(...a),
    inviteToOrg: (...a: unknown[]) => inviteToOrg(...a),
    acceptOrgInvitation: (...a: unknown[]) => acceptOrgInvitation(...a),
    declineOrgInvitation: (...a: unknown[]) => declineOrgInvitation(...a),
    cancelOrgInvitation: (...a: unknown[]) => cancelOrgInvitation(...a),
    removeOrgMember: (...a: unknown[]) => removeOrgMember(...a),
    updateOrgMemberRole: (...a: unknown[]) => updateOrgMemberRole(...a),
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

describe("NewTab — 조직(팀) 협업", () => {
  it("팀 조직 선택 시 역할칩·멤버 아바타가 보이고, 멤버 버튼 클릭 시 조직 멤버 다이얼로그가 열린다", async () => {
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
    expect(await screen.findByText("관리자")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "조직 설정" }));
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
    // 아이콘은 이제 필수 — 이모지를 고르지 않아도 기본 이모지(🚀)가 실려 간다.
    expect(createOrganization.mock.calls[0][1]).toMatchObject({ name: "새싹팀", owner_id: "u1", icon: "🚀" });
    // 제출 후 다이얼로그는 닫힌다.
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "새 조직 만들기" })).not.toBeInTheDocument());
  });

  it("조직 다이얼로그의 아바타를 클릭하면 emoji-mart 피커가 열리고, 이모지를 고르면 아바타와 제출 값에 반영된다", async () => {
    listSpaces.mockResolvedValue([
      { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
    ]);
    renderNewTab();
    await screen.findAllByText("개인");

    fireEvent.click(screen.getByText("조직 만들기"));
    const dialog = await screen.findByRole("dialog", { name: "새 조직 만들기" });

    // 기본 아바타는 항상 이모지(🚀)를 보여준다 — 이니셜로 대체되는 경로는 없다.
    expect(within(dialog).getByRole("button", { name: "아이콘 선택" })).toHaveTextContent("🚀");

    fireEvent.click(within(dialog).getByRole("button", { name: "아이콘 선택" }));
    fireEvent.click(await within(dialog).findByText("emoji-mart-stub"));

    // 선택한 이모지가 아바타에 즉시 반영되고, 피커는 닫힌다.
    expect(within(dialog).getByRole("button", { name: "아이콘 선택" })).toHaveTextContent("🎉");
    expect(within(dialog).queryByText("emoji-mart-stub")).not.toBeInTheDocument();

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
    await screen.findByText("관리자"); // 팀 헤더 로드 대기

    fireEvent.click(screen.getByRole("button", { name: "조직 편집" }));
    const dialog = await screen.findByRole("dialog", { name: "조직 설정" });
    expect(within(dialog).getByPlaceholderText("조직 이름")).toHaveValue("우리팀");

    fireEvent.change(within(dialog).getByPlaceholderText("조직 이름"), { target: { value: "우리팀2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(updateOrganization).toHaveBeenCalledWith(expect.anything(), "org-team", expect.objectContaining({ name: "우리팀2" })),
    );
    expect((await screen.findAllByText("우리팀2")).length).toBeGreaterThan(0);
  });
});
