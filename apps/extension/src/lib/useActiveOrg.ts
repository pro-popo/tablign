import { useEffect, useState } from "react";

const KEY = "tablign.activeOrg";

/**
 * 활성 조직 id를 chrome.storage.local에 영속화한다(useActiveSpace와 동일 패턴).
 *
 * 화면 값과 저장 값을 **의도적으로 분리**한다:
 * - selectOrg: 사용자가 직접 고른 것 → 화면 + 저장
 * - showOrg:   로드 중 임시 폴백 → 화면만
 *
 * 둘을 한 함수로 두면 조직 조회가 한 번 어긋난 순간의 폴백이 디스크에 박히고,
 * 저장된 null은 복원 조건(typeof === "string")을 통과하지 못해 영구히 개인 조직으로 떨어진다.
 * selectOrg가 string만 받는 것도 그래서다 — null을 저장할 경로 자체를 없앤다.
 */
export function useActiveOrg() {
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(KEY, (res) => {
      const v = res[KEY];
      if (typeof v === "string") setActiveOrgIdState(v);
      setLoaded(true);
    });
  }, []);

  /** 사용자가 고른 조직 — 다음 새로고침에도 유지되어야 한다. */
  function selectOrg(id: string) {
    setActiveOrgIdState(id);
    chrome.storage.local.set({ [KEY]: id });
  }

  /** 화면에만 반영. 저장값은 손대지 않아, 일시적 문제라면 다음 로드에 원래 조직으로 돌아온다. */
  function showOrg(id: string | null) {
    setActiveOrgIdState(id);
  }

  return { activeOrgId, selectOrg, showOrg, loaded };
}
