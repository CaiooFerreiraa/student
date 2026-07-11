import Link from "next/link";
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, CirclePlus, Clock3, Filter, MoreHorizontal, Play, RotateCcw, Search, Target } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const quizzes = [
  { title: "Direitos Fundamentais — Parte 1", subject: "Direito Constitucional", questions: 20, score: 85, status: "Concluído", last: "Hoje" },
  { title: "Atos Administrativos", subject: "Direito Administrativo", questions: 15, score: 73, status: "Concluído", last: "Ontem" },
  { title: "Funções do 1º Grau", subject: "Matemática", questions: 20, score: 90, status: "Concluído", last: "7 jul" },
  { title: "Interpretação textual", subject: "Português", questions: 12, score: 0, status: "Rascunho", last: "5 jul" },
  { title: "Simulado ENEM — Geral", subject: "Múltiplas disciplinas", questions: 45, score: 68, status: "Concluído", last: "1 jul" },
];

export default function QuizzesPage() {
  return <div>
    <PageHeader eyebrow="Biblioteca" title="Seus quizzes" description="Crie, refaça e acompanhe sua evolução em cada assunto." icon={BookOpen} action={<Link href="/quizzes/create" className="primary-button"><CirclePlus className="size-4" /> Criar novo quiz</Link>} />
    <section className="mb-5 grid gap-4 sm:grid-cols-3">
      <MiniMetric icon={<CheckCircle2 />} label="Quizzes concluídos" value="32" detail="+4 este mês" tone="blue" />
      <MiniMetric icon={<Target />} label="Média geral" value="78%" detail="6% acima do mês passado" tone="violet" />
      <MiniMetric icon={<CalendarClock />} label="Próxima revisão" value="Amanhã" detail="Direitos Fundamentais" tone="cyan" />
    </section>
    <section className="surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
        <label className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" placeholder="Buscar por título ou disciplina" /></label>
        <button className="secondary-button"><Filter className="size-4" /> Filtrar</button>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {quizzes.map((quiz) => <QuizCard key={quiz.title} {...quiz} />)}
        <Link href="/quizzes/create" className="group grid min-h-[225px] place-items-center rounded-2xl border border-dashed border-blue-300 bg-blue-50/40 p-5 text-center transition hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><span><span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm"><CirclePlus /></span><strong className="text-sm text-blue-800">Crie uma nova sessão</strong><small className="mt-1 block text-slate-500">A partir de seus materiais</small></span></Link>
      </div>
    </section>
  </div>;
}

function MiniMetric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) { const colors: Record<string,string> = { blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600", cyan: "bg-cyan-50 text-cyan-600" }; return <article className="surface flex items-center gap-4 p-4"><span className={`grid size-11 place-items-center rounded-xl ${colors[tone]} [&>svg]:size-5`}>{icon}</span><div><span className="text-xs text-slate-500">{label}</span><div className="flex items-baseline gap-2"><strong className="text-xl text-navy">{value}</strong><small className="text-[10px] text-emerald-600">{detail}</small></div></div></article> }

function QuizCard({ title, subject, questions, score, status, last }: { title:string; subject:string; questions:number; score:number; status:string; last:string }) {
  return <article className="group relative rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
    <div className="mb-5 flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><BookOpen className="size-5" /></span><button aria-label="Mais opções" className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-navy"><MoreHorizontal className="size-4" /></button></div>
    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status === "Concluído" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{status}</span><h2 className="mt-3 line-clamp-2 min-h-10 text-sm font-bold leading-snug text-navy">{title}</h2><p className="mt-1 text-xs text-slate-500">{subject}</p>
    <div className="mt-5 flex items-center gap-4 border-t border-slate-100 pt-4 text-[11px] text-slate-500"><span className="flex items-center gap-1"><BookOpen className="size-3.5" />{questions} questões</span><span className="flex items-center gap-1"><Clock3 className="size-3.5" />{last}</span>{score > 0 && <strong className="ml-auto text-emerald-600">{score}%</strong>}</div>
    <div className="mt-4 flex gap-2"><Link href="/quizzes/session" className="primary-button min-h-10 flex-1 px-3">{status === "Concluído" ? <RotateCcw className="size-4" /> : <Play className="size-4" />}{status === "Concluído" ? "Refazer" : "Continuar"}</Link><Link href="/quizzes/create" aria-label="Editar quiz" className="secondary-button min-h-10 px-3"><ArrowRight className="size-4" /></Link></div>
  </article>;
}
