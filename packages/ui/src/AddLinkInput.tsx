import { useState } from "react";

export interface AddLinkInputProps {
  onAdd: (url: string) => void;
}

export function AddLinkInput({ onAdd }: AddLinkInputProps) {
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={submit}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="URL 붙여넣기"
        style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 6 }}
      />
    </form>
  );
}
