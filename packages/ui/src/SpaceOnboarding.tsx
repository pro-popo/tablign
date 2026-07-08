import { Button } from "./Button";
import { Plus } from "./icons";
import { theme } from "./theme";

/** 로고(Bento 마크)의 중립 셀 색과 동일 (Logo.tsx NEUTRAL) */
const LAVENDER = "#c9d4ff";
const AMBER = "#f4c66a";
const GREEN = "#7bc47f";

export interface SpaceOnboardingProps {
  /** CTA(첫 스페이스 만들기) 클릭 시 호출 */
  onCreate: () => void;
}

/**
 * 스페이스 0개(신규 가입 직후·전부 삭제) 온보딩 빈 상태.
 * 18초 2막 팬터마임 — 1막: 겹친 창들 속 탭 스트립을 커서가 헤매다 ?(그 탭 어디 갔지),
 * 2막: 흩어진 탭 3장(좌2·우1)을 가운데 슬롯에 연달아 정리하고 👍.
 * 커서는 무대 레벨 단일 요소라 장면이 전환돼도 끊기지 않고 이어서 움직인다.
 */
export function SpaceOnboarding({ onCreate }: SpaceOnboardingProps) {
  return (
    // 보드 영역(height 100%) 안에서 수직·수평 가운데 정렬. marginBottom은 광학 보정(정중앙은 살짝 낮아 보임).
    <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ textAlign: "center", maxWidth: 420, marginBottom: 40 }}>
        <style>{keyframes}</style>
        <Pantomime />
        {/* 수직 리듬: 그래픽과 분리(26) → 텍스트 밀착(4) → 행동 구역(18) */}
        <div style={{ fontSize: 19, fontWeight: 740, letterSpacing: "-0.02em", margin: "26px 0 4px", color: theme.text }}>
          매일 여는 탭, 매번 찾고 있나요?
        </div>
        <p style={{ fontSize: 13.5, color: theme.textMuted, lineHeight: 1.5 }}>
          자주 쓰는 탭은 스페이스에 담아두세요.
          <br />
          필요할 때 한 번에 다시 열 수 있어요.
        </p>
        <Button
          onClick={onCreate}
          style={{
            marginTop: 18,
            padding: "9px 16px",
            fontSize: 13.5,
            fontWeight: 700,
            borderRadius: 9,
            boxShadow: "0 4px 14px rgba(59,91,219,.28)",
          }}
        >
          <Plus size={15} /> 첫 스페이스 만들기
        </Button>
      </div>
    </div>
  );
}

