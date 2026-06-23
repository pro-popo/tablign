import { useState } from "react";
import { theme } from "./theme";

export interface InlineInputProps {
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  autoFocus?: boolean;
  defaultValue?: string;
  /** "box"(기본): 테두리 박스 / "line": 밑줄만 있는 인라인 입력 */
  variant?: "box" | "line";
}

export function InlineInput({ placeholder, onSubmit, onCancel, autoFocus = true, defaultValue = "", variant = "box" }: InlineInputProps) {
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
      style={
        variant === "line"
          ? {
              width: "100%",
              padding: "3px 1px",
              border: "none",
              borderBottom: `1.5px solid ${theme.accent}`,
              borderRadius: 0,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
              background: "transparent",
            }
          : {
              width: "100%",
              padding: "7px 9px",
              border: `1px solid ${theme.accent}`,
              borderRadius: theme.radiusBtn,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }
      }
    />
  );
}
