"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSpaces,
  createSpace,
  listCollections,
  createCollection,
  deleteCollection,
  listLinks,
  createLink,
  deleteLink,
  moveLink,
  updateLink,
} from "@tablign/core";
import { createClient } from "./supabase/browser";
import { fetchMetadata } from "./metadata";

const supabase = createClient();

export function useSpaces() {
  return useQuery({ queryKey: ["spaces"], queryFn: () => listSpaces(supabase) });
}

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { user_id: string; name: string }) => createSpace(supabase, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spaces"] }),
  });
}

export function useCollections(spaceId: string | null) {
  return useQuery({
    queryKey: ["collections", spaceId],
    queryFn: () => listCollections(supabase, spaceId!),
    enabled: !!spaceId,
  });
}

export function useCreateCollection(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { user_id: string; space_id: string; title: string }) =>
      createCollection(supabase, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections", spaceId] }),
  });
}

export function useDeleteCollection(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCollection(supabase, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections", spaceId] }),
  });
}

export function useLinks(collectionId: string) {
  return useQuery({
    queryKey: ["links", collectionId],
    queryFn: () => listLinks(supabase, collectionId),
  });
}

export function useAddLink(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; url: string }) => {
      const meta = await fetchMetadata(input.url);
      return createLink(supabase, {
        user_id: input.user_id,
        collection_id: collectionId,
        url: input.url,
        title: meta.title,
        favicon_url: meta.favicon_url,
        thumbnail_url: meta.thumbnail_url,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["links", collectionId] }),
  });
}

export function useDeleteLink(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLink(supabase, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["links", collectionId] }),
  });
}

export { moveLink, updateLink, supabase };
