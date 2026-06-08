"use client";

import { useEffect, useState } from "react";

export interface PanelState {
  left: boolean;
  right: boolean;
}

const KEY = "tablign.panels";
const DEFAULT: PanelState = { left: true, right: true };

export function readPanelState(storage: Pick<Storage, "getItem">): PanelState {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.left === "boolean" && typeof parsed?.right === "boolean") {
      return { left: parsed.left, right: parsed.right };
    }
    return DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function writePanelState(storage: Pick<Storage, "setItem">, state: PanelState): void {
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function usePanelState() {
  const [state, setState] = useState<PanelState>(DEFAULT);

  useEffect(() => {
    setState(readPanelState(window.localStorage));
  }, []);

  function toggle(key: keyof PanelState) {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writePanelState(window.localStorage, next);
      return next;
    });
  }

  return { state, toggleLeft: () => toggle("left"), toggleRight: () => toggle("right") };
}
