"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useState } from "react";
import {
  Camera,
  Check,
  FileText,
  PenLine,
  Plus,
  Send,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { readApiResponse } from "@/lib/api-client";

export type EssayAssignmentItem = {
  id: string;
  title: string;
  prompt: string;
  type: string;
  rubric: string;
  maximumScore: number;
};
export type EssaySubmissionItem = {
  id: string;
  assignmentTitle: string;
  inputType: string;
  status: string;
  score: number | null;
  startedAt: string;
};
export type EssayRubricItem = {
  id: string;
  name: string;
  version: number;
  type: string;
  maximumScore: number;
};
type SubmissionDetail = {
  id: string;
  status: string;
  confirmedText: string | null;
  transcriptions: Array<{
    normalizedText: string;
    confidence: string | number | null;
    uncertainSegments: unknown;
  }>;
  finalEvaluation: null | {
    totalScore: number | null;
    summary: string | null;
    strengths: string[] | null;
    improvementPlan: string[] | null;
    scores: Array<{
      score: number;
      feedback: string;
      criterion: { code: string; name: string; maximumScore: number };
    }>;
  };
};

function safe(name: string): string {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export function EssayWorkspace({
  userId,
  assignments,
  rubrics,
  initialSubmissions,
  blobEnabled,
  aiEnabled,
}: {
  userId: string;
  assignments: EssayAssignmentItem[];
  rubrics: EssayRubricItem[];
  initialSubmissions: EssaySubmissionItem[];
  blobEnabled: boolean;
  aiEnabled: boolean;
}) {
  const [assignmentOptions, setAssignmentOptions] = useState(assignments);
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? "");
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [savingProposal, setSavingProposal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalPrompt, setProposalPrompt] = useState("");
  const [proposalRubricId, setProposalRubricId] = useState(rubrics[0]?.id ?? "");
  const [inputType, setInputType] = useState("TEXT");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [selectedId, setSelectedId] = useState(
    initialSubmissions[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const configurationNotice = aiEnabled
    ? null
    : "Configure OPENAI_API_KEY para transcrever imagens e corrigir redações.";
  const assignment = assignmentOptions.find((item) => item.id === assignmentId);

  async function createProposal(): Promise<void> {
    const title = proposalTitle.trim();
    const prompt = proposalPrompt.trim();
    const rubric = rubrics.find((item) => item.id === proposalRubricId);
    if (title.length < 3) {
      toast.error("Informe um título com pelo menos 3 caracteres.");
      return;
    }
    if (prompt.length < 20) {
      toast.error("Descreva a proposta em pelo menos 20 caracteres.");
      return;
    }
    if (!rubric) {
      toast.error("Nenhuma rubrica ativa está disponível.");
      return;
    }

    setSavingProposal(true);
    try {
      const response = await fetch("/api/essays/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          prompt,
          rubricId: rubric.id,
          essayType: rubric.type,
        }),
      });
      const result = await readApiResponse<{ id: string; title: string; prompt: string; essayType: string }>(response);
      if (!result.data) throw new Error("A proposta não pôde ser criada.");
      const item: EssayAssignmentItem = {
        id: result.data.id,
        title: result.data.title,
        prompt: result.data.prompt,
        type: result.data.essayType,
        rubric: `${rubric.name} ${rubric.version}`,
        maximumScore: rubric.maximumScore,
      };
      setAssignmentOptions((current) => [item, ...current.filter((assignmentItem) => assignmentItem.id !== item.id)]);
      setAssignmentId(item.id);
      setProposalTitle("");
      setProposalPrompt("");
      setCreatingProposal(false);
      toast.success("Proposta criada");
    } catch (error) {
      toast.error("Falha ao criar proposta", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSavingProposal(false);
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/essays/submissions/${selectedId}`);
        const result = await readApiResponse<SubmissionDetail>(response);
        if (active && result.data) {
          setDetail(result.data);
          if (["EXTRACTING", "GRADING"].includes(result.data.status))
            setTimeout(load, 3000);
        }
      } catch (error) {
        if (active)
          toast.error("Falha ao carregar a redação", {
            description:
              error instanceof Error ? error.message : "Tente novamente.",
          });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [selectedId]);

  async function submit(): Promise<void> {
    setBusy(true);
    try {
      if (!assignmentId) throw new Error("Escolha uma proposta.");
      if (inputType === "TEXT" && text.trim().length < 20)
        throw new Error("A redação está muito curta.");
      if (inputType !== "TEXT" && !files.length)
        throw new Error("Selecione ao menos um arquivo.");
      if (inputType !== "TEXT" && !blobEnabled)
        throw new Error(
          "Configure BLOB_READ_WRITE_TOKEN para enviar arquivos.",
        );
      const createResponse = await fetch("/api/essays/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          inputType,
          text: inputType === "TEXT" ? text : undefined,
        }),
      });
      const created = await readApiResponse<{ id: string }>(createResponse);
      if (!created.data) throw new Error("A submissão não foi criada.");
      const submissionId = created.data.id;
      for (const [position, file] of files.entries()) {
        const pathname = `users/${userId}/essays/${submissionId}/${crypto.randomUUID()}-${safe(file.name)}`;
        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: "/api/blob/essay-upload",
          clientPayload: JSON.stringify({
            submissionId,
            originalName: file.name,
            position,
          }),
        });
        const complete = await fetch(
          `/api/essays/submissions/${submissionId}/files/complete`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...blob,
              size: file.size,
              originalName: file.name,
              position,
            }),
          },
        );
        await readApiResponse<{ id: string }>(complete);
      }
      const transcribe = await fetch(
        `/api/essays/submissions/${submissionId}/transcribe`,
        { method: "POST" },
      );
      await readApiResponse<{ id: string; status: string }>(transcribe);
      const item: EssaySubmissionItem = {
        id: submissionId,
        assignmentTitle: assignment?.title ?? "Redação",
        inputType,
        status: "EXTRACTING",
        score: null,
        startedAt: new Date().toISOString(),
      };
      setSubmissions((current) => [item, ...current]);
      setSelectedId(submissionId);
      setText("");
      setFiles([]);
      toast.success("Redação recebida", {
        description: "A transcrição foi iniciada.",
      });
    } catch (error) {
      toast.error("Falha ao enviar redação", {
        description:
          error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(): Promise<void> {
    if (!detail?.transcriptions[0]) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/essays/submissions/${detail.id}/confirm`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: detail.transcriptions[0].normalizedText,
          }),
        },
      );
      await readApiResponse(response);
      setDetail({
        ...detail,
        status: "READY_TO_GRADE",
        confirmedText: detail.transcriptions[0].normalizedText,
      });
      toast.success("Transcrição confirmada");
    } catch (error) {
      toast.error("Falha ao confirmar transcrição", {
        description:
          error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }
  async function grade(): Promise<void> {
    if (!detail) return;
    if (!aiEnabled) {
      toast.error("Correção indisponível", {
        description: "Configure OPENAI_API_KEY para corrigir a redação.",
      });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(
        `/api/essays/submissions/${detail.id}/grade`,
        { method: "POST" },
      );
      await readApiResponse(response);
      setDetail({ ...detail, status: "GRADING" });
      toast.info("Correção iniciada", {
        description: "A Lumina está avaliando sua redação.",
      });
    } catch (error) {
      toast.error("Falha ao iniciar correção", {
        description:
          error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        {configurationNotice && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            {configurationNotice}
          </div>
        )}
        <section className="surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">Nova redação</h2>
            <button
              type="button"
              disabled={!rubrics.length}
              onClick={() => setCreatingProposal((current) => !current)}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-primary/40 px-3 text-xs font-bold text-primary transition hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-3.5" /> {creatingProposal ? "Cancelar" : "Nova proposta"}
            </button>
          </div>
          {creatingProposal && (
            <div className="mt-4 space-y-3 rounded-2xl border border-border bg-muted p-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-navy">Título da proposta</span>
                <input value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} maxLength={180} placeholder="Ex.: Desafios da educação digital" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-navy">Tema ou enunciado</span>
                <textarea value={proposalPrompt} onChange={(event) => setProposalPrompt(event.target.value)} maxLength={10_000} placeholder="Descreva o tema, o recorte e o que deve ser discutido..." className="min-h-24 w-full resize-none rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-navy">Rubrica de correção</span>
                <select value={proposalRubricId} onChange={(event) => setProposalRubricId(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary">
                  {rubrics.map((rubric) => <option key={rubric.id} value={rubric.id}>{rubric.name} · versão {rubric.version}</option>)}
                </select>
              </label>
              <button type="button" disabled={savingProposal} onClick={() => void createProposal()} className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="size-4" /> {savingProposal ? "Criando..." : "Criar e selecionar proposta"}
              </button>
            </div>
          )}
          <label className="mt-5 block">
            <span className="mb-2 block text-xs font-bold text-navy">
              Proposta
            </span>
            <select
              value={assignmentId}
              onChange={(event) => setAssignmentId(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
            >
              {!assignmentOptions.length && <option value="">Nenhuma proposta criada</option>}
              {assignmentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          {assignment && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <strong className="text-xs text-navy">{assignment.rubric}</strong>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {assignment.prompt}
              </p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["TEXT", <PenLine key="text" />, "Digitar"],
              ["DOCX", <FileText key="docx" />, "DOCX"],
              ["IMAGE", <Camera key="image" />, "Imagem"],
            ].map(([value, icon, label]) => (
              <button
                key={String(value)}
                onClick={() => {
                  setInputType(String(value));
                  setFiles([]);
                }}
                className={`flex min-h-16 items-center justify-center gap-2 rounded-xl border text-sm font-semibold [&>svg]:size-4 ${inputType === value ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground"}`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          {inputType === "TEXT" ? (
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Escreva sua redação..."
              className="mt-4 min-h-80 w-full rounded-xl border border-slate-200 p-4 text-sm leading-7 outline-none focus:border-blue-500"
            />
          ) : (
            <label className="mt-4 grid min-h-40 cursor-pointer place-items-center rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-6 text-center">
              <input
                type="file"
                multiple={inputType === "IMAGE"}
                accept={
                  inputType === "IMAGE" ? ".jpg,.jpeg,.png,.webp" : ".docx"
                }
                className="hidden"
                onChange={(event) =>
                  setFiles(Array.from(event.target.files ?? []))
                }
              />
              <span>
                <UploadCloud className="mx-auto size-7 text-blue-600" />
                <strong className="mt-3 block text-sm text-navy">
                  {files.length
                    ? files.map((file) => file.name).join(", ")
                    : "Selecionar arquivo"}
                </strong>
                <small className="mt-1 block text-slate-500">
                  {inputType === "IMAGE"
                    ? "Até 10 imagens em ordem"
                    : "Documento DOCX"}
                </small>
              </span>
            </label>
          )}
          <button
            disabled={busy}
            onClick={() => void submit()}
            className="primary-button mt-5 w-full"
          >
            <Send className="size-4" />
            {busy ? "Processando..." : "Enviar redação"}
          </button>
        </section>
        <section className="surface p-5">
          <h2 className="section-title mb-4">Histórico</h2>
          {submissions.length ? (
            <div className="divide-y divide-slate-100">
              {submissions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`flex w-full items-center gap-3 py-3 text-left ${selectedId === item.id ? "text-blue-700" : "text-navy"}`}
                >
                  <FileText className="size-4" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs">
                      {item.assignmentTitle}
                    </strong>
                    <small className="text-[10px] text-slate-500">
                      {item.inputType} · {item.status}
                    </small>
                  </span>
                  {item.score != null && (
                    <strong className="text-sm text-emerald-600">
                      {item.score}
                    </strong>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nenhuma redação enviada.</p>
          )}
        </section>
      </div>
      <aside className="surface h-fit p-5 xl:sticky xl:top-24">
        <h2 className="section-title">Acompanhamento</h2>
        {!detail ? (
          <p className="mt-4 text-sm text-slate-500">
            Selecione uma redação do histórico.
          </p>
        ) : (
          <div className="mt-4">
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
              {detail.status}
            </span>
            {detail.status === "NEEDS_REVIEW" && detail.transcriptions[0] && (
              <div className="mt-4">
                <p className="text-xs font-bold text-navy">
                  Revise a transcrição
                </p>
                <textarea
                  value={detail.transcriptions[0].normalizedText}
                  onChange={(event) =>
                    setDetail({
                      ...detail,
                      transcriptions: [
                        {
                          ...detail.transcriptions[0]!,
                          normalizedText: event.target.value,
                        },
                      ],
                    })
                  }
                  className="mt-2 min-h-80 w-full rounded-xl border border-slate-200 p-3 text-xs leading-6"
                />
                <button
                  disabled={busy}
                  onClick={() => void confirm()}
                  className="primary-button mt-3 w-full"
                >
                  <Check className="size-4" /> Confirmar texto
                </button>
              </div>
            )}
            {detail.status === "READY_TO_GRADE" && (
              <button
                disabled={busy}
                onClick={() => void grade()}
                className="primary-button mt-4 w-full"
              >
                <Sparkles className="size-4" /> Corrigir com a Lumina
              </button>
            )}
            {detail.status === "GRADING" && (
              <p className="mt-4 text-sm text-slate-500">
                A correção estruturada está em andamento...
              </p>
            )}
            {detail.finalEvaluation && (
              <div className="mt-5">
                <div className="rounded-2xl bg-emerald-50 p-5 text-center">
                  <strong className="text-4xl text-emerald-600">
                    {detail.finalEvaluation.totalScore}
                  </strong>
                  <span className="block text-xs text-emerald-700">
                    pontos estimados
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  {detail.finalEvaluation.summary}
                </p>
                <div className="mt-4 space-y-3">
                  {detail.finalEvaluation.scores.map((score) => (
                    <div
                      key={score.criterion.code}
                      className="rounded-xl border border-slate-100 p-3"
                    >
                      <div className="flex justify-between text-xs">
                        <strong>
                          {score.criterion.code} · {score.criterion.name}
                        </strong>
                        <span className="font-bold text-blue-600">
                          {score.score}/{score.criterion.maximumScore}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        {score.feedback}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[10px] text-slate-400">
                  Estimativa pedagógica; não representa nota oficial do Inep.
                </p>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
