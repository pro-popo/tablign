import { supabase } from "./supabase";

/** chrome.identity가 돌려준 redirect URL에서 OAuth code 추출. 없으면 null. */
export function extractCodeFromRedirect(redirectUrl: string | undefined): string | null {
  if (!redirectUrl) return null;
  try {
    return new URL(redirectUrl).searchParams.get("code");
  } catch {
    return null;
  }
}

/**
 * 구글 로그인. chrome.identity.launchWebAuthFlow로 구글 인증 → Supabase PKCE 코드 교환.
 * 성공 시 undefined, 실패 시 사용자에게 보여줄 에러 메시지 반환.
 * 성공하면 세션이 chrome.storage에 저장되고 onAuthStateChange가 발화한다.
 */
export async function signInWithGoogle(): Promise<string | undefined> {
  const redirectTo = chrome.identity.getRedirectURL(); // https://<id>.chromiumapp.org/
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // 매번 계정 선택 + 동의 화면을 강제해 자동(무인증) 로그인을 막는다.
      queryParams: { prompt: "select_account consent" },
    },
  });
  if (error) return error.message;
  if (!data?.url) return "로그인 URL을 받지 못했습니다";

  let resultUrl: string | undefined;
  try {
    resultUrl = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
  } catch (e) {
    return e instanceof Error ? e.message : "구글 인증에 실패했습니다";
  }

  const code = extractCodeFromRedirect(resultUrl);
  if (!code) return "인증 코드를 받지 못했습니다";

  const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exErr) return exErr.message;
  return undefined;
}
