import { useEffect, useRef, useState } from "react";
import type { Organization } from "@tablign/core";
import { theme } from "@tablign/ui";
import { OrgIconBox } from "./OrgIconBox";

export type OrgRole = "owner" | "admin" | "member";

export interface OrgHeaderProps {
  org: Organization;
  myRole: OrgRole;
  onOpenMembers: () => void;
  onEditOrg?: () => void;
  onDeleteOrg?: () => void;
  /** 주면 메뉴에 '북마크 가져오기'를 노출한다(삭제 바로 위) */
  onImport?: () => void;
}

export function OrgHeader({ org, myRole, onOpenMembers, onEditOrg, onDeleteOrg, onImport }: OrgHeaderProps) {
  const isPersonal = org.is_personal;
  // 멤버는 조직 관리 권한이 없어 메뉴를 열 수 없으므로 톱니바퀴를 숨긴다.
  // 개인 조직은 프로필 설정(onEditOrg)이 있으면 톱니를 노출한다(멤버 개념이 없어 myRole 판정은 무의미).
  const showGear = isPersonal ? !!onEditOrg : myRole !== "member";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMenuOpen(false); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const menuItem: React.CSSProperties = {
    display: "flex", alignItems: "center", width: "100%", textAlign: "left", border: "none", background: "none",
    padding: "9px 12px", fontSize: 13, color: theme.text, cursor: "pointer", whiteSpace: "nowrap", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <OrgIconBox org={org} size={28} />
      <strong style={{ fontSize: 15, color: theme.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org.name}</strong>
      {showGear && (
        <div ref={menuWrapRef} style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}>
          <button type="button" title="조직 관리" aria-label="조직 관리" aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, color: menuOpen ? "#868e96" : theme.textFaint }}>
            {/* lucide settings(톱니) */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          {menuOpen && (
            <div role="menu"
              style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, minWidth: 148,
                background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 4,
                boxShadow: "0 12px 32px rgba(20,30,60,.18)", boxSizing: "border-box" }}>
              {/* 범위가 좁아지는 순서: 조직 자체 → 사람 → 데이터.
                  가져오기는 사실상 1회성이라 자주 쓰는 항목 뒤에 둔다. */}
              {onEditOrg && (
                <button type="button" role="menuitem" style={menuItem}
                  onClick={() => { setMenuOpen(false); onEditOrg(); }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f3f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>프로필 설정</button>
              )}
              {!isPersonal && (
                <button type="button" role="menuitem" style={menuItem}
                  onClick={() => { setMenuOpen(false); onOpenMembers(); }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f3f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>멤버 관리</button>
              )}
              {onImport && (
                <button type="button" role="menuitem" style={menuItem}
                  onClick={() => { setMenuOpen(false); onImport(); }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f3f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>북마크 가져오기</button>
              )}
              {/* 되돌릴 수 없는 항목은 구분선으로 떼어낸다 — 색만으로는 오조작을 막지 못한다 */}
              {onDeleteOrg && (
                <div role="separator" style={{ height: 1, margin: "4px 0", background: theme.border }} />
              )}
              {onDeleteOrg && (
                <button type="button" role="menuitem" style={{ ...menuItem, color: "#e03131" }}
                  onClick={() => { setMenuOpen(false); onDeleteOrg(); }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fff5f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>조직 삭제</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
