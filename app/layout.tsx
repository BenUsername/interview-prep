import type { Metadata } from "next";
import { Spline_Sans } from "next/font/google";
import { COMPANY_NAME } from "@/lib/config";
import "./globals.css";

const spline = Spline_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: `${COMPANY_NAME} video interview`,
  icons: { icon: "/favicon.png" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={spline.className}>{children}</body>
    </html>
  );
}
