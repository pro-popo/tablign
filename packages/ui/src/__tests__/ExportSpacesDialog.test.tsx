import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExportSpacesDialog } from "../ExportSpacesDialog";

const spaces = [
  { id: "s1", name: "개발", icon: "💻" },
  { id: "s2", name: "개인", icon: null },
  { id: "s3", name: "디자인 리뷰", icon: null, shared: true },
];

function noop() {}

describe("ExportSpacesDialog", () => {
  it("열리면 전체가 선택되어 있고 개수가 버튼에 나온다", () => {
    render(<ExportSpacesDialog open spaces={spaces} onExport={vi.fn()} onClose={noop} />);
    expect(screen.getByRole("checkbox", { name: "전체 선택" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3개 내보내기" })).toBeEnabled();
    expect(screen.getByText("아이콘·메모·비공개 설정은 담기지 않아요")).toBeInTheDocument();
  });

  it("공유 스페이스는 따로 묶어 보여 준다", () => {
    render(<ExportSpacesDialog open spaces={spaces} onExport={vi.fn()} onClose={noop} />);
    expect(screen.getByText("공유 스페이스")).toBeInTheDocument();
  });

  it("전체 선택을 끄면 0개가 되고 버튼이 잠긴다", () => {
    render(<ExportSpacesDialog open spaces={spaces} onExport={vi.fn()} onClose={noop} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "전체 선택" }));
    expect(screen.getByText("0 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내보내기" })).toBeDisabled();
  });

  it("줄을 눌러 빼면 남은 스페이스만 목록 순서대로 onExport에 넘긴다", async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    render(<ExportSpacesDialog open spaces={spaces} onExport={onExport} onClose={noop} />);
    fireEvent.click(screen.getByText("개인"));
    expect(screen.getByRole("checkbox", { name: "전체 선택" })).toHaveAttribute("aria-checked", "mixed");
    fireEvent.click(screen.getByRole("button", { name: "2개 내보내기" }));
    await waitFor(() => expect(onExport).toHaveBeenCalledWith(["s1", "s3"]));
  });

  it("내보내기에 실패하면 안내하고 다시 누를 수 있다", async () => {
    const onExport = vi.fn().mockRejectedValue(new Error("network"));
    render(<ExportSpacesDialog open spaces={spaces} onExport={onExport} onClose={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "3개 내보내기" }));
    expect(await screen.findByText("내보내지 못했어요. 다시 시도해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3개 내보내기" })).toBeEnabled();
  });

  it("open이 false면 아무것도 그리지 않는다", () => {
    const { container } = render(<ExportSpacesDialog open={false} spaces={spaces} onExport={vi.fn()} onClose={noop} />);
    expect(container).toBeEmptyDOMElement();
  });
});
