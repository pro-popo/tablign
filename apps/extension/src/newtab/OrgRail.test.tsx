import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrgRail } from "./OrgRail";

function renderRail(invitationCount: number) {
  return render(
    <OrgRail organizations={[]} memberships={[]} activeOrgId={null} userEmail="u1@test.local" currentUserId="u1"
      onSelectOrg={() => {}} onCreateOrg={() => {}} onSignOut={() => {}}
      invitationCount={invitationCount} invitations={<div>초대 목록</div>} />,
  );
}

describe("OrgRail — 받은 초대함", () => {
  it("받은 초대가 없으면 개수 없이 '받은 초대'로 보인다", () => {
    renderRail(0);
    expect(screen.getByRole("button", { name: "받은 초대" })).toBeInTheDocument();
  });

  it("누르면 받은 초대 목록이 뜨고, 바깥을 누르면 닫힌다", () => {
    renderRail(2);
    fireEvent.click(screen.getByRole("button", { name: "받은 초대 2개" }));
    expect(screen.getByRole("dialog", { name: "받은 초대" })).toHaveTextContent("초대 목록");

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "받은 초대" })).not.toBeInTheDocument();
  });

  it("Esc로 닫힌다", () => {
    renderRail(1);
    fireEvent.click(screen.getByRole("button", { name: "받은 초대 1개" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "받은 초대" })).not.toBeInTheDocument();
  });
});
