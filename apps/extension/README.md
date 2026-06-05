# tablign 크롬 확장

## 개발 빌드 & 로드

1. 로컬 Supabase 실행: `pnpm dlx supabase start`
2. 빌드: `pnpm --filter @tablign/extension build`
3. 크롬에서 `chrome://extensions` → "개발자 모드" 켜기 → "압축해제된 확장 프로그램을 로드합니다" → `apps/extension/dist` 선택.
4. 확장 아이콘 클릭 → 팝업에서 이메일/비밀번호로 로그인(웹 앱과 동일 계정).
5. "현재 탭 저장": 컬렉션 선택 후 버튼 → 현재 탭이 그 컬렉션에 저장됨.
6. "모든 탭을 새 컬렉션으로": 이름 입력 → 창의 모든 http(s) 탭이 새 컬렉션에 저장됨.
7. 새 탭 열기 → 첫 스페이스의 컬렉션·링크가 보드로 표시됨. 링크 클릭 시 열림, "↗"로 컬렉션 전체 열기.

## 주의
- 코드 변경 후에는 다시 `build` 하고 `chrome://extensions`에서 새로고침(↻).
- 로컬 키는 `apps/extension/.env`에 있음(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). 클라우드 배포 시 매니페스트의 `host_permissions`와 `.env`를 클라우드 URL로 교체.
