import type { Metadata } from "next";
import "./globals.css";
import { TourProvider } from "@/context/TourContext";
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
      <body className="antialiased">
        <TourProvider>
          {children}
        </TourProvider>
      </body>
    </html>
  );
}
