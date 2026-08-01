import { theme } from "./theme";

/** 전체 포함 / 일부만 / 제외. 스페이스는 셋 다, 컬렉션은 on·none만 쓴다. */
export type TriState = "on" | "some" | "none";

/**
 * 3상태 체크박스 스타일. 쓰는 화면이 `<style>{triCheckboxCss}</style>`를 한 번 렌더한다
 * (overlayAnimationCss와 같은 방식). 인라인 스타일로는 전환·포커스링·reduced-motion을
 * 표현할 수 없어서 클래스로 뺐다.
 *
 * 체크 표시는 SVG 선이고 `stroke-dashoffset`으로 **그려진다** — 이전 구현처럼
 * 테두리 두 개를 회전시키면 선 끝이 각지고 두 변의 두께가 어긋난다.
 * 해제하면 같은 선이 거꾸로 지워져 "되돌린다"가 보인다.
 */
export const triCheckboxCss = `
.tbl-cbx {
  position: relative; width: 15px; height: 15px; flex: none; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  border: 1.5px solid #ccd2da; background: ${theme.surface}; border-radius: 4.5px;
  transition: background .16s ease, border-color .16s ease;
}
.tbl-cbx[data-state="on"], .tbl-cbx[data-state="some"] {
  background: ${theme.accent}; border-color: ${theme.accent};
}
.tbl-cbx:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: 2px }
.tbl-cbx svg { width: 100%; height: 100%; display: block; overflow: visible }
.tbl-cbx path {
  fill: none; stroke: #fff; stroke-width: 2.1; stroke-linecap: round; stroke-linejoin: round;
}
/* dasharray는 경로 길이보다 넉넉히 — 부족하면 선이 다 안 그려진다 */
.tbl-cbx .tbl-cbx-tick {
  stroke-dasharray: 16; stroke-dashoffset: 16;
  transition: stroke-dashoffset .24s cubic-bezier(.5,0,.3,1) .04s;
}
.tbl-cbx[data-state="on"] .tbl-cbx-tick { stroke-dashoffset: 0 }
.tbl-cbx .tbl-cbx-bar {
  stroke-dasharray: 9; stroke-dashoffset: 9;
  transition: stroke-dashoffset .18s ease .03s;
}
.tbl-cbx[data-state="some"] .tbl-cbx-bar { stroke-dashoffset: 0 }
@media (prefers-reduced-motion: reduce) {
  .tbl-cbx, .tbl-cbx path { transition: none }
}
`;

export interface TriCheckboxProps {
  state: TriState;
  /** 스크린리더용 이름 — "<대상> 포함"처럼 무엇을 켜고 끄는지 밝힌다 */
  label: string;
  onToggle: () => void;
}

export function TriCheckbox({ state, label, onToggle }: TriCheckboxProps) {
  function fire(e: React.SyntheticEvent) {
    e.stopPropagation();
    onToggle();
  }
  return (
    <span
      className="tbl-cbx"
      data-state={state}
      role="checkbox"
      tabIndex={0}
      aria-checked={state === "some" ? "mixed" : state === "on"}
      aria-label={label}
      onClick={fire}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(e); }
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path className="tbl-cbx-tick" d="M3.6 8.4 L6.5 11.2 L12.4 4.8" />
        <path className="tbl-cbx-bar" d="M3.8 8 H12.2" />
      </svg>
    </span>
  );
}
