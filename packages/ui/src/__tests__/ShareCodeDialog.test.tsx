import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShareCodeDialog } from "../ShareCodeDialog";

function noop() {}

describe("ShareCodeDialog", () => {
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
});
