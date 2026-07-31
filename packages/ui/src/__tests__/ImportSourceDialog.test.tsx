import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportSourceDialog } from "../ImportSourceDialog";

function noop() {}

describe("ImportSourceDialog", () => {
  it("두 소스를 보여주고 북마크를 고르면 onBookmarks를 호출한다", () => {
    const onBookmarks = vi.fn();
    render(<ImportSourceDialog open onBookmarks={onBookmarks} onTobyFile={noop} onClose={noop} />);
    fireEvent.click(screen.getByRole("button", { name: /Chrome 북마크/ }));
    expect(onBookmarks).toHaveBeenCalledTimes(1);
  });

  it("Toby 파일을 고르면 파일 텍스트로 onTobyFile을 호출한다", async () => {
    const onTobyFile = vi.fn();
    render(<ImportSourceDialog open onBookmarks={noop} onTobyFile={onTobyFile} onClose={noop} />);

    const json = JSON.stringify({ version: 4, groups: [] });
    const file = new File([json], "Huray-export.json", { type: "application/json" });
    fireEvent.change(screen.getByTestId("toby-file-input"), { target: { files: [file] } });

    await waitFor(() => expect(onTobyFile).toHaveBeenCalledWith(json));
  });

  it("open이 false면 아무것도 그리지 않는다", () => {
    const { container } = render(
      <ImportSourceDialog open={false} onBookmarks={noop} onTobyFile={noop} onClose={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
