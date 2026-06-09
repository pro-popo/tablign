import { useDroppable, useDndContext } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LinkCard, theme } from "@tablign/ui";
import type { Link } from "@tablign/core";

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 9,
  minHeight: 48,
};

function SortableCard({
  link, onOpen, onDelete, onUpdate,
}: {
  link: Link;
  onOpen: (url: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: { custom_title: string | null; url: string; note: string | null }) => void;
}) {
  const isPlaceholder = link.id.startsWith("__");
  const { active } = useDndContext();
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: link.id,
    data: { kind: "link", link },
  });
  const style: React.CSSProperties = {
    // 드래그 중인 카드/자리표시 카드는 슬롯에 고정(transform 억제)하고 주변 카드만 슬라이드시킨다.
    // → 저장 탭 이동과 열린 탭 삽입의 애니메이션을 동일하게 통일. 커서 추적은 DragOverlay가 담당.
    transform: isDragging || isPlaceholder ? undefined : CSS.Translate.toString(transform),
    transition,
    opacity: isDragging || isPlaceholder ? 0.5 : 1,
    cursor: "grab",
    pointerEvents: isPlaceholder ? "none" : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LinkCard link={link} onOpen={onOpen} onDelete={onDelete} onUpdate={onUpdate} dragging={!!active} />
    </div>
  );
}

export interface DndLinkListProps {
  collectionId: string;
  links: Link[];
  onOpenLink: (url: string) => void;
  onDeleteLink: (id: string) => void;
  onUpdateLink: (id: string, patch: { custom_title: string | null; url: string; note: string | null }) => void;
}

export function DndLinkList({ collectionId, links, onOpenLink, onDeleteLink, onUpdateLink }: DndLinkListProps) {
  // 빈 컬렉션에도 드롭할 수 있도록 컨테이너 자체를 droppable로. (강조 점선은 CollectionSection이 담당)
  const { setNodeRef } = useDroppable({ id: `container:${collectionId}`, data: { kind: "container", collectionId } });
  return (
    <SortableContext items={links.map((l) => l.id)} strategy={rectSortingStrategy}>
      <div ref={setNodeRef} style={GRID}>
        {links.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", minHeight: 72, border: `1.5px dashed ${theme.border}`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textFaint, fontSize: 12 }}>
            여기로 탭을 드래그해 추가하세요
          </div>
        ) : (
          links.map((l) => (
            <SortableCard key={l.id} link={l} onOpen={onOpenLink} onDelete={onDeleteLink} onUpdate={onUpdateLink} />
          ))
        )}
      </div>
    </SortableContext>
  );
}
