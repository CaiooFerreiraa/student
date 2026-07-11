import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CirclePlus,
  Clock3,
  History,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { QuizCardActions } from "@/components/quiz-card-actions";
import { getCurrentUser } from "@/lib/server/current-user";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
  const user = await getCurrentUser();
  const [quizzes, completed, average, nextReview] = await Promise.all([
    prisma.quiz.findMany({
      where: { ownerId: user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        subject: true,
        currentVersion: {
          include: { _count: { select: { questions: true } } },
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: { _count: { select: { questions: true } } },
        },
        attempts: {
          where: { status: "SUBMITTED" },
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.quizAttempt.count({
      where: { userId: user.id, status: "SUBMITTED" },
    }),
    prisma.quizAttempt.aggregate({
      where: { userId: user.id, status: "SUBMITTED" },
      _avg: { percentage: true },
    }),
    prisma.quizReviewSchedule.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: { nextReviewAt: "asc" },
      include: { quiz: true },
    }),
  ]);
  return (
    <div>
      <PageHeader
        eyebrow="Biblioteca"
        title="Seus quizzes"
        description="Crie, refaça e acompanhe versões persistidas dos seus quizzes."
        icon={BookOpen}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/quizzes/history" className="secondary-button">
              <History className="size-4" /> Histórico
            </Link>
            <Link href="/quizzes/create" className="primary-button">
              <CirclePlus className="size-4" /> Criar novo quiz
            </Link>
          </div>
        }
      />
      <section className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric
          icon={<CheckCircle2 />}
          label="Tentativas concluídas"
          value={String(completed)}
          detail="histórico real"
        />
        <Metric
          icon={<Target />}
          label="Média geral"
          value={`${Math.round(Number(average._avg.percentage ?? 0))}%`}
          detail="todas as tentativas"
        />
        <Metric
          icon={<CalendarClock />}
          label="Próxima revisão"
          value={
            nextReview
              ? nextReview.nextReviewAt.toLocaleDateString("pt-BR")
              : "Sem agenda"
          }
          detail={nextReview?.quiz.title ?? "Conclua um quiz"}
        />
      </section>
      <section className="surface p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((quiz) => {
            const attempt = quiz.attempts[0];
            const latestVersion = quiz.versions[0];
            const ready =
              quiz.status === "READY" &&
              Boolean(quiz.currentVersion?._count.questions);
            const generating =
              quiz.status === "GENERATING" ||
              latestVersion?.status === "GENERATING";
            const failed = latestVersion?.status === "FAILED";
            return (
              <article
                key={quiz.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                    <BookOpen className="size-5" />
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${ready ? "bg-emerald-50 text-emerald-700" : generating ? "bg-orange-50 text-orange-700" : failed ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    {ready
                      ? "Pronto"
                      : generating
                        ? "Gerando"
                        : failed
                          ? "Falha na geração"
                          : quiz.status === "ARCHIVED"
                            ? "Arquivado"
                            : "Rascunho"}
                  </span>
                </div>
                <h2 className="mt-4 min-h-10 text-sm font-bold leading-snug text-navy">
                  {quiz.title}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {quiz.subject?.name ?? "Sem disciplina"}
                </p>
                <div className="mt-5 flex items-center gap-4 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <BookOpen className="size-3.5" />
                    {ready
                      ? quiz.currentVersion?._count.questions
                      : (latestVersion?.requestedQuestionCount ?? 0)}{" "}
                    questões
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock3 className="size-3.5" />v
                    {latestVersion?.versionNumber ?? 1}
                  </span>
                  {attempt?.percentage != null && (
                    <strong className="ml-auto text-emerald-600">
                      {Math.round(Number(attempt.percentage))}%
                    </strong>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <QuizCardActions
                    key={`${quiz.status}-${latestVersion?.status}-${quiz.currentVersion?._count.questions ?? 0}`}
                    quizId={quiz.id}
                    ready={ready}
                    generating={generating}
                    hasAttempt={Boolean(attempt)}
                  />
                  {attempt && (
                    <Link
                      href={`/quizzes/history?quiz=${quiz.id}`}
                      className="secondary-button min-h-10 px-3"
                      aria-label={`Histórico de ${quiz.title}`}
                    >
                      <History className="size-4" />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
          {quizzes.length === 0 && (
            <div className="col-span-full grid min-h-64 place-items-center text-center">
              <div>
                <BookOpen className="mx-auto size-8 text-slate-300" />
                <h2 className="mt-3 text-sm font-bold text-navy">
                  Nenhum quiz ainda
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Crie um quiz a partir de um material processado.
                </p>
                <Link href="/quizzes/create" className="primary-button mt-4">
                  <CirclePlus className="size-4" /> Criar quiz
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="surface flex items-center gap-4 p-4">
      <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600 [&>svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0">
        <span className="text-xs text-slate-500">{label}</span>
        <strong className="mt-1 block truncate text-xl text-navy">
          {value}
        </strong>
        <small className="block truncate text-[10px] text-slate-500">
          {detail}
        </small>
      </div>
    </article>
  );
}
