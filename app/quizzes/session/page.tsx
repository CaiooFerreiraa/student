import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { QuizSession, type SessionQuestion } from "@/components/quiz-session";
import { getCurrentUser } from "@/lib/server/current-user";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export default async function QuizSessionPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await getCurrentUser();
  const { id } = await searchParams;
  if (!id) return <Empty message="Escolha um quiz na sua biblioteca." />;
  const quiz = await prisma.quiz.findFirst({ where: { id, ownerId: user.id, deletedAt: null }, include: { subject: true, currentVersion: { include: { questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" }, select: { id: true, content: true, position: true } } } } } } } });
  if (!quiz?.currentVersion || quiz.status !== "READY") return <Empty message="Este quiz ainda não está pronto para execução." />;
  const questions: SessionQuestion[] = quiz.currentVersion.questions.map((question) => ({ id: question.id, position: question.position, type: question.type, statement: question.statement, points: question.points, options: question.options }));
  return <QuizSession quiz={{ id: quiz.id, title: quiz.title, subject: quiz.subject?.name ?? "Geral", questionCount: questions.length }} questions={questions} />;
}
function Empty({ message }: { message: string }) { return <div className="surface grid min-h-[500px] place-items-center p-8 text-center"><div><BookOpen className="mx-auto size-10 text-slate-300" /><h1 className="mt-4 text-lg font-bold text-navy">Quiz indisponível</h1><p className="mt-2 text-sm text-slate-500">{message}</p><Link href="/quizzes" className="secondary-button mt-5"><ArrowLeft className="size-4" /> Voltar aos quizzes</Link></div></div>; }
