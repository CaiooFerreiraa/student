"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Play, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { readApiResponse } from "@/lib/api-client";

export function QuizCardActions({
  quizId,
  ready,
  generating,
  hasAttempt,
}: {
  quizId: string;
  ready: boolean;
  generating: boolean;
  hasAttempt: boolean;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const isGenerating = generating || starting;

  useEffect(() => {
    if (!isGenerating) return;
    let stopped = false;
    let timeout: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (document.hidden) { timeout = setTimeout(check, 5_000); return; }
      try {
        const response = await fetch(`/api/quizzes/${quizId}/status`, { cache: "no-store" });
        if (response.ok) {
          const status = await response.json() as { generating: boolean };
          if (!stopped && !status.generating) { router.refresh(); return; }
        }
      } catch {
        // A próxima tentativa consulta o estado novamente.
      } finally {
        if (!stopped) timeout = setTimeout(check, 5_000);
      }
    };
    timeout = setTimeout(check, 5_000);
    return () => { stopped = true; clearTimeout(timeout); };
  }, [isGenerating, quizId, router]);

  async function retryGeneration(): Promise<void> {
    setStarting(true);
    try {
      const response = await fetch(`/api/quizzes/${quizId}/generate`, {
        method: "POST",
      });
      await readApiResponse(response);
      toast.info("Geração iniciada", {
        description:
          "As questões aparecerão automaticamente quando estiverem prontas.",
      });
      router.refresh();
    } catch (error) {
      setStarting(false);
      toast.error("Falha ao gerar questões", {
        description:
          error instanceof Error ? error.message : "Tente novamente.",
      });
    }
  }

  if (ready) {
    return (
      <Link
        href={`/quizzes/session?id=${quizId}`}
        className="primary-button min-h-10 flex-1 px-3"
      >
        {hasAttempt ? (
          <RotateCcw className="size-4" />
        ) : (
          <Play className="size-4" />
        )}
        {hasAttempt ? "Refazer" : "Começar"}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={isGenerating}
      onClick={() => void retryGeneration()}
      className="primary-button min-h-10 flex-1 cursor-pointer px-3 disabled:cursor-wait disabled:opacity-70"
    >
      {isGenerating ? (
        <RefreshCw className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {isGenerating ? "Gerando questões" : "Gerar questões"}
    </button>
  );
}
