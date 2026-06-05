"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./queries";

/**
 * spaces/collections/links/collection_tags 변경을 구독해
 * 관련 TanStack Query 캐시를 무효화한다. (멀티 디바이스/탭 동기화)
 */
export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("tablign-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces" }, () =>
        qc.invalidateQueries({ queryKey: ["spaces"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "collections" }, () =>
        qc.invalidateQueries({ queryKey: ["collections"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "links" }, () =>
        qc.invalidateQueries({ queryKey: ["links"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "collection_tags" }, () => {
        // 컬렉션별 태그 목록과 태그필터(tag_collections) 둘 다 무효화
        qc.invalidateQueries({ queryKey: ["collection_tags"] });
        qc.invalidateQueries({ queryKey: ["tag_collections"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
