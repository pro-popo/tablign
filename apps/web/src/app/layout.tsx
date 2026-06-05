import { Providers } from "./providers";

export const metadata = {
  title: "tablign",
  description: "시각적 북마크·탭 관리",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
