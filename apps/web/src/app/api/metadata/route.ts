import { NextResponse } from "next/server";
import { parseMetadata } from "@/lib/parse-metadata";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url 파라미터 필요" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "tablign-bot" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();
    return NextResponse.json(parseMetadata(html, url));
  } catch {
    return NextResponse.json(parseMetadata("", url));
  }
}
