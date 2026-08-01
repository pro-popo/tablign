/** 탭으로 열 수 있는 주소만 가져온다. 북마클릿(javascript:)·chrome:// 등은 제외. */
export function isImportableUrl(raw: string): boolean {
  try {
    const p = new URL(raw).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
}

/**
 * Chrome 북마크 API는 파비콘을 주지 않는다. 대부분의 사이트가 origin 루트에
 * favicon.ico를 두고, 없는 사이트는 Favicon 컴포넌트의 onError가 지구본으로 떨어뜨린다.
 */
export function faviconFor(raw: string): string | null {
  if (!isImportableUrl(raw)) return null;
  try {
    return new URL(raw).origin + "/favicon.ico";
  } catch {
    return null;
  }
}
