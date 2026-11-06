import "@testing-library/jest-dom/vitest";
import { setLocale } from "../i18n";

// jsdom 브라우저 언어는 en-US — 기존 테스트가 한국어 문구로 요소를 찾으므로 고정한다
setLocale("ko");
