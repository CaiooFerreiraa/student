import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, Bot, CalendarDays, Check, ChevronRight, Clock3, FileText, Flame, Plus, Sparkles, Target, TrendingUp, UploadCloud } from "lucide-react";

const stats = [
  { label: "Questões respondidas", value: "1.248", delta: "+18%", icon: BookOpen, tone: "blue" },
  { label: "Taxa de acertos", value: "78%", delta: "+6%", icon: Target, tone: "violet" },
  { label: "Sequência atual", value: "12 dias", delta: "recorde: 18", icon: Flame, tone: "orange" },
  { label: "Tempo de estudo", value: "14h 32m", delta: "+2h 30m", icon: Clock3, tone: "cyan" },
];

const disciplines = [
  { name: "Direito Constitucional", score: 85, delta: "+8%", color: "bg-blue-600" },
  { name: "Direito Administrativo", score: 78, delta: "+5%", color: "bg-violet-500" },
  { name: "Português", score: 72, delta: "+10%", color: "bg-cyan-500" },
  { name: "Matemática", score: 68, delta: "+3%", color: "bg-amber-400" },
];

export default function Home() {
  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,.75fr)]">
        <div className="relative min-h-[285px] overflow-hidden rounded-[26px] bg-[#0b246d] p-7 text-white shadow-[0_24px_55px_-30px_#1231a5] sm:p-9">
          <div className="relative z-10 max-w-[600px]">
            <p className="mb-3 text-sm font-semibold text-cyan-200">Olá, Caio! <span aria-hidden>👋</span></p>
            <h1 className="max-w-xl text-3xl font-extrabold leading-[1.12] tracking-[-.04em] sm:text-4xl">Sua próxima conquista começa em uma pergunta.</h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-blue-100 sm:text-base">Continue o quiz de Direito Constitucional ou transforme um novo material em revisão ativa.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/quizzes/session" className="primary-button bg-white text-blue-700 hover:bg-cyan-50">Continuar estudando <ArrowRight className="size-4" /></Link>
              <Link href="/performance" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><BarChart3 className="size-4" /> Meu desempenho</Link>
            </div>
          </div>
          <div className="absolute -bottom-11 -right-3 hidden h-[285px] w-[285px] sm:block lg:right-7">
            <div className="absolute inset-8 rounded-full border border-cyan-300/20" />
            <div className="absolute inset-14 rounded-full border border-violet-300/30" />
            <Image src="/robozinho-student.png" alt="Mascote Lumina estudando" fill priority className="object-contain drop-shadow-[0_25px_28px_rgba(0,0,45,.4)]" sizes="285px" />
          </div>
          <Sparkles className="absolute right-[27%] top-10 size-5 text-cyan-200/80" />
        </div>

        <article className="surface p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="section-title">Metas de hoje</h2><Link href="/performance" className="text-xs font-bold text-blue-600 hover:text-blue-800">Ver todas</Link></div>
          <div className="space-y-5">
            <Goal icon={<Check className="size-4" />} label="Responder 20 questões" value="20 / 20" progress="100%" done />
            <Goal icon={<Clock3 className="size-4" />} label="Estudar 2h de materiais" value="1h 15m" progress="63%" />
            <Goal icon={<Target className="size-4" />} label="Fazer 1 simulado" value="0 / 1" progress="8%" />
          </div>
          <div className="mt-6 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800"><strong>Você está no ritmo!</strong> Faltam 45 minutos para concluir as metas de hoje.</div>
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.05fr_1fr]">
        <article className="surface p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="section-title">Próximas revisões</h2><CalendarDays className="size-4 text-blue-600" /></div>
          <div className="space-y-2.5">
            <Revision date="Hoje, 19:00" title="Direito Constitucional" subtitle="Direitos fundamentais" tone="blue" />
            <Revision date="Amanhã, 10:00" title="Redação" subtitle="Dissertação argumentativa" tone="violet" />
            <Revision date="Terça, 14:30" title="Matemática" subtitle="Funções do 1º grau" tone="cyan" />
          </div>
        </article>

        <article className="surface p-5">
          <h2 className="section-title mb-4">Ações rápidas</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/quizzes/create" icon={<Plus />} title="Criar quiz" copy="Configure do seu jeito" tone="blue" />
            <QuickAction href="/quizzes/create" icon={<Target />} title="Simulado" copy="Teste seu ritmo" tone="violet" />
            <QuickAction href="/materials" icon={<UploadCloud />} title="Enviar material" copy="PDF, DOCX ou PPTX" tone="cyan" />
            <QuickAction href="/chat" icon={<Bot />} title="Perguntar à IA" copy="Tire uma dúvida" tone="lime" />
          </div>
        </article>

        <article className="surface p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="section-title">Quizzes recentes</h2><Link href="/quizzes" className="text-xs font-bold text-blue-600">Ver todos</Link></div>
          <div className="divide-y divide-slate-100">
            <RecentQuiz title="Atos Administrativos" questions="20 questões" score="85%" />
            <RecentQuiz title="Interpretação de Texto" questions="15 questões" score="73%" />
            <RecentQuiz title="Função do 1º Grau" questions="20 questões" score="90%" />
            <RecentQuiz title="Atualidades — Junho" questions="10 questões" score="60%" />
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_.9fr_1fr]">
        <article className="surface p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="section-title">Desempenho por disciplina</h2><Link href="/performance" className="text-xs font-bold text-blue-600">Relatório completo</Link></div>
          <div className="space-y-4">
            {disciplines.map((item) => (
              <div key={item.name} className="grid grid-cols-[minmax(130px,1.25fr)_1.4fr_42px_42px] items-center gap-3 text-xs">
                <span className="truncate font-semibold text-navy">{item.name}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.score}%` }} /></div><strong>{item.score}%</strong><span className="font-semibold text-emerald-600">{item.delta}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="surface p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="section-title">Materiais recentes</h2><Link href="/materials" className="text-xs font-bold text-blue-600">Ver todos</Link></div>
          <div className="space-y-2">
            <Material title="Constituição Federal.pdf" meta="PDF · 2,3 MB" />
            <Material title="Resumo — Atos.docx" meta="DOCX · 1,1 MB" />
            <Material title="Apostila Matemática.pdf" meta="PDF · 4,7 MB" />
          </div>
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-blue-200 bg-[linear-gradient(145deg,#edf5ff,#f6f1ff)] p-5 sm:p-6">
          <Sparkles className="mb-4 size-5 text-blue-600" /><h2 className="section-title max-w-xs">O que você quer entender agora?</h2><p className="muted-copy mt-2 max-w-sm">A Lumina consulta seus materiais para responder com contexto e indicar as fontes.</p>
          <Link href="/chat" className="primary-button mt-5">Conversar com a IA <ChevronRight className="size-4" /></Link>
          <Image src="/robozinho-student.png" alt="" width={130} height={130} className="absolute -bottom-8 -right-4 opacity-90" />
        </article>
      </section>
    </div>
  );
}

function Goal({ icon, label, value, progress, done = false }: { icon: React.ReactNode; label: string; value: string; progress: string; done?: boolean }) {
  return <div className="flex gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>{icon}</span><div className="min-w-0 flex-1"><div className="mb-2 flex items-center justify-between gap-3 text-xs"><strong className="truncate text-navy">{label}</strong><span className="shrink-0 text-slate-500">{value}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-blue-600"}`} style={{ width: progress }} /></div></div></div>;
}

