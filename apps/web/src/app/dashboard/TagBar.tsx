"use client";

import { useCollectionTags, useTags, useCreateTag, useAddTagToCollection, useRemoveTagFromCollection } from "@/lib/queries";

export function TagBar({ collectionId, userId }: { collectionId: string; userId: string }) {
  const { data: tags = [] } = useCollectionTags(collectionId);
  const { data: allTags = [] } = useTags();
  const createTag = useCreateTag();
  const addTag = useAddTagToCollection(collectionId);
  const removeTag = useRemoveTagFromCollection(collectionId);

  function handleAdd() {
    const name = prompt("태그 이름 (기존 태그면 그 태그가 연결됩니다)");
    if (!name) return;
    const existing = allTags.find((t) => t.name === name);
    if (existing) {
      addTag.mutate(existing.id);
    } else {
      createTag.mutate(
        { user_id: userId, name },
        { onSuccess: (tag) => addTag.mutate(tag.id) },
      );
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {tags.map((t) => (
        <span
          key={t.id}
          style={{
            fontSize: 11,
            background: "#e6ebff",
            color: "#2c46a6",
            borderRadius: 10,
            padding: "2px 8px",
            display: "inline-flex",
            gap: 4,
          }}
        >
          #{t.name}
          <button
            type="button"
            onClick={() => removeTag.mutate(t.id)}
            style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        style={{ fontSize: 11, border: "none", background: "none", color: "#06c", cursor: "pointer" }}
      >
        + 태그
      </button>
    </div>
  );
}
