import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TossEmojiPicker } from "./TossEmojiPicker";

vi.mock("./tossEmoji", () => ({
  buildTossCategories: () => [
    { id: "people", label: "스마일리 & 사람", tab: "😀", items: [
      { native: "😀", name: "Grinning", search: "smile happy grinning" },
      { native: "😅", name: "Sweat Smile", search: "sweat grin" },
    ] },
    { id: "nature", label: "동물 & 자연", tab: "🐻", items: [
      { native: "🐶", name: "Dog", search: "dog puppy" },
    ] },
  ],
}));

describe("TossEmojiPicker", () => {
  it("카테고리 라벨과 이모지를 렌더한다", () => {
    render(<TossEmojiPicker onSelect={() => {}} />);
    expect(screen.getByText("스마일리 & 사람")).toBeInTheDocument();
    expect(screen.getByText("동물 & 자연")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dog" })).toBeInTheDocument();
  });

  it("이모지를 누르면 onSelect에 native가 전달된다", () => {
    const onSelect = vi.fn();
    render(<TossEmojiPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Dog" }));
    expect(onSelect).toHaveBeenCalledWith("🐶");
  });

  it("검색어로 필터한다", () => {
    render(<TossEmojiPicker onSelect={() => {}} />);
    fireEvent.change(screen.getByLabelText("이모지 검색"), { target: { value: "dog" } });
    expect(screen.getByRole("button", { name: "Dog" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grinning" })).not.toBeInTheDocument();
  });

  it("결과가 없으면 빈 상태를 보여준다", () => {
    render(<TossEmojiPicker onSelect={() => {}} />);
    fireEvent.change(screen.getByLabelText("이모지 검색"), { target: { value: "존재안함zzz" } });
    expect(screen.getByText("검색 결과가 없어요")).toBeInTheDocument();
  });

  it("이모지에 hover하면 하단 미리보기 이름이 갱신된다", () => {
    render(<TossEmojiPicker onSelect={() => {}} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Dog" }));
    expect(screen.getByTestId("toss-preview-name")).toHaveTextContent("Dog");
  });
});
