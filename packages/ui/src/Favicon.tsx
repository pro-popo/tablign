import { useState } from "react";
import { Globe } from "./icons";
import { theme } from "./theme";

export function Favicon({ url, size = 16 }: { url: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <Globe size={size} color={theme.textFaint} strokeWidth={2} />;
  }
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: 4, flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}