/** 2막 교차 장면 전체. 장식이므로 보조기기에 노출하지 않는다. */
function Pantomime() {
  return (
    // scale로 살짝 키운다(좌표계는 그대로 유지). origin을 아래쪽에 둬 제목과의 간격(26px)은 변하지 않는다.
    <div aria-hidden="true" style={{ width: 290, height: 196, margin: "0 auto", position: "relative", textAlign: "left", transform: "scale(1.22)", transformOrigin: "center bottom" }}>
      {/* 1막: 겹친 창들 + 커서 방황 */}
      <div style={{ position: "absolute", inset: 0, animation: "tablign-onb-act1 18s ease infinite" }}>
        <div style={{ position: "absolute", left: 20, top: 42, width: 250, height: 141 }}>
          <GhostWindow style={{ left: -24, top: -36, transform: "rotate(-3.2deg)", opacity: 0.35 }} />
          <GhostWindow style={{ left: 66, top: -18, transform: "rotate(2.6deg)", opacity: 0.6 }} />
          <MiniBrowser />
          <div style={qBubble}>?</div>
        </div>
      </div>
      {/* 2막: 가운데 슬롯 + 좌2·우1 탭 정리 */}
      <div style={{ position: "absolute", inset: 0, animation: "tablign-onb-act2 18s ease infinite" }}>
        <div style={{ position: "absolute", left: 6, top: 24, width: 278, height: 150 }}>
          <div style={dropSlot}>
            <div style={slotTitle} />
          </div>
          <TabCard style={{ left: 0, top: 16, zIndex: 3, animation: "tablign-onb-ca 18s cubic-bezier(.45,.05,.35,1) infinite" }} color={theme.accent} barWidth={42} />
          <TabCard style={{ left: 6, top: 64, zIndex: 2, animation: "tablign-onb-cb 18s cubic-bezier(.45,.05,.35,1) infinite" }} color={AMBER} barWidth={34} />
          <TabCard style={{ left: 194, top: 84, animation: "tablign-onb-cc 18s cubic-bezier(.45,.05,.35,1) infinite" }} color={GREEN} barWidth={46} />
          <div style={thumbBubble}>👍</div>
        </div>
      </div>
      {/* 단일 커서: 무대 레벨에 상주, 장면 전환 중에도 이어서 이동 */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        style={{ position: "absolute", left: 0, top: 0, width: 14, height: 14, zIndex: 10, animation: "tablign-onb-curx 18s ease-in-out infinite" }}
      >
        <path d="M5 3l14 8-6.5 1.5L9 19 5 3z" fill={theme.text} stroke="#fff" strokeWidth={1.4} />
      </svg>
    </div>
  );
}

/** 뒤에 겹쳐 보이는 창(브라우저가 여러 개 열려 있음을 암시) */
function GhostWindow({ style }: { style: React.CSSProperties }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        position: "absolute",
        width: 215,
        height: 105,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        background: theme.surface,
        boxShadow: "0 6px 16px rgba(20,30,60,.05)",
        ...style,
      }}
    >
      <div style={{ height: 14, background: theme.surface2, borderRadius: "9px 9px 0 0", display: "flex", alignItems: "center", gap: 3, padding: "0 6px" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "#d6dae0" }} />
        ))}
      </div>
    </div>
  );
}