function StatCard({ label, value, delta, icon: Icon, tone }: { label: string; value: string; delta: string; icon: typeof BookOpen; tone: string }) {
  const tones: Record<string, string> = { blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600", orange: "bg-orange-50 text-orange-500", cyan: "bg-cyan-50 text-cyan-600" };
  return <article className="surface flex items-center gap-4 p-4.5"><span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}><Icon className="size-5" /></span><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><div className="mt-1 flex items-baseline gap-2"><strong className="text-xl tracking-tight text-navy">{value}</strong><span className="text-[11px] font-bold text-emerald-600">{delta}</span></div></div><TrendingUp className="ml-auto size-4 text-slate-300" /></article>;
}

function Revision({ date, title, subtitle, tone }: { date: string; title: string; subtitle: string; tone: string }) {
  const colors: Record<string, string> = { blue: "bg-blue-50 text-blue-700", violet: "bg-violet-50 text-violet-700", cyan: "bg-cyan-50 text-cyan-700" };
  return <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/30"><span className={`rounded-lg px-2 py-1.5 text-center text-[10px] font-bold leading-tight ${colors[tone]}`}>{date.split(", ")[0]}</span><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-navy">{title}</strong><span className="block truncate text-[11px] text-slate-500">{subtitle}</span></div><span className="text-[10px] font-semibold text-slate-500">{date.split(", ")[1]}</span></div>;
}

function QuickAction({ href, icon, title, copy, tone }: { href: string; icon: React.ReactNode; title: string; copy: string; tone: string }) {
  const tones: Record<string, string> = { blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600", cyan: "bg-cyan-50 text-cyan-600", lime: "bg-lime-50 text-lime-700" };
  return <Link href={href} className="group rounded-xl border border-slate-100 p-3.5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><span className={`mb-3 grid size-9 place-items-center rounded-xl ${tones[tone]} [&>svg]:size-4.5`}>{icon}</span><strong className="block text-xs text-navy group-hover:text-blue-700">{title}</strong><span className="mt-1 block text-[10px] text-slate-500">{copy}</span></Link>;
}

function RecentQuiz({ title, questions, score }: { title: string; questions: string; score: string }) {
  return <Link href="/quizzes/session" className="flex items-center gap-3 py-3 transition hover:pl-1"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600"><BookOpen className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-navy">{title}</strong><small className="text-[10px] text-slate-500">{questions}</small></span><span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{score}</span></Link>;
}

function Material({ title, meta }: { title: string; meta: string }) {
  return <div className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-slate-50"><span className="grid size-9 place-items-center rounded-lg bg-red-50 text-red-500"><FileText className="size-4" /></span><div className="min-w-0"><strong className="block truncate text-xs text-navy">{title}</strong><small className="text-[10px] text-slate-500">{meta}</small></div></div>;
}
