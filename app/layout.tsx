import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm-sans",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-serif",
});

export const metadata: Metadata = {
  title: "immopulse — Détectez les vendeurs avant tout le monde",
  description: "Détectez les signaux de vente avant que le marché ne les voit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${dmSans.variable} ${dmSerif.variable}`}
        style={{ fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, padding: 0 }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}