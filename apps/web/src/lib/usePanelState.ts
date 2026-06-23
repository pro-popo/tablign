"use client";

import {
  usePanelState as useShared,
  PANEL_STATE_KEY,
  type PanelState,
  type PanelStateStorage,
} from "@tablign/ui";

const DEFAULT: PanelState = { left: true, right: true };

export function readPanelState(storage: Pick<Storage, "getItem">): PanelState {
  try {
    const raw = storage.getItem(PANEL_STATE_KEY);
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
    storage.setItem(PANEL_STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

const adapter: PanelStateStorage = {
  read: (cb) => cb(readPanelState(window.localStorage)),
  write: (state) => writePanelState(window.localStorage, state),
};

export function usePanelState() {
  return useShared(adapter);
}

export type { PanelState };
