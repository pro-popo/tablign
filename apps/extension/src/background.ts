// 팝업을 제거했으므로, 확장 아이콘 클릭 시 빈 새 탭을 연다.
// 새 탭은 manifest의 chrome_url_overrides.newtab 덕분에 메인 화면(newtab.html)으로 렌더된다.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({});
});
