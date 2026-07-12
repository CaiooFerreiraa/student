import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import Image from "next/image";
import { Award, BookOpen, Clock3, Flame, GraduationCap, Mail, MapPin, Pencil, Target, Trophy } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { essaySubmissions, quizzes as quizTable, quizAttempts } from "@/lib/server/db/schema";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await auth.protect();
  const user = await getCurrentUser();
  const [attempts, [quizCount], [essayCount]] = await Promise.all([
    db.select().from(quizAttempts).where(and(eq(quizAttempts.userId, user.id), eq(quizAttempts.status, "SUBMITTED"))),
    db.select({ count: sql<number>`count(*)::int` }).from(quizTable).where(and(eq(quizTable.ownerId, user.id), isNull(quizTable.deletedAt))),
    db.select({ count: sql<number>`count(*)::int` }).from(essaySubmissions).where(and(eq(essaySubmissions.userId, user.id), eq(essaySubmissions.status, "GRADED"))),
  ]);
  const quizzes = quizCount?.count ?? 0;
  const essays = essayCount?.count ?? 0;
  const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + Number(attempt.percentage ?? 0), 0) / attempts.length) : 0;
  const seconds = attempts.reduce((sum, attempt) => sum + (attempt.durationSeconds ?? 0), 0);
  return <div><PageHeader eyebrow="Conta" title="Seu perfil" description="Dados persistidos no seu perfil de estudante." icon={GraduationCap} action={<a href="/settings" className="secondary-button"><Pencil className="size-4" /> Editar perfil</a>} />
    <section className="relative overflow-hidden rounded-3xl bg-[#0b246d] p-6 text-white sm:p-8"><div className="relative flex flex-col items-center gap-6 sm:flex-row"><Image src="/robozinho-student.png" alt={user.displayName} width={128} height={128} className="size-28 rounded-3xl border-4 border-white/20 bg-cyan-100 object-cover object-top shadow-xl" /><div className="text-center sm:text-left"><h1 className="text-2xl font-extrabold">{user.displayName}</h1><p className="mt-2 max-w-xl text-sm text-blue-100">{user.profile?.bio ?? "Adicione uma biografia nas configurações."}</p><div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-blue-200 sm:justify-start"><span className="flex items-center gap-1"><Mail className="size-3.5" />{user.email}</span><span className="flex items-center gap-1"><MapPin className="size-3.5" />{user.profile?.timezone ?? "America/Bahia"}</span></div></div></div></section>
    <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><ProfileMetric icon={<BookOpen />} value={String(quizzes)} label="Quizzes criados" /><ProfileMetric icon={<Target />} value={`${average}%`} label="Média de acertos" /><ProfileMetric icon={<Clock3 />} value={`${Math.floor(seconds / 3600)}h`} label="Tempo em quizzes" /><ProfileMetric icon={<Trophy />} value={String(essays)} label="Redações corrigidas" /></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-2"><article className="surface p-5 sm:p-6"><h2 className="section-title">Informações acadêmicas</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Detail label="Escolaridade" value={user.profile?.educationLevel ?? "Não informado"} /><Detail label="Objetivo principal" value={user.profile?.primaryGoal ?? "Não informado"} /><Detail label="Meta semanal" value={`${user.profile?.weeklyStudyGoalMinutes ?? 0} minutos`} /><Detail label="Idioma" value={user.profile?.locale ?? "pt-BR"} /></div></article><article className="surface p-5 sm:p-6"><span className="grid size-11 place-items-center rounded-xl bg-orange-50 text-orange-500"><Flame className="size-5" /></span><h2 className="section-title mt-4">Sua jornada</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">Você concluiu {attempts.length} sessões e possui {quizzes} quizzes persistidos. Continue estudando para ampliar seu histórico.</p><div className="mt-5 flex items-center gap-2 text-xs font-bold text-blue-600"><Award className="size-4" />Dados atualizados em tempo real</div></article></section>
  </div>;
}
function ProfileMetric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) { return <article className="surface flex items-center gap-4 p-5"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600 [&>svg]:size-5">{icon}</span><div><strong className="block text-xl text-navy">{value}</strong><small className="text-slate-500">{label}</small></div></article>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span><strong className="mt-1 block text-sm text-navy">{value}</strong></div>; }
