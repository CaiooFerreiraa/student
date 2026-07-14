import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Lumina — Estude com clareza",
  description: "Transforme seus materiais em quizzes e aprenda com uma tutora de IA.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={geist.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ClerkProvider
            dynamic
            telemetry={false}
            appearance={{
              theme: shadcn,
              variables: { colorPrimary: "#2458ff", borderRadius: "0.85rem" },
            }}
          >
            {children}
          </ClerkProvider>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
