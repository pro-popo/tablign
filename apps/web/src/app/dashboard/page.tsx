import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>tablign</h1>
        <form action="/auth/signout" method="post">
          <button type="submit">로그아웃</button>
        </form>
      </header>
      <p>{user.email} 님 환영합니다. (컬렉션은 Plan 2에서 추가됩니다.)</p>
    </main>
  );
}
