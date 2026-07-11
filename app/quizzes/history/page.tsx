import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  History,
  Target,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/server/current-user";
import { listAttemptHistory } from "@/lib/server/quizzes/attempt-history";

export const dynamic = "force-dynamic";

function duration(seconds: number | null): string {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export default async function QuizHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ quiz?: string }>;
}) {
  const user = await getCurrentUser();
  const { quiz } = await searchParams;
  const attempts = await listAttemptHistory(user.id, quiz);
  const quizTitle = attempts[0]?.quiz.title;

  return (
    <div>
      <PageHeader
        eyebrow="Evolução"
        title={
          quizTitle ? `Histórico · ${quizTitle}` : "Histórico de respostas"
        }
        description="Revise tentativas anteriores, compare seu desempenho e entenda cada resposta."
        icon={History}
        action={
          <Link href="/quizzes" className="secondary-button">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        }
      />
      {attempts.length ? (
        <div className="space-y-3">
          {attempts.map((attempt, index) => (
            <article
              key={attempt.id}
              className="surface grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="flex min-w-0 items-start gap-4">
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl font-extrabold ${Number(attempt.percentage ?? 0) >= 70 ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}
                >
                  {Math.round(Number(attempt.percentage ?? 0))}%
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-navy">
                      {attempt.quiz.title}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                      Tentativa {attempts.length - index}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {attempt.quiz.subject?.name ?? "Geral"} · versão{" "}
                    {attempt.quizVersion.versionNumber}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {attempt.submittedAt?.toLocaleString("pt-BR")}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="size-3.5" />
                      {attempt.correctCount} acertos
                    </span>
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircle className="size-3.5" />
                      {attempt.incorrectCount} erros
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="size-3.5" />
                      {duration(attempt.durationSeconds)}
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href={`/quizzes/review?id=${attempt.id}`}
                className="secondary-button min-h-11 px-4"
              >
                <Eye className="size-4" /> Ver correção
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <section className="surface grid min-h-96 place-items-center p-8 text-center">
          <div>
            <BookOpen className="mx-auto size-10 text-slate-300" />
            <h2 className="mt-4 text-lg font-bold text-navy">
              Nenhuma tentativa concluída
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Conclua um quiz para acessar respostas e correções.
            </p>
            <Link href="/quizzes" className="primary-button mt-5">
              <Target className="size-4" /> Escolher quiz
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
