import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorGradientPicker } from "../ColorGradientPicker";

describe("ColorGradientPicker", () => {
  it("단색 값이면 색 핸들 하나, 그라데이션 토글 있음", () => {
    render(<ColorGradientPicker value="#748FFC" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "그라데이션" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "시작 색" })).not.toBeInTheDocument();
  });

  it("그라데이션으로 토글하면 시작·끝 핸들이 나오고 onChange가 그라데이션 문자열을 emit", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="#748FFC" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "그라데이션" }));
    expect(screen.getByRole("button", { name: "시작 색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "끝 색" })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^linear-gradient\(135deg,/));
  });

  it("핸들 탭하면 팔레트(HEX 입력) 팝오버가 열린다", () => {
    render(<ColorGradientPicker value="#748FFC" onChange={() => {}} />);
    expect(screen.queryByDisplayValue("#748FFC")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "색" }));
    expect(screen.getByDisplayValue("#748FFC")).toBeInTheDocument();
  });

  it("그라데이션에서 끝 색을 바꾸면 그 색이 emit된다", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "끝 색" }));
    const hexInput = screen.getByDisplayValue("#9775FA");
    fireEvent.change(hexInput, { target: { value: "#FF0000" } });
    expect(onChange).toHaveBeenCalledWith("linear-gradient(135deg, #748FFC, #FF0000)");
  });

  it("스왑 버튼이 시작·끝 색을 맞바꾼다", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "시작 끝 색 교환" }));
    expect(onChange).toHaveBeenCalledWith("linear-gradient(135deg, #9775FA, #748FFC)");
  });

  it("마운트 후 부모가 value를 외부에서 바꾸면 그 값을 반영한다", () => {
    const { rerender } = render(<ColorGradientPicker value="#748FFC" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "색" })).toBeInTheDocument();
    rerender(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "시작 색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "끝 색" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "색" })).not.toBeInTheDocument();
  });
});
