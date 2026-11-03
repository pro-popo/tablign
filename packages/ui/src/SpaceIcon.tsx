import { theme } from "./theme";

/** 스페이스 아이콘. 고르지 않은 스페이스는 흐린 폴더로 표시한다. 사이드바·이동/복사 메뉴 공통. */
export function SpaceIcon({ icon }: { icon: string | null | undefined }) {
  return (
    <span style={{ width: 18, flex: "none", textAlign: "center", fontFamily: theme.iconFont, fontSize: 15, lineHeight: "18px", opacity: icon ? 1 : 0.45 }}>
      {icon ?? "📁"}
    </span>
  );
}
