import { useEffect, useState } from "react";

const KEY = "tablign.activeSpace";

// 활성 스페이스 id를 chrome.storage.local에 영속화한다.
// 새 탭은 고정 URL(newtab.html)이라 URL 파라미터로는 새 탭/새로고침 간 유지가 안 되므로,
// usePanelState와 동일하게 chrome.storage.local을 사용한다.
// loaded는 저장소 읽기가 끝났는지 알려준다(읽기 전 첫 스페이스로 잘못 폴백하는 것을 막기 위함).
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

  function setActiveSpaceId(id: string | null) {
    setActiveSpaceIdState(id);
    chrome.storage.local.set({ [KEY]: id });
  }

  return { activeSpaceId, setActiveSpaceId, loaded };
}
