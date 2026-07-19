export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Space {
  id: string;
  user_id: string;
  org_id: string;
  name: string;
  icon: string | null;
  position: number;
  created_at: string;
}

export interface Collection {
  id: string;
  space_id: string;
  user_id: string;
  title: string;
  icon: string | null;
  note: string | null;
  position: number;
  created_at: string;
}

export interface Link {
  id: string;
  collection_id: string;
  user_id: string;
  url: string;
  title: string | null;
  favicon_url: string | null;
  thumbnail_url: string | null;
  custom_title: string | null;
  note: string | null;
  position: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface CollectionTag {
  collection_id: string;
  tag_id: string;
}

export interface SpaceMember {
  space_id: string;
  user_id: string;
  role: "editor" | "viewer";
  position: number;
  created_at: string;
}

export interface MemberWithProfile extends SpaceMember {
  display_name: string | null;
  avatar_url: string | null;
}

export interface SpaceInvitation {
  id: string;
  space_id: string;
  inviter_id: string;
  invitee_email: string;
  role: "editor" | "viewer";
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export interface InvitationWithSpace extends SpaceInvitation {
  space_name: string;
  inviter_name: string | null;
}

export interface Organization {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  owner_id: string;
  is_personal: boolean;
  created_at: string;
}

export interface OrganizationMember {
  org_id: string;
  user_id: string;
  role: "admin" | "member";
  position: number;
  created_at: string;
}

export interface OrganizationInvitation {
  id: string;
  org_id: string;
  inviter_id: string;
  invitee_email: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export interface OrgMemberWithProfile extends OrganizationMember {
  display_name: string | null;
  avatar_url: string | null;
}

export interface OrgInvitationWithOrg extends OrganizationInvitation {
  org_name: string;
  inviter_name: string | null;
}
