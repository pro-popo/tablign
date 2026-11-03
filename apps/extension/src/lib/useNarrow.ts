import { useEffect, useState } from "react";

/** 창 폭이 이보다 좁으면 사이드바·열린 탭을 접어 두고, 마우스를 올릴 때 보드 위에 덮어 보여 준다. */
export const NARROW_WIDTH = 1200;
const QUERY = `(max-width: ${NARROW_WIDTH - 1}px)`;

export function useNarrow(): boolean {
  // matchMedia가 없는 환경(jsdom)은 넓은 화면으로 본다
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(QUERY).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return;
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}
