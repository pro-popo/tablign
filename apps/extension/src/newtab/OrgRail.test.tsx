import { afterEach, describe, it, expect } from "vitest";
import type { Organization } from "@tablign/core";
import { setLocale } from "@tablign/ui";
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

describe("OrgRail — 설정", () => {
  it("설정 버튼은 설정 패널을 바꾸고, 열려 있으면 눌린 상태", () => {
    let calls = 0;
    const { rerender } = render(
      <OrgRail organizations={[]} memberships={[]} activeOrgId={null} userEmail="u1@test.local" currentUserId="u1"
        onSelectOrg={() => {}} onCreateOrg={() => {}} onSignOut={() => {}} invitationCount={0} invitations={null}
        onToggleSettings={() => { calls++; }} />,
    );
    const btn = screen.getByRole("button", { name: "설정" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(calls).toBe(1);
    rerender(
      <OrgRail organizations={[]} memberships={[]} activeOrgId={null} userEmail="u1@test.local" currentUserId="u1"
        onSelectOrg={() => {}} onCreateOrg={() => {}} onSignOut={() => {}} invitationCount={0} invitations={null}
        settingsOpen onToggleSettings={() => { calls++; }} />,
    );
    expect(screen.getByRole("button", { name: "설정" })).toHaveAttribute("aria-pressed", "true");
  });

  it("onToggleSettings가 없으면 설정 버튼도 없다", () => {
    renderRail(0);
    expect(screen.queryByRole("button", { name: "설정" })).toBeNull();
  });
});

describe("OrgRail — 개인 조직 이름", () => {
  const personal = (name: string): Organization => ({
    id: "p1", name, icon: null, color: null, icon_scale: 100, icon_x: 0, icon_y: 0,
    owner_id: "u1", is_personal: true, created_at: "2026-01-01",
  });
  const railWith = (name: string) =>
    render(
      <OrgRail organizations={[personal(name)]} memberships={[]} activeOrgId="p1" userEmail="u1@test.local" currentUserId="u1"
        onSelectOrg={() => {}} onCreateOrg={() => {}} onSignOut={() => {}} invitationCount={0} invitations={null} />,
    );

  afterEach(() => setLocale("ko"));

  it("이름을 바꿨으면 바꾼 이름이 보인다", () => {
    railWith("내 공간");
    expect(screen.getByText("내 공간")).toBeInTheDocument();
  });

  it("기본 이름은 화면 언어로 보인다", () => {
    setLocale("en");
    railWith("개인");
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });
});

describe("OrgRail — 좁은 화면(접힌 레일)", () => {
  const compactRail = (onSignOut = () => {}) =>
    render(
      <OrgRail organizations={[]} memberships={[]} activeOrgId={null} userEmail="u1@test.local" currentUserId="u1"
        onSelectOrg={() => {}} onCreateOrg={() => {}} onSignOut={onSignOut} invitationCount={2} invitations={<div>초대 목록</div>}
        compact onToggleSettings={() => {}} />,
    );

  it("설정·받은 초대에 올리면 이름 툴팁이 뜨고, 벗어나면 사라진다", () => {
    compactRail();
    const settings = screen.getByRole("button", { name: "설정" });
    fireEvent.mouseEnter(settings);
    expect(screen.getByRole("tooltip")).toHaveTextContent("설정");
    fireEvent.mouseLeave(settings);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "받은 초대 2개" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("받은 초대2");
  });

  it("넓은 화면에서는 툴팁 대신 레일이 펼쳐진다", () => {
    renderRail(2);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "받은 초대 2개" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("프로필을 누르면 이메일과 로그아웃 메뉴가 뜨고, 로그아웃을 누르면 로그아웃한다", () => {
    let out = 0;
    compactRail(() => { out++; });
    fireEvent.click(screen.getByRole("button", { name: "계정" }));
    expect(screen.getByRole("menu")).toHaveTextContent("u1@test.local");
    fireEvent.click(screen.getByRole("menuitem", { name: "로그아웃" }));
    expect(out).toBe(1);
  });

  it("프로필 메뉴는 바깥을 누르거나 Esc로 닫힌다", () => {
    compactRail();
    const acct = screen.getByRole("button", { name: "계정" });
    fireEvent.click(acct);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(acct);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("메뉴가 열려 있으면 툴팁을 띄우지 않는다", () => {
    compactRail();
    fireEvent.click(screen.getByRole("button", { name: "계정" }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "설정" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
