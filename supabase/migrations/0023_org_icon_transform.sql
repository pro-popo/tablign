-- 조직 아이콘(이모지)의 위치·크기 조정값. 기준 박스 100px에서의 오프셋(px)과 스케일(%).
-- icon_scale: 60~140(%), icon_x·icon_y: -25~25(px @100px 기준). 레일·헤더·아바타 렌더 시 박스크기에 비례해 반영.
alter table public.organizations
  add column icon_scale int  not null default 100,
  add column icon_x     int  not null default 0,
  add column icon_y     int  not null default 0;

notify pgrst, 'reload schema';
