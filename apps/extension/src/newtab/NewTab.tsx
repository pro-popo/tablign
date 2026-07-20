import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  DndContext, DragOverlay, PointerSensor, pointerWithin, MeasuringStrategy, useSensor, useSensors,
  type CollisionDetection, type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const collisionDetection: CollisionDetection = (args) => {
  // 컬렉션 드래그 중에는 컬렉션 정렬 대상(col:)만 후보로 한정.
  if (args.active?.data?.current?.kind === "collection") {
    return pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith("col:")),
    });
  }
  // 스페이스 드래그 중에는 스페이스 정렬 대상(space:)만 후보로 한정.
  if (args.active?.data?.current?.kind === "space") {
    return pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith("space:")),
    });
  }
  const hits = pointerWithin(args);
  // 카드(탭/링크) > 컨테이너(컬렉션 container:/창 window:/컬렉션 정렬 col:/스페이스 정렬 space:) 순으로 우선.
  const cardHit = hits.find((h) => {
    const id = String(h.id);
    return !id.startsWith("container:") && !id.startsWith("window:") && !id.startsWith("col:") && !id.startsWith("space:");
  });
  return cardHit ? [cardHit] : hits;
};
import { AppShell, Board, CollectionSection, CollectionSkeleton, EmptyState, Button, Favicon, theme, Plus, CollectionMoreMenu, useToast, SpaceOnboarding, ShareCodeDialog, ImportCodeDialog, ConfirmDialog, MemberDialog, InvitationList, MemberAvatars, Users } from "@tablign/ui";
import {
  listSpaces, listMyMemberships, leaveSpace, listCollections, listLinks, createLink, createCollection, createSpace, moveLink, deleteLink, deleteCollection,
  updateLink, updateCollection, updateSpace, deleteSpace as apiDeleteSpace, sequentialPositions,
  copyCollection, moveCollectionToSpace,
  createCollectionShareCode, revokeCollectionShareCode, getShareCodeInfo, importCollectionByCode,
  listMembers, removeMember, updateMemberRole, inviteToSpace, listSpaceInvitations, cancelInvitation, listMyInvitations, acceptInvitation, declineInvitation,
  listOrganizations, createOrganization, listMyOrgMemberships, listOrgMembers, removeOrgMember, updateOrgMemberRole,
  inviteToOrg, listOrgInvitations, cancelOrgInvitation, listMyOrgInvitations, acceptOrgInvitation, declineOrgInvitation,
  type Collection, type Link, type Space, type ShareCode, type SpaceMember, type MemberWithProfile, type SpaceInvitation, type InvitationWithSpace,
  type Organization, type OrganizationMember, type OrgMemberWithProfile, type OrganizationInvitation, type OrgInvitationWithOrg,
} from "@tablign/core";
import { supabase } from "../lib/supabase";
import { tabsToLinkInputs, tabDropToLinkInput, groupTabsByWindow, moveTab, resolveTabDropTarget, parseTabDragId, type WindowGroup, type WindowTab } from "../lib/tabs";
import { usePanelState } from "../lib/usePanelState";
import { useActiveSpace } from "../lib/useActiveSpace";
import { useActiveOrg } from "../lib/useActiveOrg";
import { OpenTabsPanel } from "./OpenTabsPanel";
import { ExtSidebar } from "./ExtSidebar";
import { OrgRail } from "./OrgRail";
import { ExtSearchBar } from "./ExtSearchBar";
import { DndLinkList } from "./DndLinkList";
import { AuthScreen } from "./AuthScreen";
import { OrgHeader, type OrgRole } from "./OrgHeader";

interface DragPreview { label: string; faviconUrl: string | null; domain: string }

function openUrl(url: string) { chrome.tabs.create({ url }); }

const NEW_TAB_PLACEHOLDER = "__newtab__";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type Active =
  | { type: "tab"; tab: WindowTab }
  | { type: "link"; link: Link }
  | { type: "collection"; collection: Collection }
  | { type: "space"; space: Space }
  | null;

/** 컬렉션 제목을 드래그 핸들로 쓰는 정렬 래퍼. children에 제목에 연결할 ref/props를 넘긴다. */
function SortableCollection({
  collection, children,
}: {
  collection: Collection;
  children: (drag: { ref: (el: HTMLElement | null) => void; props: Record<string, unknown> }) => ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `col:${collection.id}`,
    data: { kind: "collection", collection },
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="tablign-col">
      {children({ ref: setActivatorNodeRef, props: { ...attributes, ...listeners } })}
    </div>
  );
}

