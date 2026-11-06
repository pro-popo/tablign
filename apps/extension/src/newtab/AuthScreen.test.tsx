import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { setLocale } from "@tablign/ui";
import { AuthScreen } from "./AuthScreen";

// 구글 헬퍼 모킹
const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/oauth", () => ({ signInWithGoogle: (...a: unknown[]) => signInWithGoogle(...a) }));

beforeEach(() => { signInWithGoogle.mockClear(); });

describe("AuthScreen", () => {
  it("구글 버튼 클릭 시 signInWithGoogle 호출", async () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Google/ }));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
  });

  it("로그인 실패 시 에러 메시지를 표시", async () => {
    signInWithGoogle.mockResolvedValueOnce("로그인 실패");
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Google/ }));
    expect(await screen.findByText("로그인 실패")).toBeTruthy();
  });

  describe("언어", () => {
    afterEach(() => setLocale("ko"));

    it("영어로 그리면 영어 문구가 보인다", () => {
      setLocale("en");
      render(<AuthScreen />);
      expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The tidiest way to sort your tabs.");
    });

    it("로그인 화면엔 언어 전환이 없다", () => {
      render(<AuthScreen />);
      expect(screen.queryByRole("button", { name: "English" })).toBeNull();
    });
  });
});
