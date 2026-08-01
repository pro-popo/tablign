import { theme } from "./theme";

export interface PendingCollectionProps {
  /** 만들어질 컬렉션 이름. 담기 전에 이미 알고 있다(창 N / 공유 코드의 제목). */
  title: string;
  /** 들어갈 링크 수. 담을 탭 수 또는 코드 조회 결과의 link_count. */
  count: number;
}

/** 한 화면에 그릴 자리 상한 — 탭 100개를 그대로 그리면 DOM만 무거워지고 정보는 늘지 않는다. */
const MAX_SLOTS = 9;

/**
 * 아직 저장 중인 컬렉션의 골격.
 *
 * CollectionSkeleton(전체 로딩용)과 달리 **제목과 개수를 안다.** 저장 전에 이미 알고 있는
 * 값이라 자리 수가 실제 결과와 일치하고, 기다림이 진행으로 보인다.
 * 점선 테두리로 "아직 실체가 아님"을 표시한다.
 */
export function PendingCollection({ title, count }: PendingCollectionProps) {
  const slots = Math.min(count, MAX_SLOTS);
  return (
    <section
      aria-busy="true"
      aria-label={`${title} 담는 중`}
      style={{
        boxSizing: "border-box",
        marginBottom: 22,
        padding: 8,
        border: `1px dashed ${LAVENDER}`,
        borderRadius: 11,
        background: "rgba(237,240,254,.35)",
      }}
    >
      <style>{pulseKeyframes}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: theme.accent }}>{title}</span>
        <span style={{ fontSize: 12, color: theme.textFaint }}>링크 {count}개 담는 중</span>
        <Spinner />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 9 }}>
        {Array.from({ length: slots }).map((_, i) => (
          <div
            key={i}
            style={{
              boxSizing: "border-box",
              border: `1px solid ${theme.borderCard}`,
              borderRadius: theme.radiusCard,
              padding: "10px 11px",
              background: theme.surface,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Bar width={16} height={16} radius={4} />
              <Bar width={`${55 + (i % 3) * 12}%`} height={12} radius={6} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Bar width="40%" height={10} radius={6} />
            </div>
          </div>
        ))}
      </div>
      {count > slots && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: theme.textFaint }}>
          그 외 {count - slots}개
        </div>
      )}
    </section>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        boxSizing: "border-box",
        width: 13,
        height: 13,
        borderRadius: "50%",
        border: `2px solid ${theme.accentWeak}`,
        borderTopColor: theme.accent,
        animation: "tablign-pending-spin .7s linear infinite",
        flex: "none",
      }}
    />
  );
}

function Bar({ width, height, radius }: { width: number | string; height: number; radius: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: theme.surface2,
        animation: "tablign-skeleton-pulse 1.2s ease-in-out infinite",
      }}
    />
  );
}

/** 로고 중립 셀 색 — CollectionOnboarding·SpaceOnboarding과 같은 값 */
const LAVENDER = "#c9d4ff";

const pulseKeyframes = `
@keyframes tablign-skeleton-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .45 } }
@keyframes tablign-pending-spin { to { transform: rotate(360deg) } }
@media (prefers-reduced-motion: reduce) {
  [style*="tablign-skeleton-pulse"] { animation: none !important }
  [style*="tablign-pending-spin"] { animation: none !important }
}
`;
