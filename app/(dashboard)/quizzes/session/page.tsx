import { auth } from "@clerk/nextjs/server";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { QuizSession, type SessionQuestion } from "@/components/quiz-session";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { questionOptions, questions } from "@/lib/server/db/schema";

export const dynamic = "force-dynamic";

export default async function QuizSessionPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await auth.protect();
  const user = await getCurrentUser();
  const { id } = await searchParams;
  if (!id) return <Empty message="Escolha um quiz na sua biblioteca." />;
  const quiz = await db.query.quizzes.findFirst({ where: (table, { and, eq, isNull }) => and(eq(table.id, id), eq(table.ownerId, user.id), isNull(table.deletedAt)), with: { subject: true, quizVersion: { with: { questions: { orderBy: [asc(questions.position)], with: { questionOptions: { orderBy: [asc(questionOptions.position)] } } } } } } });
  if (!quiz?.quizVersion || quiz.status !== "READY") return <Empty message="Este quiz ainda não está pronto para execução." />;
  const sessionQuestions: SessionQuestion[] = quiz.quizVersion.questions.map((question) => ({ id: question.id, position: question.position, type: question.type, statement: question.statement, points: question.points, options: question.questionOptions.map(({ id: optionId, content, position }) => ({ id: optionId, content, position })) }));
  return <QuizSession quiz={{ id: quiz.id, title: quiz.title, subject: quiz.subject?.name ?? "Geral", questionCount: sessionQuestions.length }} questions={sessionQuestions} />;
}
function Empty({ message }: { message: string }) { return <div className="surface grid min-h-[500px] place-items-center p-8 text-center"><div><BookOpen className="mx-auto size-10 text-slate-300" /><h1 className="mt-4 text-lg font-bold text-navy">Quiz indisponível</h1><p className="mt-2 text-sm text-slate-500">{message}</p><Link href="/quizzes" className="secondary-button mt-5"><ArrowLeft className="size-4" /> Voltar aos quizzes</Link></div></div>; }
