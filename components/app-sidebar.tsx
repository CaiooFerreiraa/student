"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Bot, ChevronRight, FilePlus2, GraduationCap, Home, Library, Settings, Sparkles } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Início", href: "/", icon: Home },
  { label: "Quizzes", href: "/quizzes", icon: BookOpen },
  { label: "Criar quiz", href: "/quizzes/create", icon: FilePlus2 },
  { label: "Materiais", href: "/materials", icon: Library },
  { label: "Chat com IA", href: "/chat", icon: Bot },
  { label: "Desempenho", href: "/performance", icon: BarChart3 },
  { label: "Configurações", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon" className="z-30 border-0" style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
      <div className="relative flex h-full flex-col overflow-hidden bg-[linear-gradient(165deg,#071a4f_0%,#092a7a_58%,#1744bd_100%)] text-white">
        <div className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full bg-blue-500/25 blur-3xl" />
        <SidebarHeader className="relative px-5 pb-5 pt-6 group-data-[collapsible=icon]:px-2">
          <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-cyan-300 shadow-inner shadow-white/10"><GraduationCap className="size-6" /></span>
            <span className="text-xl font-extrabold tracking-tight group-data-[collapsible=icon]:hidden">Lumina <span className="font-medium text-blue-200">Study</span></span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="relative px-3">
          <SidebarMenu className="gap-1.5">
            {navigation.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={active}
                    tooltip={item.label}
                    className={cn("h-12 cursor-pointer gap-3 rounded-xl px-3 text-[15px] font-medium text-blue-100 hover:bg-white/10 hover:text-white data-active:bg-white/14 data-active:text-white data-active:shadow-[inset_3px_0_0_#65dffa] group-data-[collapsible=icon]:mx-auto", active && "bg-white/14")}
                  >
                    <item.icon className="size-5!" /><span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="relative gap-4 p-4 group-data-[collapsible=icon]:p-2">
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-4 shadow-xl shadow-blue-950/20 backdrop-blur group-data-[collapsible=icon]:hidden">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-cyan-300" /> Lumina Pro</div>
            <p className="mb-4 text-xs leading-relaxed text-blue-100">Mais materiais, quizzes ilimitados e tutoria com IA.</p>
            <Link href="/settings" className="flex h-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-blue-700 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">Conhecer planos</Link>
          </div>
          <Link href="/profile" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-blue-950/20 p-2.5 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
            <Image src="/robozinho-student.png" alt="Avatar" width={42} height={42} className="size-10 shrink-0 rounded-full bg-cyan-100 object-cover object-top" />
            <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><strong className="block truncate text-sm">Caio Martins</strong><small className="text-blue-200">Ver perfil</small></span>
            <ChevronRight className="size-4 text-blue-300 group-data-[collapsible=icon]:hidden" />
          </Link>
        </SidebarFooter>
        <SidebarRail />
      </div>
    </Sidebar>
  );
}
