import { NextResponse } from "next/server";
import { parseMetadata } from "@/lib/parse-metadata";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url 파라미터 필요" }, { status: 400 });
  }

  // http(s)만 허용 (file:, data:, internal scheme 등 차단). SSRF 표면 축소를 위한 최소 검증이며,
  // 사설/루프백 호스트 차단은 추후 하드닝 과제로 남겨둠.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "유효하지 않은 url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "http(s) url만 허용" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "tablign-bot" },
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();
    return NextResponse.json(parseMetadata(html, url));
  } catch {
    return NextResponse.json(parseMetadata("", url));
  }
}
