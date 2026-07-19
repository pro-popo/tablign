import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InvitationList } from "../InvitationList";

const roles = [{ value: "editor", label: "편집자" }, { value: "viewer", label: "뷰어" }];

describe("InvitationList", () => {
  it("초대 항목과 수락/거절 버튼을 보여주고 콜백을 호출한다", () => {
    const onAccept = vi.fn(), onDecline = vi.fn();
    render(<InvitationList invitations={[{ id: "i1", space_name: "스터디", inviter_name: "앨리스", role: "viewer" }]} roles={roles}
      onAccept={onAccept} onDecline={onDecline} />);
    expect(screen.getByText(/스터디/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수락" }));
    expect(onAccept).toHaveBeenCalledWith("i1");
    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    expect(onDecline).toHaveBeenCalledWith("i1");
  });

  it("초대가 없으면 안내 문구를 보여준다", () => {
    render(<InvitationList invitations={[]} roles={roles} onAccept={() => {}} onDecline={() => {}} />);
    expect(screen.getByText(/받은 초대가 없어요/)).toBeInTheDocument();
  });
});
