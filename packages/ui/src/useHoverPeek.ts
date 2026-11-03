import { useCallback, useEffect, useRef, useState, type FocusEvent, type RefObject } from "react";

const OPEN_DELAY = 150;
const CLOSE_DELAY = 300;

/** 마우스를 올리면 잠깐 덮어 보여 주는 패널의 열림 상태. AppShell의 leftPeek·rightPeek에 그대로 넘긴다. */
export interface HoverPeek {
  open: boolean;
  enter: () => void;
  leave: () => void;
  /** 덮개 요소 — 안에 포커스가 있는지 볼 때 쓴다 */
  ref?: RefObject<HTMLDivElement>;
  /** 덮개에서 포커스가 빠질 때 — 입력하느라 열어 둔 덮개를 닫는다 */
  blur?: (e: FocusEvent) => void;
}

/**
 * 올리면 열고 벗어나면 닫는다. 지나가다 열리지 않게 0.15초 머물러야 열리고, 덮개로 옮겨 가는 동안
 * 닫히지 않게 0.3초 뒤에 닫는다. ref를 단 덮개 안에 포커스가 있으면(입력 중) 벗어나도 닫지 않는다.
 */
export function useHoverPeek() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ref = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);

  const clear = () => clearTimeout(timer.current);
  const enter = useCallback(() => {
    hovering.current = true;
    clear();
    timer.current = setTimeout(() => setOpen(true), OPEN_DELAY);
  }, []);
  const leave = useCallback(() => {
    hovering.current = false;
    clear();
    if (ref.current?.contains(document.activeElement)) return;
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, []);
  const close = useCallback(() => { clear(); setOpen(false); }, []);
  const blur = useCallback((e: FocusEvent) => {
    if (hovering.current || ref.current?.contains(e.relatedTarget as Node | null)) return;
    clear();
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, []);

  useEffect(() => clear, []);

  return { open, enter, leave, close, blur, ref };
}
