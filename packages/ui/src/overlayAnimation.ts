/** 다이얼로그 공통 등장 애니메이션 — 오버레이 페이드 + 패널 팝인.
 *  각 다이얼로그가 <style>{overlayAnimationCss}</style>를 렌더하고
 *  overlay/panel div의 animation에 아래 상수를 지정한다. */
export const overlayAnimationCss = `
@keyframes tablign-overlay-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes tablign-panel-in { from { opacity: 0; transform: scale(.96) translateY(6px) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) {
  [style*="tablign-overlay-in"], [style*="tablign-panel-in"] { animation: none !important }
}
`;

export const overlayIn = "tablign-overlay-in .18s ease-out";
export const panelIn = "tablign-panel-in .2s cubic-bezier(.2,.8,.3,1)";
