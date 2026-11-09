import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/lib/server/current-user";
import { getStudyStreak } from "@/lib/server/quizzes/attempt-summary";
import DashboardLoading from "./loading";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={<div className="flex min-h-screen w-full"><div className="hidden w-68 shrink-0 bg-slate-100 md:block" /><div className="min-w-0 flex-1 p-6"><DashboardLoading /></div></div>}><DashboardContent>{children}</DashboardContent></Suspense>;
}

async function DashboardContent({ children }: Readonly<{ children: React.ReactNode }>) {
  await auth.protect();
  const user = await getCurrentUser();
  const streak = await getStudyStreak(user.id);

  return (
    <SidebarProvider>
      <AppSidebar displayName={user.displayName} />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-clip bg-transparent">
        <AppTopbar streak={streak} />
        <main className="mx-auto w-full max-w-[1680px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
