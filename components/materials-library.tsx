"use client";

import { upload } from "@vercel/blob/client";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, File, FileText, HardDrive, Search, Sparkles, UploadCloud, XCircle } from "lucide-react";

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
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export function MaterialsLibrary({ userId, initialMaterials, blobEnabled }: { userId: string; initialMaterials: MaterialListItem[]; blobEnabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [materials, setMaterials] = useState(initialMaterials);
  const [selectedId, setSelectedId] = useState(initialMaterials[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = materials.find((material) => material.id === selectedId) ?? null;
  const filtered = useMemo(() => materials.filter((material) => material.title.toLowerCase().includes(query.toLowerCase())), [materials, query]);
  const totalBytes = materials.reduce((sum, material) => sum + material.size, 0);

  async function onFile(file: File): Promise<void> {
    setNotice(null);
    if (!blobEnabled) { setNotice("Configure BLOB_READ_WRITE_TOKEN para habilitar uploads."); return; }
    setProgress(0);
    try {
      const pathname = `users/${userId}/materials/${crypto.randomUUID()}-${safeFilename(file.name)}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({ originalName: file.name }),
        multipart: file.size > 100 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      const response = await fetch("/api/materials/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...blob, size: file.size, originalName: file.name }) });
      const result = await response.json() as { data?: { id: string }; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error ?? "Falha ao registrar material.");
      const item: MaterialListItem = { id: result.data.id, title: file.name.replace(/\.[^.]+$/, ""), subject: "Sem disciplina", size: file.size, type: file.name.split(".").at(-1)?.toUpperCase() ?? "FILE", status: "PENDING", pageCount: null, chunkCount: 0, error: null, createdAt: new Date().toISOString() };
      setMaterials((current) => [item, ...current.filter((material) => material.id !== item.id)]);
      setSelectedId(item.id);
      setNotice("Upload concluído. O conteúdo está sendo processado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha no upload.");
    } finally { setProgress(null); }
  }

  return <div className="space-y-5">
    {notice && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{notice}</div>}
    <section className="grid gap-4 xl:grid-cols-[1.3fr_.7fr_.7fr]">
      <button onClick={() => inputRef.current?.click()} className="group grid min-h-48 place-items-center rounded-2xl border border-dashed border-blue-300 bg-blue-50/40 p-6 text-center transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60">
        <input ref={inputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,.txt" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onFile(file); event.target.value = ""; }} />
        <span><span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm"><UploadCloud /></span><strong className="block text-sm text-navy">Enviar novo material</strong><small className="mt-1 block text-slate-500">PDF, DOCX, imagem ou texto · até 250 MB</small>{progress !== null && <span className="mt-4 block text-xs font-bold text-blue-600">Enviando: {progress}%</span>}</span>
      </button>
      <Summary icon={<FileText />} label="Materiais" value={String(materials.length)} detail={`${materials.filter((item) => item.status === "READY").length} prontos`} />
      <Summary icon={<HardDrive />} label="Armazenamento" value={formatBytes(totalBytes)} detail="arquivos privados" />
    </section>
    <section className="surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><h2 className="section-title">Biblioteca</h2><label className="relative ml-auto"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar materiais" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-blue-400 sm:w-64" /></label></div>
      {filtered.length === 0 ? <div className="grid min-h-64 place-items-center p-8 text-center"><div><FileText className="mx-auto size-8 text-slate-300" /><strong className="mt-3 block text-sm text-navy">Nenhum material encontrado</strong><p className="mt-1 text-xs text-slate-500">Envie seu primeiro documento para começar.</p></div></div> : <div className="grid xl:grid-cols-[minmax(0,1fr)_310px]"><div className="divide-y divide-slate-100">{filtered.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`grid w-full grid-cols-[40px_minmax(150px,1fr)_110px_110px] items-center gap-3 p-4 text-left text-xs transition hover:bg-slate-50 ${item.id === selectedId ? "bg-blue-50/60" : ""}`}><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><File className="size-4" /></span><span className="min-w-0"><strong className="block truncate text-navy">{item.title}</strong><small className="text-[10px] text-slate-500">{item.type} · {formatBytes(item.size)}</small></span><span className="truncate text-slate-500">{item.subject}</span><Status status={item.status} /></button>)}</div><aside className="border-t border-slate-100 p-5 xl:border-l xl:border-t-0">{selected ? <><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><FileText className="size-5" /></span><h3 className="mt-4 text-sm font-bold text-navy">{selected.title}</h3><p className="mt-1 text-xs text-slate-500">{selected.type} · {formatBytes(selected.size)}</p><div className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-xs"><Detail label="Status" value={selected.status} /><Detail label="Páginas" value={String(selected.pageCount ?? "—")} /><Detail label="Trechos indexados" value={String(selected.chunkCount)} /><Detail label="Enviado" value={new Date(selected.createdAt).toLocaleDateString("pt-BR")} /></div>{selected.error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{selected.error}</div>}<div className="mt-5 rounded-xl bg-violet-50 p-4 text-xs text-violet-800"><Sparkles className="mb-2 size-4" />Quando o processamento terminar, este material ficará disponível para a Lumina e para geração de quizzes.</div></> : null}</aside></div>}
    </section>
  </div>;
}

function Summary({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <article className="surface p-5"><div className="flex items-center justify-between"><span className="text-xs font-bold text-navy">{label}</span><span className="text-blue-600 [&>svg]:size-4">{icon}</span></div><strong className="mt-5 block text-2xl text-navy">{value}</strong><small className="text-slate-500">{detail}</small></article>; }
function Status({ status }: { status: string }) { const ready = status === "READY"; const failed = status === "FAILED"; return <span className={`inline-flex items-center gap-1 font-semibold ${ready ? "text-emerald-600" : failed ? "text-red-600" : "text-orange-500"}`}>{ready ? <CheckCircle2 className="size-3.5" /> : failed ? <XCircle className="size-3.5" /> : <span className="size-2 animate-pulse rounded-full bg-current" />}{status === "PROCESSING" ? "Processando" : status === "PENDING" ? "Na fila" : status === "READY" ? "Pronto" : "Falhou"}</span>; }
function Detail({ label, value }: { label: string; value: string }) { return <p className="flex justify-between gap-3"><span className="text-slate-500">{label}</span><strong className="text-right text-navy">{value}</strong></p>; }
