import { UserButton } from "@clerk/nextjs";
import { Bell, Flame, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppTopbar({ streak }: { streak: number }) {
  return (
    <header className="sticky top-0 z-20 w-full min-w-0 border-b border-slate-200/70 bg-[rgba(247,249,253,.86)] px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1680px] items-center gap-3">
        <SidebarTrigger className="h-11 w-11 shrink-0 cursor-pointer rounded-xl border border-slate-200 bg-white md:hidden" />
        <label className="group relative flex h-11 max-w-2xl flex-1 items-center">
          <Search className="pointer-events-none absolute left-4 size-4.5 text-slate-400 transition-colors group-focus-within:text-blue-600" />
          <input
            type="search"
            placeholder="Buscar quizzes, materiais e assuntos..."
            className="h-full w-full rounded-2xl border border-slate-200 bg-white/90 pl-11 pr-16 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
          />
          <kbd className="absolute right-3 hidden rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 sm:block">⌘ K</kbd>
        </label>
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <div className="hidden items-center gap-2 border-r border-slate-200 pr-4 sm:flex">
            <span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-500"><Flame className="size-5" /></span>
            <div className="leading-tight"><strong className="block text-sm text-navy">{streak} {streak === 1 ? "dia" : "dias"}</strong><span className="text-[11px] text-slate-500">de sequência</span></div>
          </div>
          <button aria-label="Notificações" className="relative grid size-11 cursor-pointer place-items-center rounded-xl text-slate-600 transition hover:bg-white hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Bell className="size-5" />
            <span className="absolute right-2.5 top-2 size-2 rounded-full bg-blue-600 ring-2 ring-[#f7f9fd]" />
          </button>
          <UserButton
            userProfileMode="navigation"
            userProfileUrl="/profile"
            appearance={{ elements: { avatarBox: "size-11 border-2 border-white shadow-sm" } }}
          />
        </div>
      </div>
    </header>
  );
}
