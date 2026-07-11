"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  File,
  FileText,
  HardDrive,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { readApiResponse } from "@/lib/api-client";

export type MaterialListItem = {
  id: string;
  title: string;
  subject: string;
  size: number;
  type: string;
  status: string;
  pageCount: number | null;
  chunkCount: number;
  error: string | null;
  createdAt: string;
};

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function safeFilename(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
}

export function MaterialsLibrary({
  userId,
  initialMaterials,
  blobEnabled,
}: {
  userId: string;
  initialMaterials: MaterialListItem[];
  blobEnabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [materials, setMaterials] = useState(initialMaterials);
  const [selectedId, setSelectedId] = useState(initialMaterials[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const selected =
    materials.find((material) => material.id === selectedId) ?? null;
  const filtered = useMemo(
    () =>
      materials.filter((material) =>
        material.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [materials, query],
  );
  const totalBytes = materials.reduce(
    (sum, material) => sum + material.size,
    0,
  );
  const hasProcessingMaterials = materials.some(
    (material) =>
      material.status === "PENDING" || material.status === "PROCESSING",
  );

  useEffect(() => {
    if (!hasProcessingMaterials) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch("/api/materials", { cache: "no-store" });
        const result = await readApiResponse<MaterialListItem[]>(response);
        if (cancelled || !result.data) return;
        setMaterials(result.data);
        if (
          result.data.some(
            (material) =>
              material.status === "PENDING" || material.status === "PROCESSING",
          )
        ) {
          timeout = setTimeout(() => void refresh(), 2_000);
        }
      } catch {
        if (!cancelled) timeout = setTimeout(() => void refresh(), 4_000);
      }
    };

    timeout = setTimeout(() => void refresh(), 1_000);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [hasProcessingMaterials]);

  async function onFile(file: File): Promise<void> {
    if (!blobEnabled) {
      toast.error("Upload indisponível", {
        description: "Configure BLOB_READ_WRITE_TOKEN para habilitar uploads.",
      });
      return;
    }
    const normalizedSubject = subjectName.trim().replace(/\s+/g, " ");
    if (normalizedSubject.length < 2) {
      toast.error("Matéria obrigatória", {
        description: "Informe a matéria antes de escolher o arquivo.",
      });
      return;
    }
    setProgress(0);
    try {
      const pathname = `users/${userId}/materials/${crypto.randomUUID()}-${safeFilename(file.name)}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({
          originalName: file.name,
          subjectName: normalizedSubject,
        }),
        multipart: file.size > 100 * 1024 * 1024,
        onUploadProgress: ({ percentage }) =>
          setProgress(Math.round(percentage)),
      });
      const response = await fetch("/api/materials/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...blob,
          size: file.size,
          originalName: file.name,
          subjectName: normalizedSubject,
        }),
      });
      const result = await readApiResponse<{ id: string }>(response);
      if (!result.data) throw new Error("O material não foi registrado.");
      const item: MaterialListItem = {
        id: result.data.id,
        title: file.name.replace(/\.[^.]+$/, ""),
        subject: normalizedSubject,
        size: file.size,
        type: file.name.split(".").at(-1)?.toUpperCase() ?? "FILE",
        status: "PENDING",
        pageCount: null,
        chunkCount: 0,
        error: null,
        createdAt: new Date().toISOString(),
      };
      setMaterials((current) => [
        item,
        ...current.filter((material) => material.id !== item.id),
      ]);
      setSelectedId(item.id);
      setSubjectName("");
      toast.success("Upload concluído", {
        description:
          "O conteúdo está sendo processado e a lista será atualizada automaticamente.",
      });
    } catch (error) {
      toast.error("Falha no upload", {
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar o arquivo.",
      });
    } finally {
      setProgress(null);
    }
  }

  async function removeMaterial(material: MaterialListItem): Promise<void> {
    if (material.status === "PROCESSING" || deletingId) return;
    toast.warning("Excluir material?", {
      description: `“${material.title}” e os dados processados serão removidos.`,
      action: {
        label: "Excluir",
        onClick: () => void confirmMaterialRemoval(material),
      },
    });
  }

  async function confirmMaterialRemoval(
    material: MaterialListItem,
  ): Promise<void> {
    if (material.status === "PROCESSING" || deletingId) return;
    setDeletingId(material.id);
    try {
      const response = await fetch(`/api/materials/${material.id}`, {
        method: "DELETE",
      });
      if (!response.ok) await readApiResponse(response);
      setMaterials((current) => {
        const remaining = current.filter((item) => item.id !== material.id);
        setSelectedId((selected) =>
          selected === material.id ? (remaining[0]?.id ?? null) : selected,
        );
        return remaining;
      });
      toast.success("Material excluído", {
        description: "A remoção do arquivo foi agendada.",
      });
    } catch (error) {
      toast.error("Falha ao excluir", {
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir o material.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_.7fr_.7fr]">
        <div className="min-h-48 rounded-2xl border border-dashed border-blue-300 bg-blue-50/40 p-5 transition hover:border-blue-400">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.txt"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = "";
            }}
          />
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-white text-blue-600 shadow-sm">
              <BookOpen className="size-5" />
            </span>
            <div>
              <strong className="block text-sm text-navy">
                Enviar novo material
              </strong>
              <small className="text-slate-500">
                Identifique a matéria antes do arquivo
              </small>
            </div>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Matéria
            </span>
            <input
              value={subjectName}
              onChange={(event) => setSubjectName(event.target.value)}
              maxLength={100}
              placeholder="Ex.: Direito Constitucional"
              className="h-11 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-navy outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
          <button
            type="button"
            disabled={progress !== null || subjectName.trim().length < 2}
            onClick={() => inputRef.current?.click()}
            className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud className="size-4" />
            {progress !== null ? `Enviando: ${progress}%` : "Escolher arquivo"}
          </button>
          <small className="mt-2 block text-center text-[10px] text-slate-500">
            PDF, DOCX, imagem ou texto · até 250 MB
          </small>
        </div>
        <Summary
          icon={<FileText />}
          label="Materiais"
          value={String(materials.length)}
          detail={`${materials.filter((item) => item.status === "READY").length} prontos`}
        />
        <Summary
          icon={<HardDrive />}
          label="Armazenamento"
          value={formatBytes(totalBytes)}
          detail="arquivos privados"
        />
      </section>
      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <h2 className="section-title">Biblioteca</h2>
          <label className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar materiais"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-blue-400 sm:w-64"
            />
          </label>
        </div>
        {filtered.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <FileText className="mx-auto size-8 text-slate-300" />
              <strong className="mt-3 block text-sm text-navy">
                Nenhum material encontrado
              </strong>
              <p className="mt-1 text-xs text-slate-500">
                Envie seu primeiro documento para começar.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid xl:grid-cols-[minmax(0,1fr)_310px]">
            <div className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`grid w-full cursor-pointer grid-cols-[40px_minmax(150px,1fr)_110px_110px] items-center gap-3 p-4 text-left text-xs transition hover:bg-slate-50 ${item.id === selectedId ? "bg-blue-50/60" : ""}`}
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                    <File className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-navy">
                      {item.title}
                    </strong>
                    <small className="text-[10px] text-slate-500">
                      {item.type} · {formatBytes(item.size)}
                    </small>
                  </span>
                  <span className="truncate text-slate-500">
                    {item.subject}
                  </span>
                  <Status status={item.status} />
                </button>
              ))}
            </div>
            <aside className="border-t border-slate-100 p-5 xl:border-l xl:border-t-0">
              {selected ? (
                <>
                  <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                    <FileText className="size-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-navy">
                    {selected.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {selected.type} · {formatBytes(selected.size)}
                  </p>
                  <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-xs">
                    <Detail label="Matéria" value={selected.subject} />
                    <Detail label="Status" value={selected.status} />
                    <Detail
                      label="Páginas"
                      value={String(selected.pageCount ?? "—")}
                    />
                    <Detail
                      label="Trechos indexados"
                      value={String(selected.chunkCount)}
                    />
                    <Detail
                      label="Enviado"
                      value={new Date(selected.createdAt).toLocaleDateString(
                        "pt-BR",
                      )}
                    />
                  </div>
                  {selected.error && (
                    <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                      {selected.error}
                    </div>
                  )}
                  <div className="mt-5 rounded-xl bg-violet-50 p-4 text-xs text-violet-800">
                    <Sparkles className="mb-2 size-4" />
                    Quando o processamento terminar, este material ficará
                    disponível para a Lumina e para geração de quizzes.
                  </div>
                  <button
                    type="button"
                    disabled={
                      selected.status === "PROCESSING" ||
                      deletingId === selected.id
                    }
                    onClick={() => void removeMaterial(selected)}
                    className="mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <Trash2 className="size-4" />
                    {deletingId === selected.id
                      ? "Excluindo..."
                      : selected.status === "PROCESSING"
                        ? "Processamento em andamento"
                        : "Excluir material"}
                  </button>
                </>
              ) : null}
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({
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
    <article className="surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-navy">{label}</span>
        <span className="text-blue-600 [&>svg]:size-4">{icon}</span>
      </div>
      <strong className="mt-5 block text-2xl text-navy">{value}</strong>
      <small className="text-slate-500">{detail}</small>
    </article>
  );
}
function Status({ status }: { status: string }) {
  const ready = status === "READY";
  const failed = status === "FAILED";
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold ${ready ? "text-emerald-600" : failed ? "text-red-600" : "text-orange-500"}`}
    >
      {ready ? (
        <CheckCircle2 className="size-3.5" />
      ) : failed ? (
        <XCircle className="size-3.5" />
      ) : (
        <span className="size-2 animate-pulse rounded-full bg-current" />
      )}
      {status === "PROCESSING"
        ? "Processando"
        : status === "PENDING"
          ? "Na fila"
          : status === "READY"
            ? "Pronto"
            : "Falhou"}
    </span>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <strong className="text-right text-navy">{value}</strong>
    </p>
  );
}