export function NewTab() {
  const [session, setSession] = useState<Session | null>(null);
  // 세션 복원(getSession)은 비동기라, 끝나기 전 session=null로 로그인 화면이 깜빡인다.
  // "확인 중"을 별도 상태로 두고 그 동안 렌더를 보류해 깜빡임을 막는다.
  const [authLoaded, setAuthLoaded] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [memberships, setMemberships] = useState<SpaceMember[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgMemberships, setOrgMemberships] = useState<OrganizationMember[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberWithProfile[]>([]);
  // 조직 멤버 관리 다이얼로그 열림 상태(다이얼로그 본체는 Task 5에서 추가).
  const [orgMemberDialogOpen, setOrgMemberDialogOpen] = useState(false);
  const { activeOrgId, setActiveOrgId, loaded: orgLoaded } = useActiveOrg();
  // 스페이스 목록 로드 완료 여부. 0개(신규 가입·전부 삭제)와 "아직 로딩 중"을 구분해
  // 온보딩 화면과 스켈레톤을 올바르게 가른다.
  const [spacesLoaded, setSpacesLoaded] = useState(false);
  const { activeSpaceId, setActiveSpaceId, loaded: spaceLoaded } = useActiveSpace();
  const [collections, setCollections] = useState<Collection[]>([]);
  // 첫 컬렉션 로드 완료 전에는 EmptyState 대신 스켈레톤을 보여줘 깜빡임을 막는다.
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const [linksByCol, setLinksByCol] = useState<Record<string, Link[]>>({});
  // 드래그 중 onDragEnd가 최신 상태를 읽도록 ref로 동기 보관(state 배칭 레이스 방지).
  const linksByColRef = useRef<Record<string, Link[]>>({});
  useEffect(() => { linksByColRef.current = linksByCol; }, [linksByCol]);
  // 컬렉션 드래그: onDragEnd가 최신 순서를 읽도록 ref 보관 + 취소 시 복원용 시작 스냅샷.
  const collectionsRef = useRef<Collection[]>([]);
  useEffect(() => { collectionsRef.current = collections; }, [collections]);
  const collectionsOriginRef = useRef<Collection[]>([]);
  // 스페이스 드래그: onDragEnd가 최신 순서를 읽도록 ref 보관 + 취소 시 복원용 시작 스냅샷.
  const spacesRef = useRef<Space[]>([]);
  useEffect(() => { spacesRef.current = spaces; }, [spaces]);
  const spacesOriginRef = useRef<Space[]>([]);
  // 드래그 시작 시점의 원래 컬렉션(링크 객체의 collection_id가 드래그 중 갱신되므로 시작값을 보관).
  const dragOriginRef = useRef<string | null>(null);
  // 드래그 중 onDragEnd가 최신 groups를 읽도록 ref로 동기 보관.
  const groupsRef = useRef<WindowGroup[]>([]);
  // 드래그 시작 시점의 groups 스냅샷(탭이 컬렉션 위로 돌아오거나 취소될 때 원복용).
  const groupsOriginRef = useRef<WindowGroup[]>([]);
  const [groups, setGroups] = useState<WindowGroup[]>([]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  const [active, setActive] = useState<Active>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  const { state: panels, toggleLeft, toggleRight, setLeftWidth, setRightWidth } = usePanelState();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // 조직 로드: 활성 조직을 chrome.storage에서 읽은 뒤 실행. 저장값이 없으면 개인 조직으로 폴백.
  useEffect(() => {
    if (!session || !orgLoaded) return;
    (async () => {
      const [orgs, oms] = await Promise.all([listOrganizations(supabase), listMyOrgMemberships(supabase)]);
      setOrganizations(orgs);
      setOrgMemberships(oms);
      const keep = activeOrgId && orgs.some((o) => o.id === activeOrgId);
      const personal = orgs.find((o) => o.is_personal);
      setActiveOrgId(keep ? activeOrgId : (personal?.id ?? orgs[0]?.id ?? null));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, orgLoaded]);

  // 스페이스 로드
  // chrome.storage에서 활성 스페이스를 읽은 뒤(spaceLoaded) 실행해, 저장된 스페이스가
  // 아직 존재하면 그대로 유지하고, 없거나 삭제됐으면 첫 스페이스로 폴백한다.
  useEffect(() => {
    if (!session || !spaceLoaded) return;
    (async () => {
      const [sp, ms] = await Promise.all([listSpaces(supabase), listMyMemberships(supabase)]);
      setSpaces(sp);
      setMemberships(ms);
      setSpacesLoaded(true);
      // 다른 조직의 스페이스로 폴백하지 않도록, 활성 조직 내 첫 스페이스로만 대체한다(없으면 null).
      const first = sp.find((s) => s.org_id === (activeOrgId ?? "")) ?? null;
      const keep = activeSpaceId && sp.some((s) => s.id === activeSpaceId);
      setActiveSpaceId(keep ? activeSpaceId : (first?.id ?? null));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, spaceLoaded]);

  // 정합성 보정: 조직 로드가 activeOrgId를 교정(삭제·탈퇴된 조직 → 개인 조직 폴백)해도
  // activeSpaceId는 자동으로 재검증되지 않는다. 조직·스페이스가 모두 로드된 뒤,
  // 활성 스페이스가 활성 조직에 속하지 않으면(또는 더 이상 존재하지 않으면) 그 조직의 첫 스페이스로 되돌린다.
  useEffect(() => {
    if (!orgLoaded || !spacesLoaded || !activeOrgId) return;
    if (activeSpaceId && spaces.some((s) => s.id === activeSpaceId && s.org_id === activeOrgId)) return;
    const fallback = spaces.find((s) => s.org_id === activeOrgId)?.id ?? null;
    if (fallback !== activeSpaceId) setActiveSpaceId(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgLoaded, spacesLoaded, activeOrgId, activeSpaceId, spaces]);

  async function loadCollections() {
    if (!activeSpaceId) { setCollections([]); setLinksByCol({}); setCollectionsLoaded(true); return; }
    const cols = await listCollections(supabase, activeSpaceId);
    setCollections(cols);
    const entries = await Promise.all(cols.map(async (c) => [c.id, await listLinks(supabase, c.id)] as const));
    setLinksByCol(Object.fromEntries(entries));
    setCollectionsLoaded(true);
  }
  // 세션/스페이스가 바뀌면 스켈레톤부터 다시 보여준 뒤 로드한다(재조회 핸들러는 플래그를 건드리지 않음).
  useEffect(() => { if (session && activeSpaceId) { setCollectionsLoaded(false); loadCollections(); } /* eslint-disable-next-line */ }, [session, activeSpaceId]);

  async function reloadCollection(collectionId: string) {
    const links = await listLinks(supabase, collectionId);
    setLinksByCol((prev) => ({ ...prev, [collectionId]: links }));
  }

  useEffect(() => {
    if (!session) return;
    (async () => {
      const tabs = await chrome.tabs.query({});
      setGroups(groupTabsByWindow(tabs as WindowTab[]));
    })();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    listMyInvitations(supabase).then(setMyInvitations).catch(console.error);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    listMyOrgInvitations(supabase).then(setMyOrgInvitations).catch(console.error);
  }, [session]);

  useEffect(() => {
    if (!activeSpaceId) { setMembers([]); return; }
    listMembers(supabase, activeSpaceId).then(setMembers).catch(() => setMembers([]));
  }, [activeSpaceId]);

  // 활성 조직의 멤버 로드(오너 제외). 개인 조직은 팀 멤버 개념이 없으므로 건너뛴다.
  useEffect(() => {
    const org = organizations.find((o) => o.id === activeOrgId);
    if (!org || org.is_personal) { setOrgMembers([]); return; }
    listOrgMembers(supabase, activeOrgId!).then(setOrgMembers).catch(() => setOrgMembers([]));
  }, [activeOrgId, organizations]);

  async function openMemberDialog() {
    if (!activeSpaceId) return;
    setMemberDialogOpen(true);
    const [ms, invs] = await Promise.all([listMembers(supabase, activeSpaceId), listSpaceInvitations(supabase, activeSpaceId)]);
    setMembers(ms); setPendingInvites(invs);
  }
  async function reloadMembers() {
    if (!activeSpaceId) return;
    const [ms, invs] = await Promise.all([listMembers(supabase, activeSpaceId), listSpaceInvitations(supabase, activeSpaceId)]);
    setMembers(ms); setPendingInvites(invs);
  }
  async function handleInvite(email: string, role: string) {
    try { await inviteToSpace(supabase, activeSpaceId!, email, role as "editor" | "viewer"); toast.show("초대를 보냈어요"); reloadMembers(); }
    catch (e) { console.error(e); toast.show("초대하지 못했어요. 이미 멤버이거나 잘못된 이메일일 수 있어요."); }
  }
  async function refreshAll() {
    const [sp, ms, invs] = await Promise.all([listSpaces(supabase), listMyMemberships(supabase), listMyInvitations(supabase)]);
    setSpaces(sp); setMemberships(ms); setMyInvitations(invs);
    toast.show("스페이스에 참여했어요");
  }

  async function openOrgMemberDialog() {
    if (!activeOrgId) return;
    setOrgMemberDialogOpen(true);
    const [ms, invs] = await Promise.all([listOrgMembers(supabase, activeOrgId), listOrgInvitations(supabase, activeOrgId)]);
    setOrgMembers(ms); setOrgPendingInvites(invs);
  }
  async function reloadOrgMembers() {
    if (!activeOrgId) return;
    const [ms, invs] = await Promise.all([listOrgMembers(supabase, activeOrgId), listOrgInvitations(supabase, activeOrgId)]);
    setOrgMembers(ms); setOrgPendingInvites(invs);
  }
  async function handleOrgInvite(email: string, role: string) {
    try { await inviteToOrg(supabase, activeOrgId!, email, role as "admin" | "member"); toast.show("초대를 보냈어요"); reloadOrgMembers(); }
    catch (e) { console.error(e); toast.show("초대하지 못했어요. 이미 멤버이거나 잘못된 이메일일 수 있어요."); }
  }
  // 조직 초대 수락: 새 조직이 레일에 바로 보이도록 조직 목록·조직 멤버십·내 조직 초대를 함께 재조회.
  async function acceptOrgInv(id: string) {
    await acceptOrgInvitation(supabase, id);
    const [orgs, oms, oInvs] = await Promise.all([listOrganizations(supabase), listMyOrgMemberships(supabase), listMyOrgInvitations(supabase)]);
    setOrganizations(orgs); setOrgMemberships(oms); setMyOrgInvitations(oInvs);
    toast.show("조직에 참여했어요");
  }

  async function addSpace(name: string) {
    if (!session) return;
    const s = await createSpace(supabase, { user_id: session.user.id, name, org_id: activeOrgId ?? undefined });
    // 새 스페이스에는 기본 컬렉션을 하나 만들어 둔다.
    await createCollection(supabase, { user_id: session.user.id, space_id: s.id, title: "새 컬렉션" });
    setSpaces((prev) => [...prev, s]);
    setActiveSpaceId(s.id);
  }

  function selectOrg(id: string) {
    setActiveOrgId(id);
    const firstInOrg = spaces.find((s) => s.org_id === id) ?? null;
    setActiveSpaceId(firstInOrg?.id ?? null);
  }

  async function createOrg() {
    if (!session) return;
    const org = await createOrganization(supabase, { name: "새 조직", owner_id: session.user.id });
    setOrganizations((prev) => [...prev, org]);
    setActiveOrgId(org.id);
    setActiveSpaceId(null);
  }

  async function renameSpace(id: string, name: string) {
    await updateSpace(supabase, id, { name });
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  async function deleteSpace(id: string) {
    await apiDeleteSpace(supabase, id);
    const remaining = spaces.filter((s) => s.id !== id);
    setSpaces(remaining);
    // 활성 스페이스를 지웠다면 남은 첫 스페이스로 전환한다(없으면 비활성).
    if (activeSpaceId === id) setActiveSpaceId(remaining[0]?.id ?? null);
  }

  async function handleLeaveSpace(id: string) {
    if (!session) return;
    await leaveSpace(supabase, id, session.user.id);
    const remaining = spaces.filter((s) => s.id !== id);
    setSpaces(remaining);
    setMemberships((prev) => prev.filter((m) => m.space_id !== id));
    if (activeSpaceId === id) setActiveSpaceId(remaining[0]?.id ?? null);
  }

  const toast = useToast();

  // 이동: 현재 스페이스 목록에서 사라지므로 재조회. 복사: 다른 스페이스에 생기므로 재조회 불필요.
  async function moveCollectionTo(collection: Collection, targetSpaceId: string) {
    try {
      await moveCollectionToSpace(supabase, collection.id, targetSpaceId);
      const name = spaces.find((s) => s.id === targetSpaceId)?.name ?? "";
      toast.show(`'${collection.title}' 컬렉션을 '${name}' 스페이스로 이동했어요`);
      loadCollections();
    } catch (e) {
      console.error(e);
      toast.show("이동에 실패했어요. 다시 시도해 주세요.");
    }
  }

  async function copyCollectionTo(collection: Collection, targetSpaceId: string) {
    try {
      await copyCollection(supabase, collection.id, targetSpaceId);
      const name = spaces.find((s) => s.id === targetSpaceId)?.name ?? "";
      toast.show(`'${collection.title}' 컬렉션을 '${name}' 스페이스에 복사했어요`);
    } catch (e) {
      console.error(e);
      toast.show("복사에 실패했어요. 다시 시도해 주세요.");
    }
  }

  // 공유 코드: 발급 다이얼로그 대상 컬렉션과 발급 결과
  const [shareTarget, setShareTarget] = useState<Collection | null>(null);
  const [issuedCode, setIssuedCode] = useState<ShareCode | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // 컬렉션 삭제 확인 다이얼로그 대상 (스페이스 삭제와 동일한 2단계 확인)
  const [deleteColTarget, setDeleteColTarget] = useState<Collection | null>(null);
  // 멤버 관리 다이얼로그 상태
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<SpaceInvitation[]>([]);
  const [myInvitations, setMyInvitations] = useState<InvitationWithSpace[]>([]);
  // 조직 멤버 관리 다이얼로그의 대기 중 초대 + 받은 조직 초대(알림 팝오버용)
  const [orgPendingInvites, setOrgPendingInvites] = useState<OrganizationInvitation[]>([]);
  const [myOrgInvitations, setMyOrgInvitations] = useState<OrgInvitationWithOrg[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  // 경합 가드: 사전조회 응답이 도착할 때 현재 대상과 다르면 버린다.
  const shareTargetRef = useRef<string | null>(null);
  const inviteRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!inviteOpen) return;
    function onDown(e: MouseEvent) {
      if (inviteRef.current && !inviteRef.current.contains(e.target as Node)) setInviteOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [inviteOpen]);

  async function openShareDialog(collection: Collection) {
    shareTargetRef.current = collection.id;
    setShareTarget(collection);
    setIssuedCode(null);
    // 이미 활성 코드가 있으면 기본 7일 발급 호출이 그 코드를 그대로 반환한다 → 바로 코드 화면
    // (없으면 사용자가 만료를 고르도록 선택 화면 유지)
    try {
      const { data } = await supabase
        .from("collection_share_codes")
        .select("code, expires_at")
        .eq("collection_id", collection.id)
        .is("revoked_at", null)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());
      if (shareTargetRef.current !== collection.id) return;
      if (data && data.length > 0) setIssuedCode(data[0] as ShareCode);
    } catch (e) {
      console.error(e);
    }
  }

  async function issueShareCode(expiresInDays: number | null) {
    if (!shareTarget) return;
    try {
      setIssuedCode(await createCollectionShareCode(supabase, shareTarget.id, expiresInDays));
    } catch (e) {
      console.error(e);
      toast.show("코드를 만들지 못했어요. 다시 시도해 주세요.");
    }
  }

  async function revokeShareCode() {
    if (!issuedCode) return;
    try {
      await revokeCollectionShareCode(supabase, issuedCode.code);
      toast.show("공유 코드를 회수했어요");
      setShareTarget(null);
    } catch (e) {
      console.error(e);
      toast.show("회수하지 못했어요. 다시 시도해 주세요.");
    }
  }

  async function importByCode(code: string, targetSpaceId: string) {
    await importCollectionByCode(supabase, code, targetSpaceId);
    const name = spaces.find((s) => s.id === targetSpaceId)?.name ?? "";
    toast.show(`'${name}' 스페이스로 가져왔어요`);
    // 대상이 현재 스페이스면 activeSpaceId가 그대로라 재조회 effect가 돌지 않는다 → 직접 재조회
    if (targetSpaceId === activeSpaceId) loadCollections();
    // 가져온 스페이스로 이동해 결과를 바로 보여준다
    setActiveSpaceId(targetSpaceId);
  }

  async function addCollection() {
    if (!session) return;
    let spaceId = activeSpaceId;
    if (!spaceId) {
      const s = await createSpace(supabase, { user_id: session.user.id, name: "개인", org_id: activeOrgId ?? undefined });
      setSpaces((prev) => [...prev, s]);
      setActiveSpaceId(s.id);
      spaceId = s.id;
    }
    const created = await createCollection(supabase, { user_id: session.user.id, space_id: spaceId, title: "새 컬렉션" });
    setAutoEditId(created.id);
    await loadCollections();
  }

  function findContainerIn(map: Record<string, Link[]>, id: string): string | null {
    if (id.startsWith("container:")) return id.slice("container:".length);
    for (const [cid, ls] of Object.entries(map)) {
      if (ls.some((l) => l.id === id)) return cid;
    }
    return null;
  }
  function findContainer(id: string): string | null {
    return findContainerIn(linksByCol, id);
  }

  function handleDragStart(event: DragStartEvent) {
    const d = event.active.data.current;
    if (d?.kind === "link") {
      const link = d.link as Link;
      dragOriginRef.current = link.collection_id; // 시작 시점의 원래 컬렉션
      setActive({ type: "link", link });
    } else if (d?.kind === "tab") {
      dragOriginRef.current = null;
      groupsOriginRef.current = groups;
      setActive({ type: "tab", tab: d.tab as WindowTab });
    } else if (d?.kind === "collection") {
      collectionsOriginRef.current = collections;
      setActive({ type: "collection", collection: d.collection as Collection });
    } else if (d?.kind === "space") {
      spacesOriginRef.current = spaces;
      setActive({ type: "space", space: d.space as Space });
    } else {
      setActive(null);
    }
  }

  // 드래그 중 순서/컨테이너 이동을 실시간 반영(sortable이 부드럽게 자리 내줌, 위/아래 대칭).
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!session) return;
    if (!over) { setDragOverCol(null); return; }
    const activeId = String(active.id);
    const overId = String(over.id);
    const d = active.data.current;

    // 컬렉션 순서 변경: 다른 컬렉션 위로 끌면 실시간 재정렬.
    if (d?.kind === "collection") {
      setDragOverCol(null);
      if (!overId.startsWith("col:") || overId === activeId) return;
      setCollections((prev) => {
        const oldIdx = prev.findIndex((c) => `col:${c.id}` === activeId);
        const newIdx = prev.findIndex((c) => `col:${c.id}` === overId);
        if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return prev;
        const next = arrayMove(prev, oldIdx, newIdx);
        collectionsRef.current = next;
        return next;
      });
      return;
    }

    // 스페이스 순서 변경: 다른 스페이스 위로 끌면 실시간 재정렬.
    if (d?.kind === "space") {
      if (!overId.startsWith("space:") || overId === activeId) return;
      setSpaces((prev) => {
        const oldIdx = prev.findIndex((s) => `space:${s.id}` === activeId);
        const newIdx = prev.findIndex((s) => `space:${s.id}` === overId);
        if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return prev;
        const next = arrayMove(prev, oldIdx, newIdx);
        spacesRef.current = next;
        return next;
      });
      return;
    }

    // 탭을 "열린 탭" 창 영역 위로 끌면 실제 창 간/내 재배치를 실시간 미리보기.
    if (d?.kind === "tab") {
      const winTarget = resolveTabDropTarget(groupsRef.current, overId);
      if (winTarget) {
        const tid = parseTabDragId(activeId);
        if (tid != null) {
          setGroups((prev) => {
            const next = moveTab(prev, tid, winTarget.toWindowId, winTarget.toIndex);
            groupsRef.current = next;
            return next;
          });
        }
        // 컬렉션에 남아있던 자리표시 카드 제거.
        setLinksByCol((prev) => {
          const cur = findContainerIn(prev, NEW_TAB_PLACEHOLDER);
          if (!cur) return prev;
          const next = { ...prev, [cur]: (prev[cur] ?? []).filter((l) => l.id !== NEW_TAB_PLACEHOLDER) };
          linksByColRef.current = next;
          return next;
        });
        setDragOverCol(null);
        return;
      }
      // 컬렉션 영역으로 돌아옴: 창 미리보기를 원본으로 원복하고 아래 컬렉션 로직으로 진행.
      setGroups(groupsOriginRef.current);
      groupsRef.current = groupsOriginRef.current;
    }

    const overC = findContainer(overId);
    if (!overC) { setDragOverCol(null); return; }
    setDragOverCol(overC);

    setLinksByCol((prev) => {
      const next = ((): Record<string, Link[]> => {
      const overItems = prev[overC] ?? [];
      const overIdx = overItems.findIndex((l) => l.id === overId);
      const insertIdx = overIdx >= 0 ? overIdx : overItems.length;

      if (d?.kind === "tab") {
        // 탭 자리표시 카드: 이미 같은 컬렉션에 있으면 arrayMove로 위치만 옮긴다(튕김 방지).
        // 컬렉션이 바뀔 때만 제거 후 삽입.
        const curC = findContainerIn(prev, NEW_TAB_PLACEHOLDER);

        if (curC === overC) {
          const items = prev[overC];
          const curIdx = items.findIndex((l) => l.id === NEW_TAB_PLACEHOLDER);
          // over가 자리표시 자신이면 이동 없음
          if (curIdx < 0 || insertIdx < 0 || curIdx === insertIdx || overId === NEW_TAB_PLACEHOLDER) return prev;
          return { ...prev, [overC]: arrayMove(items, curIdx, insertIdx) };
        }

        // 다른(또는 처음) 컬렉션으로: 기존 위치에서 제거 후 새 위치에 삽입
        const tab = d.tab as WindowTab;
        const ph: Link = {
          id: NEW_TAB_PLACEHOLDER, collection_id: overC, user_id: session.user.id,
          url: tab.url ?? "", title: tab.title ?? null, favicon_url: tab.favIconUrl ?? null,
          thumbnail_url: null, custom_title: null, note: null, position: 0, created_at: new Date().toISOString(),
        };
        const next: Record<string, Link[]> = { ...prev };
        if (curC) next[curC] = (prev[curC] ?? []).filter((l) => l.id !== NEW_TAB_PLACEHOLDER);
        const target = (next[overC] ?? []).filter((l) => l.id !== NEW_TAB_PLACEHOLDER);
        let idx = target.findIndex((l) => l.id === overId);
        if (idx < 0) idx = target.length;
        next[overC] = [...target.slice(0, idx), ph, ...target.slice(idx)];
        return next;
      }

      // 링크
      const activeC = findContainer(activeId);
      if (!activeC) return prev;
      const activeItems = prev[activeC] ?? [];
      const oldIdx = activeItems.findIndex((l) => l.id === activeId);
      if (oldIdx < 0) return prev;

      if (activeC === overC) {
        // 같은 컬렉션 내 재정렬(실시간)
        if (oldIdx === insertIdx || insertIdx < 0) return prev;
        return { ...prev, [activeC]: arrayMove(activeItems, oldIdx, insertIdx) };
      }
      // 다른 컬렉션으로 이동(실시간)
      const moving = { ...activeItems[oldIdx], collection_id: overC };
      return {
        ...prev,
        [activeC]: activeItems.filter((l) => l.id !== activeId),
        [overC]: [...overItems.slice(0, insertIdx), moving, ...overItems.slice(insertIdx)],
      };
      })();
      linksByColRef.current = next;
      return next;
    });
  }

  async function persistOrder(orderedIds: string[]) {
    await Promise.all(sequentialPositions(orderedIds).map((p) => updateLink(supabase, p.id, { position: p.position })));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const d = active.data.current;
    const activeId = String(active.id);
    setActive(null);
    setDragOverCol(null);
    if (!over || !session) {
      if (d?.kind === "tab") { setGroups(groupsOriginRef.current); groupsRef.current = groupsOriginRef.current; }
      if (d?.kind === "space") { setSpaces(spacesOriginRef.current); spacesRef.current = spacesOriginRef.current; }
      loadCollections();
      return;
    }

    const map = linksByColRef.current; // 드래그 중 갱신된 최신 상태

    if (d?.kind === "tab") {
      // 1) 창에 드롭: 실제 브라우저 탭 이동
      const winTarget = resolveTabDropTarget(groupsRef.current, String(over.id));
      if (winTarget) {
        const tid = parseTabDragId(activeId);
        if (tid != null) {
          const g = groupsRef.current.find((x) => x.windowId === winTarget.toWindowId);
          const index = g ? g.tabs.findIndex((t) => t.id === tid) : -1;
          try { await chrome.tabs.move(tid, { windowId: winTarget.toWindowId, index }); } catch (e) { console.error(e); }
          const tabs = await chrome.tabs.query({});
          setGroups(groupTabsByWindow(tabs as WindowTab[]));
        }
        return;
      }
      // 2) 컬렉션에 드롭: 기존 저장 로직
      const overC = findContainerIn(map, NEW_TAB_PLACEHOLDER); // 자리표시 카드가 들어간 컬렉션
      if (!overC) { loadCollections(); return; }
      const items = map[overC] ?? [];
      const base = tabDropToLinkInput(d.tab as WindowTab, overC, session.user.id);
      if (!base) { loadCollections(); return; }
      const created = await createLink(supabase, base);
      const orderedIds = items.map((l) => (l.id === NEW_TAB_PLACEHOLDER ? created.id : l.id));
      setLinksByCol((prev) => ({ ...prev, [overC]: (prev[overC] ?? []).map((l) => (l.id === NEW_TAB_PLACEHOLDER ? { ...l, id: created.id } : l)) }));
      await persistOrder(orderedIds);
      reloadCollection(overC);
    } else if (d?.kind === "link") {
      // onDragOver에서 이미 실시간으로 순서/컨테이너가 반영됨(ref) → 현재 순서를 그대로 저장.
      const container = findContainerIn(map, activeId);
      if (!container) { loadCollections(); return; }
      const original = dragOriginRef.current; // 드래그 시작 시점의 원래 컬렉션
      const items = map[container] ?? [];
      // 항상 collection_id를 대상 컬렉션으로 확정(드래그 중 링크 객체의 collection_id가 갱신돼
      // 원래 위치 비교가 무력화되므로). 같은 컬렉션이면 사실상 무변경, position은 아래에서 재할당.
      await moveLink(supabase, activeId, container, 0);
      await persistOrder(items.map((l) => l.id));
      reloadCollection(container);
      if (original && original !== container) reloadCollection(original);
    } else if (d?.kind === "collection") {
      // onDragOver에서 이미 실시간으로 순서가 반영됨(ref) → 현재 순서로 position 재할당 저장.
      const ordered = collectionsRef.current.map((c) => c.id);
      await Promise.all(sequentialPositions(ordered).map((p) => updateCollection(supabase, p.id, { position: p.position })));
      loadCollections();
    } else if (d?.kind === "space") {
      // onDragOver에서 이미 실시간으로 순서가 반영됨(ref) → 현재 순서로 position 재할당 저장.
      // 로컬 spaces 순서는 이미 최신이라 재조회 없이 position만 저장한다.
      const ordered = spacesRef.current.map((s) => s.id);
      await Promise.all(sequentialPositions(ordered).map((p) => updateSpace(supabase, p.id, { position: p.position })));
    }
  }

  function handleDragCancel() {
    if (active?.type === "tab") { setGroups(groupsOriginRef.current); groupsRef.current = groupsOriginRef.current; }
    if (active?.type === "collection") { setCollections(collectionsOriginRef.current); collectionsRef.current = collectionsOriginRef.current; }
    if (active?.type === "space") { setSpaces(spacesOriginRef.current); spacesRef.current = spacesOriginRef.current; }
    setActive(null);
    setDragOverCol(null);
    loadCollections();
  }

  async function saveWindow(windowId: number) {
    if (!session) return;
    let spaceId = activeSpaceId;
    if (!spaceId) {
      const s = await createSpace(supabase, { user_id: session.user.id, name: "개인", org_id: activeOrgId ?? undefined });
      setSpaces((prev) => [...prev, s]);
      setActiveSpaceId(s.id);
      spaceId = s.id;
    }
    const idx = groups.findIndex((g) => g.windowId === windowId);
    const group = groups[idx];
    if (!group) return;
    const created = await createCollection(supabase, { user_id: session.user.id, space_id: spaceId, title: `창 ${idx + 1}` });
    const inputs = tabsToLinkInputs(group.tabs, session.user.id, created.id);
    for (const input of inputs) { try { await createLink(supabase, input); } catch (e) { console.error(e); } }
    loadCollections();
  }

  async function closeTab(tabId: number) {
    await chrome.tabs.remove(tabId);
    const tabs = await chrome.tabs.query({});
    setGroups(groupTabsByWindow(tabs as WindowTab[]));
  }

  // 탭 행 클릭: 해당 탭을 활성화하고 그 창을 앞으로 가져온다.
  async function activateTab(tabId: number, windowId: number) {
    try {
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(windowId, { focused: true });
    } catch (e) { console.error(e); }
  }

  async function closeWindow(windowId: number) {
    const group = groups.find((g) => g.windowId === windowId);
    const ids = (group?.tabs ?? []).map((t) => t.id).filter((id): id is number => id != null);
    if (ids.length) await chrome.tabs.remove(ids);
    const tabs = await chrome.tabs.query({});
    setGroups(groupTabsByWindow(tabs as WindowTab[]));
  }

  if (!authLoaded) {
    return null;
  }

  if (!session) {
    return <AuthScreen />;
  }

  const userId = session.user.id;

  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null;
  const myMembership = memberships.find((m) => m.space_id === activeSpaceId) ?? null;
  const isOwner = activeSpace ? activeSpace.user_id === userId : false;

  const activeOrg = organizations.find((o) => o.id === activeOrgId) ?? null;
  // 오너면 owner, 멤버십이 있으면 그 role, 둘 다 아니면(방금 로드 전 등) 기본 member로 취급.
  const myOrgRole: OrgRole = activeOrg
    ? (activeOrg.owner_id === userId ? "owner"
       : (orgMemberships.find((m) => m.org_id === activeOrgId)?.role ?? "member"))
    : "member";

  // 조직(팀) 스페이스는 조직 역할이 편집 가능 여부의 기준(멤버는 편집 불가, RLS가 최종 방어선).
  // 개인/공유 스페이스는 기존 스페이스 멤버십 기준(오너는 항상 편집 가능, 멤버는 editor만 편집 가능)을 유지.
  // 역할은 '활성 스페이스가 속한 조직'(activeSpaceOrg) 기준으로 계산한다. 레일 선택(activeOrgId)과
  // 초기 로드 한 프레임 어긋나더라도 편집 판정이 잘못 나오지 않도록 activeOrgId에 결합하지 않는다.
  const activeSpaceOrg = organizations.find((o) => o.id === activeSpace?.org_id) ?? null;
  const activeSpaceOrgRole: OrgRole = activeSpaceOrg
    ? (activeSpaceOrg.owner_id === userId ? "owner"
       : (orgMemberships.find((m) => m.org_id === activeSpaceOrg.id)?.role ?? "member"))
    : "member";
  const canEdit = activeSpaceOrg && !activeSpaceOrg.is_personal
    ? activeSpaceOrgRole !== "member"
    : activeSpace ? (myMembership ? myMembership.role === "editor" : true) : true;

  const orgSpaces = spaces.filter((s) => s.org_id === activeOrgId);
  const ownedSpaces = orgSpaces.filter((s) => !memberships.some((m) => m.space_id === s.id));
  const sharedSpaces = orgSpaces.filter((s) => memberships.some((m) => m.space_id === s.id));

  // 커서 미리보기(오버레이)용 데이터 (탭/링크 카드용. 컬렉션은 별도 칩으로 렌더)
  const preview =
    active?.type === "tab"
      ? { label: active.tab.title ?? active.tab.url ?? "", faviconUrl: active.tab.favIconUrl ?? null, domain: domainOf(active.tab.url ?? "") }
      : active?.type === "link"
        ? { label: active.link.custom_title ?? active.link.title ?? domainOf(active.link.url), faviconUrl: active.link.favicon_url, domain: domainOf(active.link.url) }
        : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div style={{ display: "flex", height: "100vh" }}>
        {/* 조직 레일: 항상 보이는 상시 영역. AppShell의 접기 대상에서 제외해 사이드바를 접어도 로고·조직·계정이 유지된다. */}
        <div style={{ position: "relative", width: 54, flexShrink: 0 }}>
          <OrgRail
            organizations={organizations}
            memberships={orgMemberships}
            activeOrgId={activeOrgId}
            userEmail={session.user.email ?? ""}
            currentUserId={session.user.id}
            onSelectOrg={selectOrg}
            onCreateOrg={createOrg}
            onSignOut={async () => { await supabase.auth.signOut(); }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AppShell
            leftOpen={panels.left}
            rightOpen={panels.right}
            onToggleLeft={toggleLeft}
            onToggleRight={toggleRight}
            leftWidth={panels.leftWidth}
            rightWidth={panels.rightWidth}
            onResizeLeft={setLeftWidth}
            onResizeRight={setRightWidth}
            left={
              <ExtSidebar
                spaces={ownedSpaces}
                sharedSpaces={sharedSpaces}
                activeSpaceId={activeSpaceId}
                onSelectSpace={(id) => { setActiveSpaceId(id); }}
                onAddSpace={addSpace}
                onRenameSpace={renameSpace}
                onDeleteSpace={deleteSpace}
                onLeaveSpace={handleLeaveSpace}
                onCollapse={toggleLeft}
                onImportCode={() => setImportOpen(true)}
                searchSlot={<ExtSearchBar />}
                orgHeaderSlot={activeOrg ? (
                  <OrgHeader
                    org={activeOrg}
                    members={orgMembers}
                    myRole={myOrgRole}
                    onOpenMembers={openOrgMemberDialog}
                  />
                ) : null}
              />
            }
            right={
              <OpenTabsPanel groups={groups} onSaveWindow={saveWindow} onCloseWindow={closeWindow} onCloseTab={closeTab} onActivateTab={activateTab} onCollapse={toggleRight} />
            }
          >
            <Board>
              {spacesLoaded && orgSpaces.length === 0 ? (
                // 활성 조직에 스페이스가 0개(신규 가입 직후, 전부 삭제, 또는 방금 만든 빈 조직): 온보딩 빈 상태.
                <SpaceOnboarding onCreate={() => addSpace("개인")} />
              ) : (
                <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <strong style={{ fontSize: 15 }}>{spaces.find((s) => s.id === activeSpaceId)?.name ?? "—"}</strong>
                    <span style={{ color: theme.textFaint }}>· {collectionsLoaded ? collections.length : "—"} 컬렉션</span>
                  </div>
                  <span ref={inviteRef} style={{ position: "relative" }}>
                    <Button variant="outline" onClick={() => setInviteOpen((v) => !v)}>
                      초대 {(myInvitations.length + myOrgInvitations.length) > 0 ? `(${myInvitations.length + myOrgInvitations.length})` : ""}
                    </Button>
                    {inviteOpen && (
                      <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 60, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 10, boxShadow: "0 8px 20px rgba(20,30,60,.14)" }}>
                        {myInvitations.length === 0 && myOrgInvitations.length === 0 ? (
                          <InvitationList
                            invitations={[]}
                            roles={[{ value: "editor", label: "편집자" }, { value: "viewer", label: "뷰어" }]}
                            onAccept={async (id) => { await acceptInvitation(supabase, id); setInviteOpen(false); await refreshAll(); }}
                            onDecline={async (id) => { await declineInvitation(supabase, id); setMyInvitations((prev) => prev.filter((x) => x.id !== id)); }}
                          />
                        ) : (
                          <>
                            {myInvitations.length > 0 && (
                              <InvitationList
                                invitations={myInvitations.map((i) => ({ id: i.id, space_name: i.space_name, inviter_name: i.inviter_name, role: i.role }))}
                                roles={[{ value: "editor", label: "편집자" }, { value: "viewer", label: "뷰어" }]}
                                onAccept={async (id) => { await acceptInvitation(supabase, id); setInviteOpen(false); await refreshAll(); }}
                                onDecline={async (id) => { await declineInvitation(supabase, id); setMyInvitations((prev) => prev.filter((x) => x.id !== id)); }}
                              />
                            )}
                            {myOrgInvitations.length > 0 && (
                              <InvitationList
                                invitations={myOrgInvitations.map((i) => ({ id: i.id, space_name: i.org_name, inviter_name: i.inviter_name, role: i.role }))}
                                roles={[{ value: "admin", label: "관리자" }, { value: "member", label: "멤버" }]}
                                onAccept={async (id) => { await acceptOrgInv(id); setInviteOpen(false); }}
                                onDecline={async (id) => { await declineOrgInvitation(supabase, id); setMyOrgInvitations((prev) => prev.filter((x) => x.id !== id)); }}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {members.length > 0 && <MemberAvatars people={members} />}
                  {isOwner && activeSpaceOrg?.is_personal && (
                    <Button variant="outline" onClick={openMemberDialog}><Users size={15} /> 멤버</Button>
                  )}
                  {canEdit && <Button onClick={addCollection}><Plus size={15} /> 컬렉션</Button>}
                </div>
              </div>
              {(() => {
                const visibleCollections = collections;
                return !collectionsLoaded ? (
                  <CollectionSkeleton />
                ) : visibleCollections.length === 0 ? (
                  <EmptyState title="컬렉션이 없어요. ‘＋ 컬렉션’으로 영역을 만든 뒤, 열린 탭을 드래그해 넣어보세요." />
                ) : (
                  <SortableContext items={visibleCollections.map((c) => `col:${c.id}`)} strategy={verticalListSortingStrategy}>
                    {visibleCollections.map((c) => (
                    <SortableCollection key={c.id} collection={c}>
                      {(drag) => {
                        const links = linksByCol[c.id] ?? [];
                        return (
                          <CollectionSection
                            collection={c}
                            links={links}
                            isOver={dragOverCol === c.id}
                            isPrivate={c.is_private}
                            autoEditTitle={autoEditId === c.id}
                            titleDragRef={drag.ref}
                            titleDragProps={drag.props}
                            readOnly={!canEdit}
                            onRenameCollection={canEdit ? async (id, title) => { await updateCollection(supabase, id, { title }); setAutoEditId(null); loadCollections(); } : undefined}
                            onOpenLink={openUrl}
                            onDeleteLink={canEdit ? async (id) => { await deleteLink(supabase, id); reloadCollection(c.id); } : undefined}
                            onAddLink={async (url) => { if (canEdit) { await createLink(supabase, { user_id: userId, collection_id: c.id, url }); reloadCollection(c.id); } }}
                            onOpenAll={() => links.forEach((l) => openUrl(l.url))}
                            onDeleteCollection={canEdit ? () => setDeleteColTarget(c) : undefined}
                            linksSlot={
                              <DndLinkList
                                collectionId={c.id}
                                links={links}
                                onOpenLink={openUrl}
                                onDeleteLink={canEdit ? async (id) => { await deleteLink(supabase, id); reloadCollection(c.id); } : undefined}
                                onUpdateLink={canEdit ? async (id, patch) => { await updateLink(supabase, id, patch); reloadCollection(c.id); } : undefined}
                                readOnly={!canEdit}
                              />
                            }
                            moreMenuSlot={canEdit ? (
                              <CollectionMoreMenu
                                spaces={spaces
                                  .filter((s) => s.id !== activeSpaceId)
                                  .map((s) => ({ id: s.id, name: s.name, icon: s.icon }))}
                                onMove={(sid) => moveCollectionTo(c, sid)}
                                onCopy={(sid) => copyCollectionTo(c, sid)}
                                onShare={() => openShareDialog(c)}
                                isPrivate={c.is_private}
                                onTogglePrivate={c.user_id === userId ? async () => {
                                  await updateCollection(supabase, c.id, { is_private: !c.is_private });
                                  loadCollections();
                                } : undefined}
                              />
                            ) : undefined}
                          />
                        );
                      }}
                    </SortableCollection>
                    ))}
                  </SortableContext>
                );
              })()}
                </>
              )}
            </Board>
          </AppShell>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {active?.type === "collection" ? (
          <div style={{
            border: `1px solid ${theme.border}`, borderRadius: theme.radiusCard, padding: "8px 12px",
            background: "#fff", boxShadow: "0 8px 20px rgba(20,30,60,.22)", cursor: "grabbing",
            fontWeight: 600, color: theme.text,
          }}>
            {active.collection.icon ? `${active.collection.icon} ` : ""}{active.collection.title}
          </div>
        ) : active?.type === "space" ? (
          <div style={{
            border: `1px solid ${theme.border}`, borderRadius: theme.radiusCard, padding: "7px 12px",
            background: "#fff", boxShadow: "0 8px 20px rgba(20,30,60,.22)", cursor: "grabbing",
            fontWeight: 600, color: theme.text, fontSize: 12.5,
          }}>
            {active.space.icon ? `${active.space.icon} ` : ""}{active.space.name}
          </div>
        ) : preview ? (
          <div style={{
            border: `1px solid ${theme.border}`, borderRadius: theme.radiusCard, padding: "10px 11px",
            background: "#fff", boxShadow: "0 8px 20px rgba(20,30,60,.22)", width: 240, boxSizing: "border-box", cursor: "grabbing",
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Favicon url={preview.faviconUrl} />
              <span style={{ fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {preview.label}
              </span>
            </div>
            <div style={{ color: theme.textFaint, fontSize: 11, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {preview.domain}
            </div>
          </div>
        ) : null}
      </DragOverlay>
      <ShareCodeDialog
        open={shareTarget !== null}
        collectionTitle={shareTarget?.title ?? ""}
        issued={issuedCode}
        onIssue={issueShareCode}
        onRevoke={revokeShareCode}
        onCopied={() => toast.show("공유 코드를 복사했어요")}
        onClose={() => setShareTarget(null)}
      />
      <ImportCodeDialog
        open={importOpen}
        spaces={spaces.map((s) => ({ id: s.id, name: s.name, icon: s.icon }))}
        onLookup={(code) => getShareCodeInfo(supabase, code)}
        onImport={importByCode}
        onClose={() => setImportOpen(false)}
      />
      <ConfirmDialog
        open={deleteColTarget !== null}
        danger
        title="컬렉션 삭제"
        message={<>'{deleteColTarget?.title}' 컬렉션을 삭제할까요?<br />담긴 링크가 모두 삭제되며 되돌릴 수 없습니다.</>}
        confirmLabel="삭제"
        onConfirm={async () => {
          if (!deleteColTarget) return;
          await deleteCollection(supabase, deleteColTarget.id);
          setDeleteColTarget(null);
          loadCollections();
        }}
        onCancel={() => setDeleteColTarget(null)}
      />
      <MemberDialog
        open={memberDialogOpen}
        spaceName={activeSpace?.name ?? ""}
        roles={[{ value: "editor", label: "편집자" }, { value: "viewer", label: "뷰어" }]}
        members={members.map((m) => ({ user_id: m.user_id, role: m.role, display_name: m.display_name, avatar_url: m.avatar_url }))}
        pendingInvites={pendingInvites.map((i) => ({ id: i.id, invitee_email: i.invitee_email, role: i.role }))}
        onInvite={handleInvite}
        onChangeRole={async (uid, role) => { try { await updateMemberRole(supabase, activeSpaceId!, uid, role as "editor" | "viewer"); reloadMembers(); } catch (e) { console.error(e); toast.show("역할을 변경하지 못했어요."); } }}
        onRemove={async (uid) => { try { await removeMember(supabase, activeSpaceId!, uid); reloadMembers(); } catch (e) { console.error(e); toast.show("멤버를 제거하지 못했어요."); } }}
        onCancelInvite={async (id) => { try { await cancelInvitation(supabase, id); reloadMembers(); } catch (e) { console.error(e); toast.show("초대를 취소하지 못했어요."); } }}
        onClose={() => setMemberDialogOpen(false)}
      />
      <MemberDialog
        open={orgMemberDialogOpen}
        spaceName={activeOrg?.name ?? ""}
        roles={[{ value: "admin", label: "관리자" }, { value: "member", label: "멤버" }]}
        members={orgMembers.map((m) => ({ user_id: m.user_id, role: m.role, display_name: m.display_name, avatar_url: m.avatar_url }))}
        pendingInvites={orgPendingInvites.map((i) => ({ id: i.id, invitee_email: i.invitee_email, role: i.role }))}
        onInvite={handleOrgInvite}
        onChangeRole={async (uid, role) => { try { await updateOrgMemberRole(supabase, activeOrgId!, uid, role as "admin" | "member"); reloadOrgMembers(); } catch (e) { console.error(e); toast.show("역할을 변경하지 못했어요."); } }}
        onRemove={async (uid) => { try { await removeOrgMember(supabase, activeOrgId!, uid); reloadOrgMembers(); } catch (e) { console.error(e); toast.show("멤버를 제거하지 못했어요."); } }}
        onCancelInvite={async (id) => { try { await cancelOrgInvitation(supabase, id); reloadOrgMembers(); } catch (e) { console.error(e); toast.show("초대를 취소하지 못했어요."); } }}
        onClose={() => setOrgMemberDialogOpen(false)}
      />
    </DndContext>
  );
}
