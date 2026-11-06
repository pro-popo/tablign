import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectLocale, getLocale, getT, LOCALE_KEY, orgDisplayName, setLocale, useT } from "../i18n";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";

describe("detectLocale", () => {
  it.each([
    [null, ["en-US", "ko"], "en"],
    [null, ["ja", "ko-KR"], "ko"],
    [null, ["ja", "fr"], "en"],
    [null, [], "en"],
    ["ko", ["en-US"], "ko"],
    ["en", ["ko"], "en"],
    ["xx", ["ko"], "ko"],
  ])("저장 %s · 브라우저 %j → %s", (stored, langs, want) => {
    expect(detectLocale(stored as string | null, langs as string[])).toBe(want);
  });
});

describe("setLocale", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(LOCALE_KEY);
    setLocale("ko");
  });

  it("저장하고 <html lang>을 바꾸고, useT를 쓰는 화면이 바로 다시 그려진다", () => {
    function Probe() {
      return <span>{useT().common.cancel}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("취소")).toBeInTheDocument();
    act(() => setLocale("en"));
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(localStorage.getItem(LOCALE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(getT().common.cancel).toBe("Cancel");
  });

  it("다른 탭에서 언어를 바꾸면 이 탭도 바로 따라간다", () => {
    function Probe() {
      return <span>{useT().common.cancel}</span>;
    }
    render(<Probe />);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: LOCALE_KEY, newValue: "en" }));
    });
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(getLocale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("다른 탭의 이상한 값이나 다른 키는 무시한다", () => {
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: LOCALE_KEY, newValue: "xx" }));
      window.dispatchEvent(new StorageEvent("storage", { key: "tablign.theme", newValue: "en" }));
    });
    expect(getLocale()).toBe("ko");
  });

  it("저장소가 막혀 있어도 언어는 바뀐다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => setLocale("en")).not.toThrow();
    expect(getLocale()).toBe("en");
  });

  it("처음 불러올 때 저장된 언어로 시작한다", async () => {
    localStorage.setItem(LOCALE_KEY, "en");
    vi.resetModules();
    const fresh = await import("../i18n");
    expect(fresh.getLocale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("저장소 읽기가 막혀 있어도 불러올 수 있다", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.resetModules();
    const fresh = await import("../i18n");
    expect(["ko", "en"]).toContain(fresh.getLocale());
  });
});

describe("orgDisplayName", () => {
  it("개인 조직 이름이 기본값이면 사전 값, 바꿨으면 그대로", () => {
    expect(orgDisplayName({ name: "개인", is_personal: true }, en)).toBe("Personal");
    expect(orgDisplayName({ name: "개인", is_personal: true }, ko)).toBe("개인");
    expect(orgDisplayName({ name: "내 공간", is_personal: true }, en)).toBe("내 공간");
    expect(orgDisplayName({ name: "개인", is_personal: false }, en)).toBe("개인");
  });
});
