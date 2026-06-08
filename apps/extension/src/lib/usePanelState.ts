import { useEffect, useState } from "react";

export interface PanelState { left: boolean; right: boolean }
const KEY = "tablign.panels";
const DEFAULT: PanelState = { left: true, right: true };

export function usePanelState() {
  const [state, setState] = useState<PanelState>(DEFAULT);

  useEffect(() => {
    chrome.storage.local.get(KEY, (res) => {
      const v = res[KEY];
      if (v && typeof v.left === "boolean" && typeof v.right === "boolean") setState(v);
    });
  }, []);

  function toggle(key: keyof PanelState) {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      chrome.storage.local.set({ [KEY]: next });
      return next;
    });
  }

  return { state, toggleLeft: () => toggle("left"), toggleRight: () => toggle("right") };
}
