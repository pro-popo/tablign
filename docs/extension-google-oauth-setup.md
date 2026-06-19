# 확장 프로그램 구글 로그인 설정

확장 프로그램의 "Google로 계속" 버튼은 아래 설정이 끝나야 동작한다.
(이메일/비밀번호·회원가입은 설정 없이 바로 동작한다.)

## 1. 확장 ID 확인 (redirect URL)
1. `pnpm --filter @tablign/extension build`
2. Chrome `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램 로드" → `apps/extension/dist` 선택
3. 표시된 **확장 ID**를 복사. redirect URL은 `https://<확장ID>.chromiumapp.org/` 이다.
   - (참고: 확장 화면 콘솔에서 `chrome.identity.getRedirectURL()`로도 확인 가능)

> 확장 ID를 고정하려면 `public/manifest.json`에 `"key"` 필드를 추가한다(선택).
> 키 생성: `openssl genrsa 2048 | openssl rsa -pubout -outform DER | openssl base64 -A`
> 결과 문자열을 manifest의 `"key"`로 넣으면 ID가 고정된다. (안 넣으면 dist 재로드 시 ID가
> 유지되긴 하나, 다른 PC/프로필에선 달라질 수 있다.)

## 2. Google Cloud Console
1. https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보
2. "OAuth 클라이언트 ID 만들기" → 애플리케이션 유형: **웹 애플리케이션**
3. **승인된 리디렉션 URI**에 추가: `http://127.0.0.1:54321/auth/v1/callback`
4. 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀** 복사

## 3. 환경 변수 (Supabase가 읽음)
`supabase/` 작업 디렉터리에서 셸 환경 또는 `.env`에 설정:

    SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<클라이언트 ID>
    SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<클라이언트 보안 비밀>

## 4. config.toml의 redirect 치환
`supabase/config.toml`의 `additional_redirect_urls`에 있는 `<EXTENSION_ID>`를 1단계의 확장 ID로 치환.

## 5. Supabase 재기동

    supabase stop
    supabase start

## 6. 검증
확장 새 탭 → "Google로 계속" → 구글 로그인 창 → 완료 후 보드가 뜨면 성공.
