/** 색은 CSS 변수(--tb-*)를 가리킨다 — 실제 값은 themeTokens.computeTokens가 정하고 applyTokens가 문서에 넣는다.
 *  인라인 스타일에 그대로 끼워 쓰면 되고, 모드·강조색이 바뀌어도 다시 렌더할 필요가 없다. */
const v = <K extends string>(name: K) => `var(--tb-${name})` as const;

export const theme = {
  accent: v("accent"),
  accentWeak: v("accent-weak"),
  /** 누름·테두리처럼 accentWeak보다 조금 진한 강조색 */
  accentSoft: v("accent-soft"),
  /** 일러스트·장식에 쓰는 옅은 강조색 */
  accentTint: v("accent-tint"),
  /** accentWeak 위에서 읽히는 강조 글자 */
  accentInk: v("accent-ink"),
  /** 강조색으로 채운 버튼 위 글자 */
  onAccent: v("on-accent"),
  text: v("text"),
  /** 제목처럼 text보다 살짝 옅은 진한 글자 */
  textStrong: v("text-strong"),
  /** 본문 보조 글자(메뉴·목록 항목) */
  textSub: v("text-sub"),
  textMuted: v("text-muted"),
  textFaint: v("text-faint"),
  border: v("border"),
  borderCard: v("border-card"),
  /** 체크박스 테두리·스크롤바처럼 더 진한 선 */
  borderStrong: v("border-strong"),
  bg: v("bg"),
  surface: v("surface"),
  surface2: v("surface2"),
  /** 누름·자리표시처럼 surface2보다 진한 채움 */
  surface3: v("surface3"),
  /** 조직 레일 바탕 */
  rail: v("rail"),
  /** 레일 구분선 */
  divider: v("divider"),
  danger: v("danger"),
  dangerWeak: v("danger-weak"),
  dangerLine: v("danger-line"),
  warnBg: v("warn-bg"),
  warnLine: v("warn-line"),
  warnInk: v("warn-ink"),
  /** 로고 셀의 브랜드 초록(#7bc47f)을 흰 글리프가 살 만큼 내린 값. 흰색 대비 3.39:1 —
   *  아이콘·도형 기준(3:1)을 통과한다. 밝은 원본은 채움 배경으로 쓸 수 없다(2.09:1). */
  greenDeep: v("green-deep"),
  /** 화면 바닥(배경 단색·그라데이션·사진) */
  page: v("page"),
  /** 배경 위 판(사이드바·오른쪽 패널) 바탕 — 배경이 없으면 surface */
  pane: v("pane"),
  /** 배경 위 조직 레일 바탕 — 배경이 없으면 rail */
  paneRail: v("pane-rail"),
  /** 배경 위 컬렉션 판 바탕 — 배경이 없으면 투명 */
  paneCol: v("pane-col"),
  /** 판 뒤 흐림(backdrop-filter 값) */
  paneBlur: v("pane-blur"),
  /** 배경 위에 바로 놓인 글자 */
  boardInk: v("board-ink"),
  radiusCard: 9,
  radiusBtn: 7,
  radiusChip: 8,
  /** 스페이스·조직 아이콘 이모지 폰트 — 토스페이스 1순위, 없으면 시스템 컬러 이모지로 fallback. */
  iconFont: '"Tossface", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
} as const;
