"use client";

import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { ReactNode } from "react";

export interface BoardDndProps {
  children: ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
}

export function BoardDnd({ children, onDragEnd }: BoardDndProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}
