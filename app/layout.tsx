import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/lib/server/current-user";
import { prisma } from "@/lib/server/prisma";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Lumina — Estude com clareza",
  description: "Transforme seus materiais em quizzes e aprenda com uma tutora de IA.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const activity = await prisma.quizAttempt.findMany({ where: { userId: user.id, status: "SUBMITTED", submittedAt: { not: null } }, select: { submittedAt: true } });
  const days = new Set(activity.flatMap((item) => item.submittedAt ? [item.submittedAt.toISOString().slice(0, 10)] : []));
  const cursor = new Date(); let streak = 0;
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return (
    <html lang="pt-BR" className={geist.variable}>
      <body suppressHydrationWarning>
        <SidebarProvider>
          <AppSidebar displayName={user.displayName} />
          <div className="relative flex min-w-0 flex-1 flex-col overflow-x-clip bg-transparent">
            <AppTopbar displayName={user.displayName} streak={streak} />
            <main className="mx-auto w-full max-w-[1680px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
