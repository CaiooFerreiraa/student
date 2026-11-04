"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Eye,
  Scissors,
  Target,
} from "lucide-react";
import { pendingCount, toggleCut, type ConfirmedAnswer } from "@/domain/quiz/session-feedback";
import { readApiResponse } from "@/lib/api-client";

export type SessionQuestion = {
  id: string;
  position: number;
  type: string;
  statement: string;
  points: number;
  options: Array<{ id: string; content: string; position: number }>;
};

export function QuizSession({
  quiz,
  questions,
}: {
  quiz: { id: string; title: string; subject: string; questionCount: number };
  questions: SessionQuestion[];
}) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [confirmed, setConfirmed] = useState<Record<string, ConfirmedAnswer>>({});
  const [cuts, setCuts] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    id: string;
    percentage: string | number | null;
    correctCount: number;
    incorrectCount: number;
  } | null>(null);
  const question = questions[index]!;
  useEffect(() => {
    void fetch(`/api/quizzes/${quiz.id}/attempts`, { method: "POST" })
      .then((response) => readApiResponse<{ id: string }>(response))
      .then((body) => {
        if (!body.data) throw new Error("A tentativa não foi criada.");
        setAttemptId(body.data.id);
        return fetch(`/api/attempts/${body.data.id}/answers`);
      })
      .then((response) => readApiResponse<{ confirmed: ConfirmedAnswer[]; drafts: Array<{ questionId: string; selectedOptionId: string | null; booleanAnswer: boolean | null; textAnswer: string | null }> }>(response))
      .then((body) => {
        const saved = body.data?.confirmed ?? [];
        const restored = Object.fromEntries(saved.map((answer) => [answer.questionId, answer]));
        setConfirmed(restored);
        setAnswers(Object.fromEntries([...(body.data?.drafts ?? []), ...saved].map((answer) => [answer.questionId, answer.selectedOptionId ?? answer.booleanAnswer ?? answer.textAnswer ?? ""])));
        const savedIndex = Number(window.sessionStorage.getItem(`quiz-position:${quiz.id}`));
        if (Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < questions.length) setIndex(savedIndex);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Falha ao iniciar tentativa.",
        ),
      );
  }, [quiz.id, questions.length]);

  function goTo(nextIndex: number): void {
    if (busy) return;
    setError(null);
    setShowFinish(false);
    setIndex(nextIndex);
    window.sessionStorage.setItem(`quiz-position:${quiz.id}`, String(nextIndex));
  }

  async function confirmCurrent(): Promise<void> {
    if (!attemptId || busy || confirmed[question.id]) return;
    const answer = answers[question.id];
    if (answer === undefined || answer === "") return;
    const body =
      question.type === "MULTIPLE_CHOICE"
        ? { questionId: question.id, selectedOptionId: answer }
        : question.type === "TRUE_FALSE"
          ? { questionId: question.id, booleanAnswer: answer }
          : { questionId: question.id, textAnswer: answer };
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/attempts/${attemptId}/answers`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await readApiResponse<ConfirmedAnswer>(response);
      if (!result.data) throw new Error("A confirmação não foi retornada.");
      setConfirmed((current) => ({ ...current, [question.id]: result.data! }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao confirmar resposta.");
    } finally {
      setBusy(false);
    }
  }
  async function finish(): Promise<void> {
    if (!attemptId || busy) return;
    setBusy(true);
    setShowFinish(false);
    try {
        const response = await fetch(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
        });
        const body = await readApiResponse<{
          id: string;
          percentage: string | number | null;
          correctCount: number;
          incorrectCount: number;
        }>(response);
        if (!body.data)
          throw new Error("O resultado da tentativa não foi retornado.");
        setResult(body.data);
        window.sessionStorage.removeItem(`quiz-position:${quiz.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao finalizar.");
    } finally {
      setBusy(false);
    }
  }
  const feedback = confirmed[question.id];
  if (result)
    return (
      <div className="surface grid min-h-[600px] place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-50 text-2xl font-extrabold text-emerald-600">
            {Math.round(Number(result.percentage ?? 0))}%
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-navy">
            Tentativa concluída
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {result.correctCount} acertos e {result.incorrectCount} erros. A
            próxima revisão foi agendada.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={`/quizzes/review?id=${result.id}`}
              className="primary-button"
            >
              <Eye className="size-4" /> Ver correção completa
            </Link>
            <Link href="/quizzes" className="secondary-button">
              Voltar à biblioteca
            </Link>
          </div>
        </div>
      </div>
    );
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        <header className="surface p-5">
          <div className="flex items-center gap-3">
            <Link
              href="/quizzes"
              className="grid size-9 place-items-center rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">{quiz.subject}</p>
              <h1 className="truncate text-base font-bold text-navy">
                {quiz.title}
              </h1>
            </div>
            <span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
              {index + 1} / {questions.length}
            </span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>
        </header>
        <main className="surface p-5 sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
            <Target className="size-3.5" />
            {question.type === "MULTIPLE_CHOICE"
              ? "Múltipla escolha"
              : question.type === "TRUE_FALSE"
                ? "Verdadeiro ou falso"
                : "Questão aberta"}
          </span>
          <h2 className="mt-5 text-xl font-extrabold leading-snug text-navy sm:text-2xl">
            {question.statement}
          </h2>
          <div className="mt-6 space-y-3">
            {question.type === "MULTIPLE_CHOICE" &&
              question.options.map((option) => (
                <div key={option.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    aria-pressed={answers[question.id] === option.id}
                    disabled={Boolean(feedback) || busy || (cuts[question.id] ?? []).includes(option.id)}
                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                    className={`flex min-h-14 min-w-0 flex-1 items-center gap-4 rounded-xl border px-4 text-left text-sm font-medium disabled:cursor-default ${feedback?.resolution?.correctOptionId === option.id ? "border-emerald-500 bg-emerald-50 text-emerald-900" : feedback?.selectedOptionId === option.id && !feedback.isCorrect ? "border-red-500 bg-red-50 text-red-900" : answers[question.id] === option.id ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 hover:border-blue-200"} ${(cuts[question.id] ?? []).includes(option.id) ? "line-through opacity-50" : ""}`}
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full border border-current">
                      {answers[question.id] === option.id && <Check className="size-3" />}
                    </span>
                    {option.content}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(feedback) || busy || answers[question.id] === option.id}
                    aria-label={`${(cuts[question.id] ?? []).includes(option.id) ? "Desfazer corte" : "Cortar"} alternativa ${option.position}`}
                    aria-pressed={(cuts[question.id] ?? []).includes(option.id)}
                    onClick={() => setCuts((current) => toggleCut(current, question.id, option.id))}
                    className="grid w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Scissors className="size-4" />
                  </button>
                </div>
              ))}
            {question.type === "TRUE_FALSE" &&
              [true, false].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={answers[question.id] === value}
                  disabled={Boolean(feedback) || busy}
                  onClick={() =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: value,
                    }))
                  }
                  className={`min-h-14 w-full rounded-xl border px-4 text-left text-sm font-semibold ${answers[question.id] === value ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200"}`}
                >
                  {value ? "Verdadeiro" : "Falso"}
                </button>
              ))}
            {question.type === "OPEN" && (
              <textarea
                disabled={Boolean(feedback) || busy}
                value={String(answers[question.id] ?? "")}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: event.target.value,
                  }))
                }
                placeholder="Escreva sua resposta..."
                className="min-h-48 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-blue-500"
              />
            )}
          </div>
          {feedback && (
            <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-live="polite">
              <strong className={`text-sm ${feedback.isCorrect === true ? "text-emerald-700" : feedback.isCorrect === false ? "text-red-700" : "text-blue-700"}`}>
                {feedback.isCorrect === true ? "Resposta correta" : feedback.isCorrect === false ? "Resposta incorreta" : feedback.gradingStatus === "PENDING" ? "Resposta salva · correção pendente" : "Resposta confirmada"}
              </strong>
              {feedback.resolution && (
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <h3 className="font-bold text-navy">Resolução</h3>
                  {feedback.resolution.explanation && <p className="whitespace-pre-wrap">{feedback.resolution.explanation}</p>}
                  {question.type === "TRUE_FALSE" && <p>Gabarito: {feedback.resolution.correctBoolean ? "Verdadeiro" : "Falso"}</p>}
                  {feedback.resolution.options.map((item) => {
                    const option = question.options.find((candidate) => candidate.id === item.id);
                    return item.explanation && option ? <p key={item.id}><strong>Alternativa {option.position}:</strong> {item.explanation}</p> : null;
                  })}
                  {feedback.resolution.sources.length > 0 && <p>Fontes: {feedback.resolution.sources.map((source) => `${source.title}${source.pageStart ? ` · p. ${source.pageStart}` : ""}`).join("; ")}</p>}
                </div>
              )}
            </section>
          )}
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              disabled={index === 0 || busy}
              onClick={() => goTo(index - 1)}
              className="secondary-button disabled:opacity-40"
            >
              <ArrowLeft className="size-4" /> Anterior
            </button>
            <div className="flex flex-wrap gap-2">
              {!feedback && <button type="button" disabled={!attemptId || busy || answers[question.id] === undefined || answers[question.id] === ""} onClick={() => void confirmCurrent()} className="primary-button disabled:opacity-40">{busy ? "Aguarde..." : "Confirmar resposta"}</button>}
              <button
                type="button"
                disabled={!attemptId || busy}
                onClick={() => index === questions.length - 1 ? pendingCount(questions.map((item) => item.id), confirmed) > 0 ? setShowFinish(true) : void finish() : goTo(index + 1)}
                className="secondary-button disabled:opacity-40"
              >
                {index === questions.length - 1 ? "Finalizar" : "Próxima"} <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
          {showFinish && <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>Há {pendingCount(questions.map((item) => item.id), confirmed)} questão(ões) sem confirmação. Deseja entregar mesmo assim?</p>
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setShowFinish(false)} className="secondary-button">Continuar respondendo</button><button type="button" onClick={() => void finish()} className="primary-button">Entregar tentativa</button></div>
          </div>}
        </main>
      </div>
      <aside className="surface h-fit p-5 xl:sticky xl:top-24">
        <h2 className="section-title">Mapa de questões</h2>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {questions.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Ir para questão ${item.position}${confirmed[item.id] ? ", confirmada" : ", pendente"}`}
              disabled={busy}
              onClick={() => goTo(itemIndex)}
              className={`aspect-square rounded-xl border text-xs font-bold ${itemIndex === index ? "border-blue-600 bg-blue-600 text-white" : confirmed[item.id] ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}
            >
              {item.position}
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          <Clock3 className="size-4 text-blue-600" />
          Confirme para salvar. Avance sem esperar.
        </div>
      </aside>
    </div>
  );
}
