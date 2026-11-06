import { useSyncExternalStore } from "react";
import { en } from "./en";
import { ko, type Messages } from "./ko";

export type { Messages };
export type Locale = "ko" | "en";

export const LOCALE_KEY = "tablign.locale";
// 언어 이름은 늘 그 언어로 쓴다
export const LOCALE_NAMES: Record<Locale, string> = { ko: "한국어", en: "English" };

const DICTS: Record<Locale, Messages> = { ko, en };

const isLocale = (v: unknown): v is Locale => v === "ko" || v === "en";

/** 저장값 → 브라우저 선호 언어 중 ko·en으로 시작하는 첫 값 → en */
export function detectLocale(stored: string | null, languages: readonly string[]): Locale {
  if (isLocale(stored)) return stored;
  for (const lang of languages) {
    const base = lang.toLowerCase().slice(0, 2);
    if (isLocale(base)) return base;
  }
  return "en";
}

function readStored(): string | null {
  try {
    return localStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

function applyHtmlLang(l: Locale) {
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

let current: Locale = detectLocale(readStored(), browserLanguages());
applyHtmlLang(current);

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getLocale = (): Locale => current;
export const getT = (): Messages => DICTS[current];

export function setLocale(l: Locale): void {
  current = l;
  try {
    localStorage.setItem(LOCALE_KEY, l);
  } catch {
    // 저장소가 막혀 있으면 이번 세션에서만 바뀐다
  }
  applyHtmlLang(l);
  listeners.forEach((fn) => fn());
}

// 다른 tablign 탭에서 바꾼 언어를 따라간다(테마와 같은 방식). 바꾼 탭이 이미 저장했으니 다시 쓰지 않는다.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== LOCALE_KEY || !isLocale(e.newValue) || e.newValue === current) return;
    current = e.newValue;
    applyHtmlLang(current);
    listeners.forEach((fn) => fn());
  });
}

export const useLocale = (): Locale => useSyncExternalStore(subscribe, getLocale);
export const useT = (): Messages => DICTS[useLocale()];

/** 가입할 때 DB 트리거가 개인 조직에 넣는 이름 */
export const PERSONAL_ORG_DEFAULT_NAME = "개인";

/** 개인 조직의 기본 이름만 화면 언어로 바꿔 보여 준다. 사용자가 바꾼 이름은 그대로. */
export function orgDisplayName(org: { name: string; is_personal?: boolean | null }, t: Messages): string {
  return org.is_personal && org.name === PERSONAL_ORG_DEFAULT_NAME ? t.org.personal : org.name;
}
