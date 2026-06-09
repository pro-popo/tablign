export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Space {
  id: string;
  user_id: string;
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
