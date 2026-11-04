import { useLayoutEffect, useRef, useState } from "react";
import { Globe } from "./icons";
import { theme } from "./theme";

export function Favicon({ url, size = 16 }: { url: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // 캐시에 있던 아이콘은 그리기 전에 바로 보여 준다 — 새 탭마다 지구본이 한 번씩 깜빡이지 않게
  useLayoutEffect(() => {
    if (img.current?.complete && img.current.naturalWidth > 0) setLoaded(true);
  }, [url]);

  if (!url || failed) {
    return <Globe size={size} color={theme.textFaint} strokeWidth={2} />;
  }
  return (
    <>
      {/* 받아오는 동안엔 지구본 — 응답 없는 사내 주소는 시간 초과까지 빈칸으로 남는다 */}
      {!loaded && <Globe size={size} color={theme.textFaint} strokeWidth={2} />}
      <img
        ref={img}
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 4, flexShrink: 0, display: loaded ? undefined : "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </>
  );
}
