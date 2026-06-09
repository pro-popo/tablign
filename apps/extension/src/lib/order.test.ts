import { describe, expect, it } from "vitest";
import { placeInOrder, sequentialPositions } from "./order";

describe("placeInOrder", () => {
  it("새 항목을 특정 항목 앞에 삽입한다", () => {
    expect(placeInOrder(["a", "b", "c"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("beforeLinkId가 null이면 맨 끝에 삽입한다", () => {
    expect(placeInOrder(["a", "b", "c"], "d", null)).toEqual(["a", "b", "c", "d"]);
  });

  it("같은 목록 내 재정렬: 자기 자신을 제거하고 대상 앞으로 옮긴다", () => {
    expect(placeInOrder(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });

  it("알 수 없는 beforeLinkId는 맨 끝", () => {
    expect(placeInOrder(["a", "b"], "c", "zzz")).toEqual(["a", "b", "c"]);
  });
});

describe("sequentialPositions", () => {
  it("순서 인덱스에 1000 간격 position을 부여한다", () => {
    expect(sequentialPositions(["a", "b", "c"])).toEqual([
      { id: "a", position: 1000 },
      { id: "b", position: 2000 },
      { id: "c", position: 3000 },
    ]);
  });
});
