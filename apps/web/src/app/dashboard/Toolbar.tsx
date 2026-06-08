"use client";

import { useState } from "react";
import { Button, InlineInput, theme, Plus } from "@tablign/ui";

export interface ToolbarProps {
  spaceName: string;
  collectionCount: number;
  canAdd: boolean;
  onAddCollection: (title: string) => void;
}

export function Toolbar({ spaceName, collectionCount, canAdd, onAddCollection }: ToolbarProps) {
  const [adding, setAdding] = useState(false);
  return (
    <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}`, background: theme.surface }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: 15 }}>{spaceName}</strong>
        <span style={{ color: theme.textFaint }}>· {collectionCount} 컬렉션</span>
      </div>
      {adding ? (
        <div style={{ width: 220 }}>
          <InlineInput placeholder="컬렉션 제목" onSubmit={(v) => { onAddCollection(v); setAdding(false); }} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <Button onClick={() => setAdding(true)} disabled={!canAdd}>
          <Plus size={15} /> 컬렉션
        </Button>
      )}
    </div>
  );
}
