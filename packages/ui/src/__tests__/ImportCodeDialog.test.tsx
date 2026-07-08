import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportCodeDialog } from "../ImportCodeDialog";

const spaces = [{ id: "s1", name: "개인", icon: null }];
function noop() {}

describe("ImportCodeDialog", () => {
  it("코드 조회 후 미리보기와 스페이스 선택을 보여주고 가져오기를 호출한다", async () => {
    const onLookup = vi.fn().mockResolvedValue({ title: "공유 자료", icon: null, link_count: 3, shared_by: "앨리스" });
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<ImportCodeDialog open spaces={spaces} onLookup={onLookup} onImport={onImport} onClose={noop} />);

    fireEvent.change(screen.getByPlaceholderText(/공유 코드/), { target: { value: "abcd2345" } });
    fireEvent.click(screen.getByRole("button", { name: /조회/ }));
    expect(onLookup).toHaveBeenCalledWith("ABCD2345"); // 대문자 정규화

    expect(await screen.findByText("공유 자료")).toBeInTheDocument();
    expect(screen.getByText(/링크 3개/)).toBeInTheDocument();
    expect(screen.getByText(/앨리스/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("개인"));
    fireEvent.click(screen.getByRole("button", { name: /가져오기/ }));
    await waitFor(() => expect(onImport).toHaveBeenCalledWith("ABCD2345", "s1"));
  });

  it("조회 실패 시 에러 메시지를 보여준다", async () => {
    const onLookup = vi.fn().mockRejectedValue(new Error("not found"));
    render(<ImportCodeDialog open spaces={spaces} onLookup={onLookup} onImport={vi.fn()} onClose={noop} />);
    fireEvent.change(screen.getByPlaceholderText(/공유 코드/), { target: { value: "BADBAD22" } });
    fireEvent.click(screen.getByRole("button", { name: /조회/ }));
    expect(await screen.findByText(/찾을 수 없거나 만료된 코드/)).toBeInTheDocument();
  });
});
