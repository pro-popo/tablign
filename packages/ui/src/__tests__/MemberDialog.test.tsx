import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemberDialog } from "../MemberDialog";

const members = [
  { user_id: "e1", role: "editor" as const, display_name: "에디터", avatar_url: null },
  { user_id: "v1", role: "viewer" as const, display_name: "뷰어", avatar_url: null },
];
function noop() {}

describe("MemberDialog", () => {
  it("멤버·대기 초대 목록을 보여준다", () => {
    render(<MemberDialog open spaceName="스터디" members={members} pendingInvites={[{ id: "i1", invitee_email: "p@x.com", role: "viewer" }]}
      onInvite={noop} onChangeRole={noop} onRemove={noop} onCancelInvite={noop} onClose={noop} />);
    expect(screen.getByText("에디터")).toBeInTheDocument();
    expect(screen.getByText("뷰어")).toBeInTheDocument();
    expect(screen.getByText("p@x.com")).toBeInTheDocument();
  });

  it("이메일 입력 후 초대하면 onInvite를 호출한다", () => {
    const onInvite = vi.fn();
    render(<MemberDialog open spaceName="스터디" members={[]} pendingInvites={[]}
      onInvite={onInvite} onChangeRole={noop} onRemove={noop} onCancelInvite={noop} onClose={noop} />);
    fireEvent.change(screen.getByPlaceholderText(/이메일/), { target: { value: "new@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: /초대/ }));
    expect(onInvite).toHaveBeenCalledWith("new@x.com", "editor");
  });

  it("멤버 제거 버튼이 onRemove를 호출한다", () => {
    const onRemove = vi.fn();
    render(<MemberDialog open spaceName="스터디" members={members} pendingInvites={[]}
      onInvite={noop} onChangeRole={noop} onRemove={onRemove} onCancelInvite={noop} onClose={noop} />);
    fireEvent.click(screen.getAllByRole("button", { name: "멤버 제거" })[0]);
    expect(onRemove).toHaveBeenCalledWith("e1");
  });

  it("open=false면 렌더하지 않는다", () => {
    const { container } = render(<MemberDialog open={false} spaceName="s" members={[]} pendingInvites={[]}
      onInvite={noop} onChangeRole={noop} onRemove={noop} onCancelInvite={noop} onClose={noop} />);
    expect(container.firstChild).toBeNull();
  });
});
