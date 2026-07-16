import { useEffect, useState } from "react";

const KEY = "tablign.activeOrg";

// 활성 조직 id를 chrome.storage.local에 영속화한다(useActiveSpace와 동일 패턴).
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

  function setActiveOrgId(id: string | null) {
    setActiveOrgIdState(id);
    chrome.storage.local.set({ [KEY]: id });
  }

  return { activeOrgId, setActiveOrgId, loaded };
}
