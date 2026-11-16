import type { Metadata } from "next";
import { Aref_Ruqaa, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const ruqaa = Aref_Ruqaa({
  variable: "--font-ruqaa",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

const plex = IBM_Plex_Sans_Arabic({
  variable: "--font-plex",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "جواهر النخيل",
  description: "نظام المبيعات والإدارة — جواهر النخيل لتغليف وتشكيل التمور",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${ruqaa.variable} ${plex.variable}`}>
      <body className="font-sans antialiased min-h-dvh">
        {children}
      </body>
    </html>
  );
}
