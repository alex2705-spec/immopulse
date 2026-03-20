import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display, Plus_Jakarta_Sans } from "next/font/google";
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

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "ImmoPulse",
  description: "Détectez les signaux de vente avant que le marché ne les voit.",
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${dmSans.variable} ${dmSerif.variable} ${jakarta.variable}`}
        style={{ fontFamily: 'var(--font-dm-sans), sans-serif', margin: 0, padding: 0 }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}