"use client";

import { useState } from "react";
import { InlineInput, theme, Plus, X } from "@tablign/ui";
import { useCollectionTags, useTags, useCreateTag, useAddTagToCollection, useRemoveTagFromCollection } from "@/lib/queries";

export function TagBar({ collectionId, userId }: { collectionId: string; userId: string }) {
  const { data: tags = [] } = useCollectionTags(collectionId);
  const { data: allTags = [] } = useTags();
  const createTag = useCreateTag();
  const addTag = useAddTagToCollection(collectionId);
  const removeTag = useRemoveTagFromCollection(collectionId);
  const [adding, setAdding] = useState(false);

  function handleAdd(name: string) {
    setAdding(false);
    const existing = allTags.find((t) => t.name === name);
    if (existing) {
      addTag.mutate(existing.id);
    } else {
      createTag.mutate({ user_id: userId, name }, { onSuccess: (tag) => addTag.mutate(tag.id) });
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {tags.map((t) => (
        <span
          key={t.id}
          style={{
            fontSize: 11,
            background: theme.accentWeak,
            color: theme.accent,
            borderRadius: theme.radiusChip,
            padding: "2px 4px 2px 8px",
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          #{t.name}
          <button
            type="button"
            aria-label={`${t.name} 태그 제거`}
            onClick={() => removeTag.mutate(t.id)}
            style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", display: "flex", padding: 0 }}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {adding ? (
        <div style={{ width: 140 }}>
          <InlineInput placeholder="태그 이름" onSubmit={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ fontSize: 11, border: "none", background: "none", color: theme.accent, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2 }}
        >
          <Plus size={12} /> 태그
        </button>
      )}
    </div>
  );
}