/** 탭이 미어터진 미니 브라우저 창 */
function MiniBrowser() {
  return (
    // boxSizing 주의: 앱에는 전역 border-box 리셋이 없어 테두리 있는 요소는 명시해야 시안과 좌표가 일치한다.
    <div style={{ boxSizing: "border-box", position: "absolute", left: 0, top: 0, width: 250, height: 132, border: `1px solid ${theme.border}`, borderRadius: 11, background: theme.surface, boxShadow: "0 10px 26px rgba(20,30,60,.11)", overflow: "hidden" }}>
      <div style={{ height: 22, background: theme.surface2, display: "flex", alignItems: "center", gap: 4, padding: "0 9px" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#d6dae0" }} />
        ))}
      </div>
      <div style={{ display: "flex", padding: "7px 8px 0" }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              ...miniTab,
              // 커서가 지나는 탭(2·5·7번째)은 도착 타이밍에 맞춰 들썩인다
              animation:
                i === 1 ? "tablign-onb-t2 18s ease infinite"
                : i === 4 ? "tablign-onb-t5 18s ease infinite"
                : i === 6 ? "tablign-onb-t7 18s ease infinite"
                : undefined,
            }}
          >
            <i style={{ width: 7, height: 7, borderRadius: 2, flex: "none", background: (i + 1) % 3 === 0 ? theme.accent : (i + 1) % 3 === 1 ? AMBER : LAVENDER }} />
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${theme.border}`, height: "100%", background: theme.bg, padding: 9 }}>
        <div style={{ ...bodyLine, width: "70%" }} />
        <div style={{ ...bodyLine, width: "45%" }} />
      </div>
    </div>
  );
}

/** 정리 대상 탭 카드 */
function TabCard({ style, color, barWidth }: { style: React.CSSProperties; color: string; barWidth: number }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        position: "absolute",
        width: 84,
        height: 36,
        borderRadius: 9,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        boxShadow: "0 4px 12px rgba(20,30,60,.1)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 8px",
        ...style,
      }}
    >
      <i style={{ width: 12, height: 12, borderRadius: 3.5, flex: "none", background: color }} />
      <span style={{ width: barWidth, height: 8, borderRadius: 4, background: theme.surface2 }} />
    </div>
  );
}

const miniTab: React.CSSProperties = {
  boxSizing: "border-box",
  width: 42, height: 17, borderRadius: "6px 6px 0 0", background: theme.surface2,
  border: `1px solid ${theme.border}`, borderBottom: "none", marginRight: -14, flex: "none",
  display: "flex", alignItems: "center", paddingLeft: 5, transformOrigin: "bottom center", position: "relative",
};

const bodyLine: React.CSSProperties = { height: 8, borderRadius: 4, background: theme.surface2, marginBottom: 6 };

const qBubble: React.CSSProperties = {
  // 복귀한 커서 팁(106,36) 바로 위에 붙는 ? 말풍선(간격 3px), 꼬리(좌하단)가 커서를 가리킨다
  position: "absolute", left: 110, top: 13, width: 20, height: 20, borderRadius: "10px 10px 10px 3px",
  background: theme.text, color: "#fff", fontSize: 12, fontWeight: 800,
  display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, zIndex: 4,
  animation: "tablign-onb-q 18s ease infinite",
};

const thumbBubble: React.CSSProperties = {
  // 슬롯 밖으로 물러난 커서 바로 위에 붙는 👍 말풍선 — ?와 같은 문법
  position: "absolute", left: 217, top: 115, width: 20, height: 20, borderRadius: "10px 10px 10px 3px",
  background: theme.text, fontSize: 10, lineHeight: 1,
  display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, zIndex: 4,
  animation: "tablign-onb-thumb 18s ease infinite",
};

const dropSlot: React.CSSProperties = {
  boxSizing: "border-box",
  position: "absolute", left: 87, top: 4, width: 104, height: 142, borderRadius: 12,
  border: `1.5px dashed ${theme.textFaint}`, background: theme.surface,
  animation: "tablign-onb-slot 18s ease infinite",
};

const slotTitle: React.CSSProperties = {
  // 컬렉션 제목 자리 회색 바 — 슬롯 배경이 파랗게 물들 때 함께 진해져 묻히지 않는다
  width: 50, height: 8, borderRadius: 4, background: theme.surface2, margin: "8px auto 0",
  animation: "tablign-onb-st 18s ease infinite",
};

const keyframes = `
/* 18s 사이클. 1막 유지(?)까지 40%, 2막은 3연속 드롭 후 86%까지 머묾. 크로스페이드 1.6초. */
@keyframes tablign-onb-act1 { 0%, 40% { opacity: 1 } 49%, 90% { opacity: 0 } 99%, 100% { opacity: 1 } }
@keyframes tablign-onb-act2 { 0%, 41% { opacity: 0 } 50%, 86% { opacity: 1 } 94%, 100% { opacity: 0 } }
/* 통합 커서 경로(무대 좌표): 1막 방황 → (전환 중 글라이드) → 2막 3연속 드롭 → 물러남 → (전환 중 복귀) */
@keyframes tablign-onb-curx {
  0%, 3% { transform: translate(50px, 138px) }
  6%, 9% { transform: translate(67px, 76px) }
  12.5%, 15% { transform: translate(151px, 76px) }
  19.5%, 22% { transform: translate(207px, 76px) }
  25%, 29.5% { transform: translate(123px, 76px) }
  45% { transform: translate(123px, 76px); animation-timing-function: ease-in-out }
  51% { transform: translate(64px, 64px); animation-timing-function: ease-out }
  51.4% { transform: translate(64px, 64px) scale(.8); animation-timing-function: ease-out }
  52% { transform: translate(68px, 57px) scale(1); animation-timing-function: cubic-bezier(.4,.05,.2,1) }
  56.5% { transform: translate(159px, 66px); animation-timing-function: ease-out }
  57.7% { transform: translate(161px, 76px) scale(.8); animation-timing-function: ease-out }
  58.4% { transform: translate(161px, 76px) scale(1); animation-timing-function: ease-in-out }
  61% { transform: translate(70px, 112px); animation-timing-function: ease-out }
  61.4% { transform: translate(70px, 112px) scale(.8); animation-timing-function: ease-out }
  62.2% { transform: translate(74px, 105px) scale(1); animation-timing-function: cubic-bezier(.4,.05,.2,1) }
  66.5% { transform: translate(159px, 104px); animation-timing-function: ease-out }
  67.7% { transform: translate(161px, 114px) scale(.8); animation-timing-function: ease-out }
  68.4% { transform: translate(161px, 114px) scale(1); animation-timing-function: ease-in-out }
  70.4% { transform: translate(258px, 132px); animation-timing-function: ease-out }
  70.8% { transform: translate(258px, 132px) scale(.8); animation-timing-function: ease-out }
  71.6% { transform: translate(255px, 126px) scale(1); animation-timing-function: cubic-bezier(.4,.05,.2,1) }
  74.3% { transform: translate(163px, 142px); animation-timing-function: ease-out }
  75.4% { transform: translate(161px, 152px) scale(.8); animation-timing-function: ease-out }
  76.1% { transform: translate(161px, 152px) scale(1); animation-timing-function: ease-in-out }
  78.5%, 89% { transform: translate(218px, 160px); animation-timing-function: ease-in-out }
  96%, 100% { transform: translate(50px, 138px) }
}
/* ?: 커서 복귀 후 반 박자 쉬고 떠서 완료 장면 내내 유지 */
@keyframes tablign-onb-q { 0%, 32% { opacity: 0 } 34%, 47% { opacity: 1 } 51%, 100% { opacity: 0 } }
/* 👍: 커서가 슬롯 밖으로 물러난 뒤 반 박자 쉬고 등장 */
@keyframes tablign-onb-thumb { 0%, 81% { opacity: 0; transform: translateY(3px) } 83.5%, 93% { opacity: 1; transform: none } 96%, 100% { opacity: 0 } }
@keyframes tablign-onb-t2 { 0%, 4.5%, 10.5%, 100% { transform: none; background: ${theme.surface2} } 6%, 9% { transform: translateY(-3px); background: ${theme.accentWeak} } }
@keyframes tablign-onb-t5 { 0%, 11%, 16.5%, 100% { transform: none; background: ${theme.surface2} } 12.5%, 15% { transform: translateY(-3px); background: ${theme.accentWeak} } }
@keyframes tablign-onb-t7 { 0%, 18%, 23.5%, 100% { transform: none; background: ${theme.surface2} } 19.5%, 22% { transform: translateY(-3px); background: ${theme.accentWeak} } }
/* 슬롯 반응: 드래그 오버 → 드롭 플래시(3회) → 담긴 상태 유지 */
@keyframes tablign-onb-slot {
  0%, 52%, 99%, 100% { border: 1.5px dashed ${theme.textFaint}; background: ${theme.surface} }
  54.5%, 57% { border: 1.5px dashed ${theme.accent}; background: ${theme.accentWeak} }
  58.2% { border: 1.5px solid ${theme.accent}; background: #d9e2fc }
  60%, 66.8% { border: 1.5px solid #aebdf0; background: ${theme.accentWeak} }
  68.2% { border: 1.5px solid ${theme.accent}; background: #d9e2fc }
  70%, 74.6% { border: 1.5px solid #aebdf0; background: ${theme.accentWeak} }
  76% { border: 1.5px solid ${theme.accent}; background: #d9e2fc }
  77.5%, 96% { border: 1.5px solid #aebdf0; background: ${theme.accentWeak} }
}
@keyframes tablign-onb-st { 0%, 52%, 99%, 100% { background: ${theme.surface2} } 54.5%, 96% { background: #ccd6f4 } }
/* 1번(파랑): (0,16,-4°) → 슬롯 1칸 = translate(97,12). 집기 → 운반(하나의 곡선) → 사뿐한 착지 */
@keyframes tablign-onb-ca {
  0%, 51% { transform: rotate(-4deg); box-shadow: 0 4px 12px rgba(20,30,60,.1); animation-timing-function: ease-out }
  52% { transform: translate(4px, -7px) rotate(-2deg) scale(1.04); box-shadow: 0 12px 24px rgba(20,30,60,.18); animation-timing-function: cubic-bezier(.4,.05,.2,1) }
  56.5% { transform: translate(95px, 2px) rotate(-1deg) scale(1.04); box-shadow: 0 10px 20px rgba(20,30,60,.16); animation-timing-function: ease-out }
  57.7% { transform: translate(97px, 13px) rotate(0) scale(1); box-shadow: 0 3px 8px rgba(20,30,60,.1); animation-timing-function: ease-out }
  58.4%, 96% { transform: translate(97px, 12px) scale(.97); box-shadow: 0 2px 6px rgba(20,30,60,.08) }
  98%, 100% { transform: rotate(-4deg); box-shadow: 0 4px 12px rgba(20,30,60,.1) }
}
/* 2번(노랑): (6,64,3°) → 슬롯 2칸 = translate(91,2) */
@keyframes tablign-onb-cb {
  0%, 61.3% { transform: rotate(3deg); box-shadow: 0 4px 12px rgba(20,30,60,.1); animation-timing-function: ease-out }
  62.2% { transform: translate(4px, -7px) rotate(1deg) scale(1.04); box-shadow: 0 12px 24px rgba(20,30,60,.18); animation-timing-function: cubic-bezier(.4,.05,.2,1) }
  66.5% { transform: translate(89px, -8px) rotate(1deg) scale(1.04); box-shadow: 0 10px 20px rgba(20,30,60,.16); animation-timing-function: ease-out }
  67.7% { transform: translate(91px, 3px) rotate(0) scale(1); box-shadow: 0 3px 8px rgba(20,30,60,.1); animation-timing-function: ease-out }
  68.4%, 96% { transform: translate(91px, 2px) scale(.97); box-shadow: 0 2px 6px rgba(20,30,60,.08) }
  98%, 100% { transform: rotate(3deg); box-shadow: 0 4px 12px rgba(20,30,60,.1) }
}
/* 3번(초록): (194,84,-2°) → 슬롯 3칸 = translate(-97,20). 오른쪽에서 왼쪽으로 담긴다 */
@keyframes tablign-onb-cc {
  0%, 70.8% { transform: rotate(-2deg); box-shadow: 0 4px 12px rgba(20,30,60,.1); animation-timing-function: ease-out }
  71.6% { transform: translate(-3px, -6px) rotate(-1deg) scale(1.04); box-shadow: 0 12px 24px rgba(20,30,60,.18); animation-timing-function: cubic-bezier(.4,.05,.2,1) }
  74.3% { transform: translate(-95px, 10px) rotate(0) scale(1.04); box-shadow: 0 10px 20px rgba(20,30,60,.16); animation-timing-function: ease-out }
  75.4% { transform: translate(-97px, 21px) rotate(0) scale(1); box-shadow: 0 3px 8px rgba(20,30,60,.1); animation-timing-function: ease-out }
  76.1%, 96% { transform: translate(-97px, 20px) scale(.97); box-shadow: 0 2px 6px rgba(20,30,60,.08) }
  98%, 100% { transform: rotate(-2deg); box-shadow: 0 4px 12px rgba(20,30,60,.1) }
}
@media (prefers-reduced-motion: reduce) {
  [style*="tablign-onb-"] { animation: none !important }
  [style*="tablign-onb-act2"] { opacity: 0 !important }
  [style*="tablign-onb-act1"] { opacity: 1 !important }
  [style*="tablign-onb-q"] { opacity: 0 !important }
  [style*="tablign-onb-thumb"] { opacity: 0 !important }
  [style*="tablign-onb-curx"] { transform: translate(50px, 138px) !important }
}
`;
