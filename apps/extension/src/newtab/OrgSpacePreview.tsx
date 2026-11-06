import type { Organization, Space } from "@tablign/core";
import { orgDisplayName, SpaceIcon, theme, useT } from "@tablign/ui";
import { OrgIconBox } from "./OrgIconBox";

const previewCss = `
.tbl-orgprev-sp { background: none; transition: background .12s ease }
.tbl-orgprev-sp:hover { background: ${theme.surface2} }
`;

/** 좁은 화면에서 다른 조직 아이콘에 올렸을 때 덮개에 띄우는 그 조직의 스페이스. 누르면 조직째 그 스페이스로 옮겨 간다. */
export function OrgSpacePreview({ org, spaces, onSelect }: { org: Organization; spaces: Space[]; onSelect: (spaceId: string) => void }) {
  const t = useT();
  return (
    <>
      <style>{previewCss}</style>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${theme.border}`, fontWeight: 700, fontSize: 13.5 }}>
        <OrgIconBox org={org} size={28} />
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{orgDisplayName(org, t)}</span>
      </div>
      <div style={{ padding: "12px 14px 4px", fontSize: 10, fontWeight: 700, color: theme.textFaint }}>{t.orgSpacePreview.spaces}</div>
      <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {spaces.length === 0 ? (
          <div style={{ padding: "7px 10px", color: theme.textFaint }}>{t.orgSpacePreview.empty}</div>
        ) : spaces.map((s) => (
          <button key={s.id} type="button" className="tbl-orgprev-sp" onClick={() => onSelect(s.id)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", color: theme.textSub }}>
            <SpaceIcon icon={s.icon} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}
