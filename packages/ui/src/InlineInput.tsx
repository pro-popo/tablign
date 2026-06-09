import { useState } from "react";
import { theme } from "./theme";

export interface InlineInputProps {
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  autoFocus?: boolean;
  defaultValue?: string;
}

export function InlineInput({ placeholder, onSubmit, onCancel, autoFocus = true, defaultValue = "" }: InlineInputProps) {
  const [value, setValue] = useState(defaultValue);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = value.trim();
      if (!trimmed) return;
      onSubmit(trimmed);
      setValue("");
    } else if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <input
      autoFocus={autoFocus}
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKey}
      onBlur={onCancel}
      style={{
        width: "100%",
        padding: "7px 9px",
        border: `1px solid ${theme.accent}`,
        borderRadius: theme.radiusBtn,
        fontSize: 13,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}
