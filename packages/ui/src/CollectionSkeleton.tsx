import { theme } from "./theme";

/** 컬렉션 로딩 중 표시하는 스켈레톤. 실제 데이터가 도착하기 전 EmptyState가 깜빡이는 것을 방지한다. */
export function CollectionSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div aria-busy="true" aria-label="컬렉션 불러오는 중">
      <style>{pulseKeyframes}</style>
      {Array.from({ length: sections }).map((_, i) => (
        <section key={i} style={{ marginBottom: 22, padding: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Bar width={16} height={16} radius={4} />
            <Bar width={120 + (i % 2) * 40} height={14} radius={6} />
            <Bar width={18} height={12} radius={6} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 9 }}>
            {Array.from({ length: 3 + (i % 2) }).map((_, j) => (
              <div
                key={j}
                style={{
                  border: `1px solid ${theme.borderCard}`,
                  borderRadius: theme.radiusCard,
                  padding: "10px 11px",
                  background: theme.surface,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Bar width={16} height={16} radius={4} />
                  <Bar width={`${60 + ((i + j) % 3) * 10}%`} height={12} radius={6} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <Bar width="40%" height={10} radius={6} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
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

const pulseKeyframes = `@keyframes tablign-skeleton-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .45 } }`;
