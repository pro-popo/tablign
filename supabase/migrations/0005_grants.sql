-- 테이블 레벨 권한 부여(GRANT)
-- RLS는 "어떤 행"을 제어하지만, 그 이전에 롤이 테이블을 만질 수 있는 GRANT가 필요하다.
-- 순수 SQL 마이그레이션으로 만든 테이블에는 자동 GRANT가 붙지 않아 추가한다.
-- RLS 정책이 이미 소유자(auth.uid() = user_id)로 행을 제한하므로 authenticated에 DML을 줘도 안전하다.
-- 익명 접근은 없는 앱이라 anon에는 schema usage만 부여한다.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- 이후 추가될 테이블에도 동일 권한이 자동 적용되도록 기본 권한 설정
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
