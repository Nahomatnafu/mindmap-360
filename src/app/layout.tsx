import type { Metadata } from "next";
import { Crimson_Pro, DM_Mono } from "next/font/google";
import "./globals.css";
import { TourProvider } from "@/context/TourContext";

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "MindMap 360 — Memory Palace",
  description: "Anchor flashcards to real spaces. Learn through place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${crimsonPro.variable} ${dmMono.variable} antialiased`}>
        <TourProvider>
          {children}
        </TourProvider>
      </body>
    </html>
  );
}
