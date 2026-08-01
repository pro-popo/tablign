import type { ReactNode } from "react";
import { AppWindow, ChevronRight, Plus, SquareStack, Ticket } from "./icons";
import { theme } from "./theme";

export interface CollectionOnboardingProps {
  /** 담을 수 있는 탭이 하나라도 있는 창의 수. 0이면 첫 카드가 비활성된다. */
  windowCount: number;
  /** 담을 수 있는 탭 총 개수. group.tabs.length가 아니라 http(s) 필터 이후 값을 넘겨야 한다. */
  tabCount: number;
  /** 열린 창을 창별 컬렉션 1개씩으로 담는다. tabCount가 0이면 호출되지 않는다. */
  onSaveOpenWindows: () => void;
  onCreateEmpty: () => void;
  onImportCode: () => void;
}

/**
 * 스페이스에 컬렉션이 0개일 때의 빈 상태.
 *
 * 세 경로(열린 창 담기 / 빈 컬렉션 / 공유 코드)를 **동등하게** 보여준다 — 크기·아이콘·테두리가 모두
 * 같고 accent는 어디에도 쓰지 않는다. 유일한 위계는 순서다. 그래서 첫 카드가 비활성돼도
 * 레이아웃이 그대로 유지되고 화면이 흔들리지 않는다.
 *
 * SpaceOnboarding(스페이스 0개)과 달리 애니메이션·감성 헤드라인을 쓰지 않는다.
 * 둘이 같은 무게면 신규 사용자가 온보딩을 두 번 보게 된다.
 */
export function CollectionOnboarding({
  windowCount,
  tabCount,
  onSaveOpenWindows,
  onCreateEmpty,
  onImportCode,
}: CollectionOnboardingProps) {
  const canSave = tabCount > 0;
  // 창이 1개일 때 "열린 창 1개를 창별 컬렉션으로"는 어색하다. 문구를 갈라준다.
  const single = windowCount === 1;

  return (
    // SpaceOnboarding과 달리 이 화면 위에는 보드 헤더가 있다. minHeight:100%를 쓰면 헤더 높이만큼
    // 넘쳐 스크롤이 생기고 세로 중앙도 어긋나므로, flex 부모가 준 남은 공간을 flex:1로 채운다.
    // boxSizing: 앱에 전역 border-box 리셋이 없어 명시해야 padding이 크기를 넘기지 않는다.
    <div style={{ boxSizing: "border-box", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 16px 40px" }}>
      <style>{styles}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 740, letterSpacing: "-0.02em", color: theme.text }}>
            탭을 담을 첫 컬렉션을 만들어요
          </div>
          <p style={{ margin: "6px auto 0", maxWidth: 360, fontSize: 13, lineHeight: 1.55, color: theme.textMuted }}>
            컬렉션은 탭을 모아두는 서랍이에요
          </p>
        </div>

        {/* 순서는 '여기서 드러내야 이득이 큰 것'이 위다. '빈 컬렉션'은 바로 위 헤더의
            ＋ 컬렉션으로 항상 한 번에 되므로 맨 아래여도 잃는 게 없고, 중립색 카드가
            가운데 오면 리듬이 끊겨 비활성된 줄처럼 읽힌다. */}
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {canSave ? (
            <Choice
              tone="accent"
              icon={single ? <AppWindow size={19} /> : <SquareStack size={19} />}
              title={single ? `지금 창의 탭 ${tabCount}개 담기` : `열린 창 ${windowCount}개를 그대로 담기`}
              sub={single ? "창 1을 그대로 컬렉션으로" : `창별로 컬렉션 1개씩 · 탭 ${tabCount}개`}
              onClick={onSaveOpenWindows}
            />
          ) : (
            <Choice
              tone="accent"
              icon={<SquareStack size={19} />}
              title="열린 창 담기"
              badge="담을 탭 0개"
              sub="브라우저 내부 페이지만 열려 있어요"
              disabled
            />
          )}
          <Choice
            tone="green"
            icon={<Ticket size={19} />}
            title="공유 코드로 추가"
            sub="코드 8자리로 컬렉션 복사"
            onClick={onImportCode}
          />
          <Choice
            tone="neutral"
            icon={<Plus size={19} />}
            title="빈 컬렉션 만들기"
            sub="이름부터 정하고 하나씩 담기"
            onClick={onCreateEmpty}
          />
        </div>
      </div>
    </div>
  );
}

/** 아이콘 색조 — 개념마다 이유가 있다.
 *  accent  = 앱의 동작색(핵심 경로인 '담기')
 *  green   = 외부에서 받아오는 것('공유 코드')
 *  neutral = 비어 있음 그 자체('빈 컬렉션') — 색을 주지 않는 게 의미와 맞다 */
type Tone = "accent" | "green" | "neutral";

const TONES: Record<Tone, React.CSSProperties> = {
  accent: { background: theme.accent, color: "#fff", boxShadow: "0 2px 6px rgba(59,91,219,.26)" },
  green: { background: theme.greenDeep, color: "#fff", boxShadow: "0 2px 6px rgba(47,158,99,.26)" },
  neutral: { background: theme.surface2, color: "#5c636b" },
};
/** 못 누르는 것에 주 색을 쓰면 "왜 안 눌리지"가 된다 */
const TONE_DISABLED: React.CSSProperties = { background: theme.surface2, color: theme.textFaint };

function Choice({
  tone, icon, title, sub, badge, onClick, disabled,
}: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  sub: string;
  badge?: string;
  onClick?: () => void;
  /** 눌러도 의미가 없는 상태(담을 탭 0개) — 아이콘까지 회색으로 내린다 */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="tablign-choice"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="tablign-choice-icon" style={disabled ? TONE_DISABLED : TONES[tone]}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: theme.text }}>
          {title}
          {badge && (
            <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: theme.textMuted, background: theme.surface2, borderRadius: 5, padding: "1px 6px" }}>
              {badge}
            </span>
          )}
        </span>
        <span style={{ display: "block", marginTop: 3, fontSize: 11.5, fontWeight: 400, color: theme.textMuted }}>
          {sub}
        </span>
      </span>
      {/* 못 누르는 카드에서는 지운다 — ›가 남으면 "왜 안 눌리지"가 된다 */}
      {!disabled && <ChevronRight size={17} color={theme.textFaint} />}
    </button>
  );
}


const styles = `
.tablign-choice {
  box-sizing: border-box;
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 13px 15px; border-radius: 13px;
  border: 1px solid ${theme.border}; background: ${theme.surface};
  box-shadow: 0 1px 3px rgba(20,30,60,.04);
  cursor: pointer; font: inherit; text-align: left;
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.tablign-choice:hover:not(:disabled) {
  border-color: #c9d4ff;
  box-shadow: 0 7px 20px rgba(59,91,219,.15);
  transform: translateY(-1px);
}
.tablign-choice:focus-visible {
  outline: 2px solid ${theme.accent}; outline-offset: 2px;
}
.tablign-choice:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
/* 색은 카드마다 달라 인라인(TONES)에서 준다. 여기서는 형태만 잡는다 —
   background/color를 여기에 두면 인라인 tone과 싸운다. 호버 신호는 카드 쪽이 담당한다. */
.tablign-choice-icon {
  box-sizing: border-box;
  width: 34px; height: 34px; flex: none; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  transition: background-color .15s, color .15s, box-shadow .15s;
}
@media (prefers-reduced-motion: reduce) {
  .tablign-choice, .tablign-choice-icon { transition: none }
  .tablign-choice:hover:not(:disabled) { transform: none }
}
`;
