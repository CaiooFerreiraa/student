"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Eye,
  Target,
} from "lucide-react";
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
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Falha ao iniciar tentativa.",
        ),
      );
  }, [quiz.id]);

  async function saveCurrent(): Promise<void> {
    if (!attemptId) return;
    const answer = answers[question.id];
    if (answer === undefined || answer === "") return;
    const body =
      question.type === "MULTIPLE_CHOICE"
        ? { questionId: question.id, selectedOptionId: answer }
        : question.type === "TRUE_FALSE"
          ? { questionId: question.id, booleanAnswer: answer }
          : { questionId: question.id, textAnswer: answer };
    const response = await fetch(`/api/attempts/${attemptId}/answers`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await readApiResponse(response);
  }
  async function next(): Promise<void> {
    try {
      await saveCurrent();
      if (index < questions.length - 1) setIndex(index + 1);
      else if (attemptId) {
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
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao avançar.");
    }
  }
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
                <button
                  key={option.id}
                  onClick={() =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: option.id,
                    }))
                  }
                  className={`flex min-h-14 w-full items-center gap-4 rounded-xl border px-4 text-left text-sm font-medium ${answers[question.id] === option.id ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 hover:border-blue-200"}`}
                >
                  <span
                    className={`grid size-5 place-items-center rounded-full border ${answers[question.id] === option.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}
                  >
                    {answers[question.id] === option.id && (
                      <Check className="size-3" />
                    )}
                  </span>
                  {option.content}
                </button>
              ))}
            {question.type === "TRUE_FALSE" &&
              [true, false].map((value) => (
                <button
                  key={String(value)}
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
          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="mt-7 flex justify-between border-t border-slate-100 pt-5">
            <button
              disabled={index === 0}
              onClick={() => setIndex(Math.max(0, index - 1))}
              className="secondary-button disabled:opacity-40"
            >
              <ArrowLeft className="size-4" /> Anterior
            </button>
            <button
              disabled={!attemptId}
              onClick={() => void next()}
              className="primary-button"
            >
              {index === questions.length - 1 ? "Finalizar" : "Próxima"}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </main>
      </div>
      <aside className="surface h-fit p-5 xl:sticky xl:top-24">
        <h2 className="section-title">Mapa de questões</h2>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {questions.map((item, itemIndex) => (
            <button
              key={item.id}
              onClick={() => setIndex(itemIndex)}
              className={`aspect-square rounded-xl border text-xs font-bold ${itemIndex === index ? "border-blue-600 bg-blue-600 text-white" : answers[item.id] !== undefined ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}
            >
              {item.position}
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          <Clock3 className="size-4 text-blue-600" />
          As respostas são salvas ao avançar.
        </div>
      </aside>
    </div>
  );
}
