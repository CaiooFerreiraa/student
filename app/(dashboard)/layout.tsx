import { auth } from "@clerk/nextjs/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { quizAttempts } from "@/lib/server/db/schema";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await auth.protect();
  const user = await getCurrentUser();
  const activity = await db.select({ submittedAt: quizAttempts.submittedAt }).from(quizAttempts)
    .where(and(eq(quizAttempts.userId, user.id), eq(quizAttempts.status, "SUBMITTED"), isNotNull(quizAttempts.submittedAt)));
  const days = new Set(activity.flatMap((item) => item.submittedAt ? [item.submittedAt.toISOString().slice(0, 10)] : []));
  const cursor = new Date();
  let streak = 0;
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

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
