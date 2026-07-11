import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Lumina — Estude com clareza",
  description: "Transforme seus materiais em quizzes e aprenda com uma tutora de IA.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={geist.variable}>
      <body suppressHydrationWarning>
        <SidebarProvider>
          <AppSidebar />
          <div className="relative flex min-w-0 flex-1 flex-col overflow-x-clip bg-transparent">
            <AppTopbar />
            <main className="mx-auto w-full max-w-[1680px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
