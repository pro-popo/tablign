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
  updateCollection,
  listTags,
  createTag,
  addTagToCollection,
  removeTagFromCollection,
  listTagsForCollection,
  listCollectionIdsForTag,
  searchCollections,
  searchLinks,
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

export function useUpdateLink(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; patch: { custom_title: string | null; url: string; note: string | null } }) =>
      updateLink(supabase, args.id, args.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["links", collectionId] }),
  });
}

export function useRenameCollection(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; title: string }) => updateCollection(supabase, args.id, { title: args.title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections", spaceId] }),
  });
}

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: () => listTags(supabase) });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { user_id: string; name: string }) => createTag(supabase, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useCollectionTags(collectionId: string) {
  return useQuery({
    queryKey: ["collection_tags", collectionId],
    queryFn: () => listTagsForCollection(supabase, collectionId),
  });
}

export function useAddTagToCollection(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => addTagToCollection(supabase, collectionId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection_tags", collectionId] }),
  });
}

export function useRemoveTagFromCollection(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => removeTagFromCollection(supabase, collectionId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection_tags", collectionId] }),
  });
}

export function useCollectionIdsForTag(tagId: string | null) {
  return useQuery({
    queryKey: ["tag_collections", tagId],
    queryFn: () => listCollectionIdsForTag(supabase, tagId!),
    enabled: !!tagId,
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      const [collections, links] = await Promise.all([
        searchCollections(supabase, query),
        searchLinks(supabase, query),
      ]);
      return { collections, links };
    },
    enabled: query.trim().length > 0,
  });
}

export { moveLink, updateLink, supabase };
