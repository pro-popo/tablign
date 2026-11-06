import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShareCodeDialog } from "../ShareCodeDialog";
import { setLocale } from "../i18n";

function noop() {}

describe("ShareCodeDialog", () => {
  afterEach(() => setLocale("ko"));

  it("영어로 그리면 만료일도 영어 날짜 형식으로 보인다", () => {
    setLocale("en");
    const expires = "2026-12-24T00:00:00Z";
    render(
      <ShareCodeDialog open collectionTitle="Docs" issued={{ code: "ABCD2345", expires_at: expires }}
        onIssue={noop} onRevoke={noop} onClose={noop} />,
    );
    expect(screen.getByText(new RegExp(new Date(expires).toLocaleDateString("en").replace(/\//g, "\\/")))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });

  it("한국어로 그리면 만료일이 한국어 날짜 형식으로 보인다", () => {
    const expires = "2026-12-24T00:00:00Z";
    render(
      <ShareCodeDialog open collectionTitle="자료" issued={{ code: "ABCD2345", expires_at: expires }}
        onIssue={noop} onRevoke={noop} onClose={noop} />,
    );
    expect(screen.getByText(new Date(expires).toLocaleDateString("ko"), { exact: false })).toBeInTheDocument();
  });

  it("issued가 없으면 만료 선택 화면을 보여주고 발급을 호출한다", () => {
    const onIssue = vi.fn();
    render(<ShareCodeDialog open collectionTitle="자료" issued={null} onIssue={onIssue} onRevoke={noop} onClose={noop} />);
    fireEvent.click(screen.getByRole("button", { name: /7일 코드 만들기/ }));
    expect(onIssue).toHaveBeenCalledWith(7);
    fireEvent.click(screen.getByRole("button", { name: /무기한 코드 만들기/ }));
    expect(onIssue).toHaveBeenCalledWith(null);
  });

  it("issued가 있으면 코드와 회수 버튼을 보여준다", () => {
    const onRevoke = vi.fn();
    render(
      <ShareCodeDialog open collectionTitle="자료" issued={{ code: "ABCD2345", expires_at: null }}
        onIssue={noop} onRevoke={onRevoke} onClose={noop} />,
    );
    expect(screen.getByText("ABCD2345")).toBeInTheDocument();
    expect(screen.getByText(/무기한/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /회수/ }));
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it("open=false면 렌더하지 않는다", () => {
    const { container } = render(
      <ShareCodeDialog open={false} collectionTitle="자료" issued={null} onIssue={noop} onRevoke={noop} onClose={noop} />,
    );
    expect(container.firstChild).toBeNull();
  });
  it("복사 버튼 클릭 시 클립보드에 쓰고 onCopied를 호출한다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const onCopied = vi.fn();
    render(
      <ShareCodeDialog open collectionTitle="자료" issued={{ code: "ABCD2345", expires_at: null }}
        onIssue={noop} onRevoke={noop} onClose={noop} onCopied={onCopied} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /복사/ }));
    expect(writeText).toHaveBeenCalledWith("ABCD2345");
    await vi.waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1));
  });
});
