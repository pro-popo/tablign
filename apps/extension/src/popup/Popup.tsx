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
    let done = 0;
    for (const input of inputs) {
      try {
        await createLink(supabase, input);
        done++;
      } catch (err) {
        console.error("링크 저장 실패", err);
      }
    }
    setStatus(
      done === inputs.length
        ? `${done}개 탭 저장됨 ✓`
        : `${done}/${inputs.length}개 저장됨 (일부 실패)`,
    );
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
