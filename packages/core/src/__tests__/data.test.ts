import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listSpaces, createSpace, updateSpace, deleteSpace } from "../data/spaces";
import { listCollections, createCollection, updateCollection, deleteCollection, listAllCollections } from "../data/collections";
import { listLinks, createLink, updateLink, deleteLink, moveLink } from "../data/links";
import {
  listTags,
  createTag,
  deleteTag,
  addTagToCollection,
  removeTagFromCollection,
  listTagsForCollection,
  listCollectionIdsForTag,
} from "../data/tags";
import { searchCollections, searchLinks } from "../data/search";

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
if (!URL || !ANON || !SERVICE) throw new Error(".env.test 키 누락");

async function makeUser(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (signInErr) throw signInErr;
  return { client, id: created.user!.id };
}

describe("spaces 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };

  beforeAll(async () => {
    user = await makeUser(`spaces-${Date.now()}@test.local`);
  });

  it("스페이스를 만들고 목록에 나타난다", async () => {
    const created = await createSpace(user.client, { user_id: user.id, name: "개인" });
    expect(created.name).toBe("개인");
    const list = await listSpaces(user.client);
    expect(list.some((s) => s.id === created.id)).toBe(true);
  });

  it("스페이스 이름을 수정한다", async () => {
    const created = await createSpace(user.client, { user_id: user.id, name: "임시" });
    const updated = await updateSpace(user.client, created.id, { name: "수정됨" });
    expect(updated.name).toBe("수정됨");
  });

  it("스페이스를 삭제한다", async () => {
    const created = await createSpace(user.client, { user_id: user.id, name: "삭제대상" });
    await deleteSpace(user.client, created.id);
    const list = await listSpaces(user.client);
    expect(list.some((s) => s.id === created.id)).toBe(false);
  });

  it("목록은 position 오름차순으로 정렬된다", async () => {
    const u = await makeUser(`spaces-order-${Date.now()}@test.local`);
    await createSpace(u.client, { user_id: u.id, name: "A", position: 3000 });
    await createSpace(u.client, { user_id: u.id, name: "B", position: 1000 });
    const list = await listSpaces(u.client);
    const positions = list.map((s) => s.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe("collections 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };
  let spaceId: string;

  beforeAll(async () => {
    user = await makeUser(`cols-${Date.now()}@test.local`);
    const space = await createSpace(user.client, { user_id: user.id, name: "개인" });
    spaceId = space.id;
  });

  it("컬렉션을 만들고 스페이스별로 조회한다", async () => {
    const created = await createCollection(user.client, {
      user_id: user.id,
      space_id: spaceId,
      title: "읽을거리",
    });
    expect(created.title).toBe("읽을거리");
    const list = await listCollections(user.client, spaceId);
    expect(list.some((c) => c.id === created.id)).toBe(true);
  });

  it("컬렉션 제목과 노트를 수정한다", async () => {
    const created = await createCollection(user.client, {
      user_id: user.id,
      space_id: spaceId,
      title: "임시",
    });
    const updated = await updateCollection(user.client, created.id, {
      title: "수정됨",
      note: "메모",
    });
    expect(updated.title).toBe("수정됨");
    expect(updated.note).toBe("메모");
  });

  it("컬렉션을 삭제한다", async () => {
    const created = await createCollection(user.client, {
      user_id: user.id,
      space_id: spaceId,
      title: "삭제대상",
    });
    await deleteCollection(user.client, created.id);
    const list = await listCollections(user.client, spaceId);
    expect(list.some((c) => c.id === created.id)).toBe(false);
  });
});

describe("links 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };
  let collectionId: string;
  let otherCollectionId: string;

  beforeAll(async () => {
    user = await makeUser(`links-${Date.now()}@test.local`);
    const space = await createSpace(user.client, { user_id: user.id, name: "개인" });
    const c1 = await createCollection(user.client, {
      user_id: user.id,
      space_id: space.id,
      title: "C1",
    });
    const c2 = await createCollection(user.client, {
      user_id: user.id,
      space_id: space.id,
      title: "C2",
    });
    collectionId = c1.id;
    otherCollectionId = c2.id;
  });

  it("링크를 만들고 컬렉션별로 조회한다", async () => {
    const created = await createLink(user.client, {
      user_id: user.id,
      collection_id: collectionId,
      url: "https://example.com",
      title: "예시",
    });
    expect(created.url).toBe("https://example.com");
    const list = await listLinks(user.client, collectionId);
    expect(list.some((l) => l.id === created.id)).toBe(true);
  });

  it("링크 제목을 수정한다", async () => {
    const created = await createLink(user.client, {
      user_id: user.id,
      collection_id: collectionId,
      url: "https://a.com",
    });
    const updated = await updateLink(user.client, created.id, { custom_title: "내 제목" });
    expect(updated.custom_title).toBe("내 제목");
  });

  it("링크를 다른 컬렉션으로 이동하고 position을 갱신한다", async () => {
    const created = await createLink(user.client, {
      user_id: user.id,
      collection_id: collectionId,
      url: "https://move.com",
    });
    const moved = await moveLink(user.client, created.id, otherCollectionId, 500);
    expect(moved.collection_id).toBe(otherCollectionId);
    expect(moved.position).toBe(500);
    const fromList = await listLinks(user.client, collectionId);
    expect(fromList.some((l) => l.id === created.id)).toBe(false);
  });

  it("링크를 삭제한다", async () => {
    const created = await createLink(user.client, {
      user_id: user.id,
      collection_id: collectionId,
      url: "https://del.com",
    });
    await deleteLink(user.client, created.id);
    const list = await listLinks(user.client, collectionId);
    expect(list.some((l) => l.id === created.id)).toBe(false);
  });
});

describe("tags 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };
  let collectionId: string;

  beforeAll(async () => {
    user = await makeUser(`tags-${Date.now()}@test.local`);
    const space = await createSpace(user.client, { user_id: user.id, name: "개인" });
    const c = await createCollection(user.client, {
      user_id: user.id,
      space_id: space.id,
      title: "C",
    });
    collectionId = c.id;
  });

  it("태그를 만들고 목록에 나타난다", async () => {
    const tag = await createTag(user.client, { user_id: user.id, name: "디자인" });
    expect(tag.name).toBe("디자인");
    const list = await listTags(user.client);
    expect(list.some((t) => t.id === tag.id)).toBe(true);
  });

  it("컬렉션에 태그를 달고 컬렉션의 태그 목록에 나타난다", async () => {
    const tag = await createTag(user.client, { user_id: user.id, name: "읽을거리" });
    await addTagToCollection(user.client, collectionId, tag.id);
    const tags = await listTagsForCollection(user.client, collectionId);
    expect(tags.some((t) => t.id === tag.id)).toBe(true);
  });

  it("태그로 컬렉션 id를 조회한다", async () => {
    const tag = await createTag(user.client, { user_id: user.id, name: "필터용" });
    await addTagToCollection(user.client, collectionId, tag.id);
    const ids = await listCollectionIdsForTag(user.client, tag.id);
    expect(ids).toContain(collectionId);
  });

  it("컬렉션에서 태그를 제거한다", async () => {
    const tag = await createTag(user.client, { user_id: user.id, name: "제거대상" });
    await addTagToCollection(user.client, collectionId, tag.id);
    await removeTagFromCollection(user.client, collectionId, tag.id);
    const tags = await listTagsForCollection(user.client, collectionId);
    expect(tags.some((t) => t.id === tag.id)).toBe(false);
  });

  it("태그를 삭제한다", async () => {
    const tag = await createTag(user.client, { user_id: user.id, name: "삭제대상" });
    await deleteTag(user.client, tag.id);
    const list = await listTags(user.client);
    expect(list.some((t) => t.id === tag.id)).toBe(false);
  });
});

describe("search 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };

  beforeAll(async () => {
    user = await makeUser(`search-${Date.now()}@test.local`);
    const space = await createSpace(user.client, { user_id: user.id, name: "개인" });
    const c = await createCollection(user.client, {
      user_id: user.id,
      space_id: space.id,
      title: "리액트 자료",
    });
    await createLink(user.client, {
      user_id: user.id,
      collection_id: c.id,
      url: "https://nextjs.org/docs",
      title: "Next.js 문서",
    });
  });

  it("컬렉션 제목으로 검색한다", async () => {
    const results = await searchCollections(user.client, "리액트");
    expect(results.some((c) => c.title.includes("리액트"))).toBe(true);
  });

  it("링크 제목으로 검색한다", async () => {
    const results = await searchLinks(user.client, "Next.js");
    expect(results.some((l) => (l.title ?? "").includes("Next.js"))).toBe(true);
  });

  it("링크 url로 검색한다", async () => {
    const results = await searchLinks(user.client, "nextjs.org");
    expect(results.some((l) => l.url.includes("nextjs.org"))).toBe(true);
  });

  it("빈 쿼리는 빈 배열을 반환한다", async () => {
    expect(await searchCollections(user.client, "  ")).toEqual([]);
    expect(await searchLinks(user.client, "")).toEqual([]);
  });
});

describe("links note/url 편집", () => {
  it("createLink는 note를 저장하고 updateLink로 url·note·제목을 바꾼다", async () => {
    const user = await makeUser(`linknote-${Date.now()}@test.local`);
    const space = await createSpace(user.client, { user_id: user.id, name: "개인" });
    const c = await createCollection(user.client, { user_id: user.id, space_id: space.id, title: "C" });
    const created = await createLink(user.client, {
      user_id: user.id, collection_id: c.id, url: "https://a.com", note: "메모1",
    });
    expect(created.note).toBe("메모1");
    const updated = await updateLink(user.client, created.id, {
      url: "https://b.com", note: "메모2", custom_title: "내 제목",
    });
    expect(updated.url).toBe("https://b.com");
    expect(updated.note).toBe("메모2");
    expect(updated.custom_title).toBe("내 제목");
  });
});

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
