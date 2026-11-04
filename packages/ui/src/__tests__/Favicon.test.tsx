import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Favicon } from "../Favicon";

describe("Favicon", () => {
  it("아이콘을 받아오는 동안엔 지구본을 보여 주고, 다 받으면 아이콘으로 바꾼다", () => {
    const { container } = render(<Favicon url="https://dev.example.test/favicon.ico" />);
    const img = container.querySelector("img")!;
    // 응답이 없는 사내 주소처럼 끝나지 않는 요청 — 빈칸 대신 지구본
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(img).not.toBeVisible();

    fireEvent.load(img);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(img).toBeVisible();
  });

  it("받아오지 못하면 지구본만 남는다", () => {
    const { container } = render(<Favicon url="https://dev.example.test/favicon.ico" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
