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
        <p>팝업(확장 아이콘)에서 로그인하면 여기에 컬렉션이 표시됩니다.</p>
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
