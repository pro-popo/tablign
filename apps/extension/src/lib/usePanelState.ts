import {
  usePanelState as useShared,
  isPanelState,
  PANEL_STATE_KEY,
  type PanelStateStorage,
} from "@tablign/ui";

const adapter: PanelStateStorage = {
  read: (cb) => {
    chrome.storage.local.get(PANEL_STATE_KEY, (res) => {
      const v = res[PANEL_STATE_KEY];
      cb(isPanelState(v) ? v : null);
    });
  },
  write: (state) => {
    chrome.storage.local.set({ [PANEL_STATE_KEY]: state });
  },
};

export function usePanelState() {
  return useShared(adapter);
}
