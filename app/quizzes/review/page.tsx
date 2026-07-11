import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  HelpCircle,
  History,
  Lightbulb,
  MinusCircle,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ReviewAutoRefresh } from "@/components/review-auto-refresh";
import { getCurrentUser } from "@/lib/server/current-user";
import { getAttemptReview } from "@/lib/server/quizzes/attempt-history";

export const dynamic = "force-dynamic";

function booleanLabel(value: boolean | null): string {
  return value === null ? "Não respondida" : value ? "Verdadeiro" : "Falso";
}

export default async function QuizReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await searchParams;
  const review = id ? await getAttemptReview(user.id, id) : null;
  if (!review)
    return (
      <div>
        <PageHeader
          title="Correção indisponível"
          description="A tentativa não foi encontrada ou ainda não foi concluída."
          icon={HelpCircle}
        />
        <Link href="/quizzes/history" className="secondary-button">
          <ArrowLeft className="size-4" /> Voltar ao histórico
        </Link>
      </div>
    );

  const percentage = Math.round(Number(review.percentage ?? 0));
  const hasPendingCorrection = review.questions.some(
    (question) => question.answer?.gradingStatus === "PENDING",
  );
  return (
    <div>
      <ReviewAutoRefresh active={hasPendingCorrection} />
      <PageHeader
        eyebrow="Revisão guiada"
        title={review.quiz.title}
        description={`Correção da tentativa realizada em ${review.submittedAt?.toLocaleString("pt-BR") ?? "data não informada"}.`}
        icon={BookOpen}
        action={
          <div className="flex gap-2">
            <Link
              href={`/quizzes/history?quiz=${review.quiz.id}`}
              className="secondary-button"
            >
              <History className="size-4" /> Histórico
            </Link>
            <Link href="/quizzes" className="secondary-button">
              <ArrowLeft className="size-4" /> Quizzes
            </Link>
          </div>
        }
      />

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Aproveitamento"
          value={`${percentage}%`}
          tone={percentage >= 70 ? "success" : "warning"}
          icon={<CheckCircle2 />}
        />
        <Metric
          label="Acertos"
          value={String(review.correctCount)}
          tone="success"
          icon={<Check />}
        />
        <Metric
          label="Erros"
          value={String(review.incorrectCount)}
          tone="danger"
          icon={<X />}
        />
        <Metric
          label="Tempo"
          value={
            review.durationSeconds
              ? `${Math.floor(review.durationSeconds / 60)}m ${review.durationSeconds % 60}s`
              : "—"
          }
          tone="neutral"
          icon={<Clock3 />}
        />
      </section>

      <div className="space-y-5">
        {review.questions.map((question) => {
          const answer = question.answer;
          const pending =
            question.type === "OPEN" && answer?.gradingStatus === "PENDING";
          const correct = answer?.isCorrect === true;
          const unanswered = !answer;
          return (
            <article
              key={question.id}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${unanswered ? "border-slate-200" : correct ? "border-emerald-200" : pending ? "border-blue-200" : "border-red-200"}`}
            >
              <header
                className={`flex items-start gap-3 border-b p-5 ${unanswered ? "border-slate-100 bg-slate-50" : correct ? "border-emerald-100 bg-emerald-50/70" : pending ? "border-blue-100 bg-blue-50/70" : "border-red-100 bg-red-50/70"}`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${unanswered ? "bg-slate-200 text-slate-600" : correct ? "bg-emerald-600 text-white" : pending ? "bg-blue-600 text-white" : "bg-red-500 text-white"}`}
                >
                  {unanswered ? (
                    <MinusCircle className="size-4" />
                  ) : correct ? (
                    <Check className="size-4" />
                  ) : pending ? (
                    <Clock3 className="size-4" />
                  ) : (
                    <X className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Questão {question.position} ·{" "}
                      {question.type === "MULTIPLE_CHOICE"
                        ? "Múltipla escolha"
                        : question.type === "TRUE_FALSE"
                          ? "Verdadeiro ou falso"
                          : "Resposta aberta"}
                    </span>
                    <strong
                      className={`text-xs ${unanswered ? "text-slate-500" : correct ? "text-emerald-700" : pending ? "text-blue-700" : "text-red-700"}`}
                    >
                      {unanswered
                        ? "Não respondida"
                        : pending
                          ? "Aguardando correção"
                          : correct
                            ? "Resposta correta"
                            : question.type === "OPEN"
                              ? "Correção da IA"
                              : "Resposta incorreta"}
                    </strong>
                  </div>
                  <h2 className="mt-2 text-base font-bold leading-relaxed text-navy">
                    {question.statement}
                  </h2>
                </div>
              </header>

              <div className="space-y-5 p-5 sm:p-6">
                {question.type === "MULTIPLE_CHOICE" && (
                  <div className="space-y-3">
                    {question.options.map((option) => {
                      const selected = answer?.selectedOptionId === option.id;
                      const optionClass = option.isCorrect
                        ? "border-emerald-300 bg-emerald-50"
                        : selected
                          ? "border-red-300 bg-red-50"
                          : "border-slate-200 bg-slate-50/60";
                      return (
                        <div
                          key={option.id}
                          className={`rounded-xl border p-4 ${optionClass}`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${option.isCorrect ? "bg-emerald-600 text-white" : selected ? "bg-red-500 text-white" : "border border-slate-300 text-slate-400"}`}
                            >
                              {option.isCorrect ? (
                                <Check className="size-3.5" />
                              ) : selected ? (
                                <X className="size-3.5" />
                              ) : (
                                option.position
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-navy">
                                  {option.content}
                                </p>
                                {selected && (
                                  <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-slate-600 shadow-sm">
                                    Sua resposta
                                  </span>
                                )}
                                {option.isCorrect && (
                                  <span className="rounded-full bg-emerald-600 px-2 py-1 text-[9px] font-bold text-white">
                                    Alternativa correta
                                  </span>
                                )}
                              </div>
                              {option.explanation && (
                                <p
                                  className={`mt-2 text-xs leading-relaxed ${option.isCorrect ? "text-emerald-800" : selected ? "text-red-700" : "text-slate-500"}`}
                                >
                                  {option.explanation}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {question.type === "TRUE_FALSE" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AnswerBox
                      label="Sua resposta"
                      value={booleanLabel(answer?.booleanAnswer ?? null)}
                      correct={
                        answer?.booleanAnswer === question.correctBoolean
                      }
                    />
                    <AnswerBox
                      label="Resposta correta"
                      value={booleanLabel(question.correctBoolean)}
                      correct
                    />
                  </div>
                )}

                {question.type === "OPEN" && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Sua resposta
                      </span>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {answer?.textAnswer || "Não respondida"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Resposta-modelo
                      </span>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
                        {question.modelAnswer ?? "Não informada"}
                      </p>
                    </div>
                    {answer?.feedback && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 lg:col-span-2">
                        <strong className="text-xs text-blue-800">
                          Feedback da Lumina
                        </strong>
                        <p className="mt-2 text-sm leading-6 text-blue-900">
                          {answer.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {question.explanation && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Lightbulb className="size-4" />
                      <strong className="text-xs">
                        Por que essa é a resposta correta?
                      </strong>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {question.explanation}
                    </p>
                  </div>
                )}

                {question.sources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    <span className="mr-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <FileText className="size-3.5" /> Fontes
                    </span>
                    {question.sources.map((source) => (
                      <span
                        key={source.id}
                        className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600"
                      >
                        {source.chunk.material.title}
                        {source.pageStart ? ` · p. ${source.pageStart}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "success" | "danger" | "warning" | "neutral";
  icon: React.ReactNode;
}) {
  const colors =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "danger"
        ? "bg-red-50 text-red-700"
        : tone === "warning"
          ? "bg-orange-50 text-orange-700"
          : "bg-blue-50 text-blue-700";
  return (
    <article className="surface flex items-center gap-4 p-4">
      <span
        className={`grid size-11 place-items-center rounded-xl [&>svg]:size-5 ${colors}`}
      >
        {icon}
      </span>
      <div>
        <span className="text-xs text-slate-500">{label}</span>
        <strong className="mt-1 block text-xl text-navy">{value}</strong>
      </div>
    </article>
  );
}

function AnswerBox({
  label,
  value,
  correct,
}: {
  label: string;
  value: string;
  correct: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${correct ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}
    >
      <span
        className={`text-[10px] font-bold uppercase tracking-wider ${correct ? "text-emerald-700" : "text-red-700"}`}
      >
        {label}
      </span>
      <strong
        className={`mt-2 block text-sm ${correct ? "text-emerald-900" : "text-red-900"}`}
      >
        {value}
      </strong>
    </div>
  );
}
