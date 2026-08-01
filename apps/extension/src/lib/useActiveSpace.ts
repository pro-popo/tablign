import { useEffect, useState } from "react";

const KEY = "tablign.activeSpace";

/**
 * 활성 스페이스 id를 chrome.storage.local에 영속화한다.
 * 새 탭은 고정 URL(newtab.html)이라 URL 파라미터로는 새 탭/새로고침 간 유지가 안 되므로,
 * usePanelState와 동일하게 chrome.storage.local을 사용한다.
 * loaded는 저장소 읽기가 끝났는지 알려준다(읽기 전 첫 스페이스로 잘못 폴백하는 것을 막기 위함).
 *
 * useActiveOrg와 같은 이유로 화면 값과 저장 값을 분리한다:
 * - selectSpace: 사용자가 직접 고른(또는 방금 만든) 것 → 화면 + 저장
 * - showSpace:   로드 중 임시 폴백 → 화면만
 * 저장된 null은 복원 조건(typeof === "string")을 통과하지 못해 폴백이 영구화되므로,
 * selectSpace는 string만 받아 null을 저장할 경로 자체를 없앤다.
 */
export function useActiveSpace() {
  const [activeSpaceId, setActiveSpaceIdState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(KEY, (res) => {
      const v = res[KEY];
      if (typeof v === "string") setActiveSpaceIdState(v);
      setLoaded(true);
    });
  }, []);

  /** 사용자가 고른(또는 방금 만든) 스페이스 — 다음 새로고침에도 유지되어야 한다. */
  function selectSpace(id: string) {
    setActiveSpaceIdState(id);
    chrome.storage.local.set({ [KEY]: id });
  }

  /** 화면에만 반영. 저장값은 손대지 않아, 일시적 문제라면 다음 로드에 원래 스페이스로 돌아온다. */
  function showSpace(id: string | null) {
    setActiveSpaceIdState(id);
  }

  return { activeSpaceId, selectSpace, showSpace, loaded };
}
