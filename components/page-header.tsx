import type { LucideIcon } from "lucide-react";

export function PageHeader({ eyebrow, title, description, icon: Icon, action }: { eyebrow?: string; title: string; description: string; icon?: LucideIcon; action?: React.ReactNode }) {
  return <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2">{Icon && <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600"><Icon className="size-4" /></span>}{eyebrow && <span className="eyebrow">{eyebrow}</span>}</div><h1 className="text-2xl font-extrabold tracking-[-.04em] text-navy sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p></div>{action}</header>;
}
