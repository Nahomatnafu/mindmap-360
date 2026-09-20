import type { Metadata } from "next";
import "./globals.css";
import { TourProvider } from "@/context/TourContext";

export const metadata: Metadata = {
  title: "MindMap 360 - Flashcards in Virtual Tours",
  description: "Learn with flashcards placed in 360° virtual tours using the memory palace technique",
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
