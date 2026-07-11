"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Clock3, FileText, GraduationCap, Sparkles, Target } from "lucide-react";
import { PageHeader } from "@/components/page-header";

type Subject = { id: string; name: string };
type Material = { id: string; title: string; type: string; status: string; size: number; subject: string | null };
type Distribution = { multipleChoice: number; trueFalse: number; open: number };

export default function CreateQuizPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [educationLevel, setEducationLevel] = useState("UNDERGRADUATE");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [distribution, setDistribution] = useState<Distribution>({ multipleChoice: 10, trueFalse: 5, open: 5 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = distribution.multipleChoice + distribution.trueFalse + distribution.open;
  const duration = useMemo(() => Math.ceil(count * 1.5), [count]);

  useEffect(() => { void Promise.all([fetch("/api/subjects").then((response) => response.json()), fetch("/api/materials").then((response) => response.json())]).then(([subjectResult, materialResult]) => { setSubjects(subjectResult.data ?? []); setMaterials((materialResult.data ?? []).filter((material: Material) => material.status === "READY")); }); }, []);

  function setCount(key: keyof Distribution, value: number): void { setDistribution((current) => ({ ...current, [key]: Math.max(0, Math.min(50, value)) })); }
  function toggleMaterial(id: string): void { setSelectedMaterials((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 10 ? [...current, id] : current); }

  async function createAndGenerate(): Promise<void> {
    setError(null);
    if (!title.trim()) { setError("Informe um título para o quiz."); return; }
    if (count < 5 || count > 50) { setError("O total deve ficar entre 5 e 50 questões."); return; }
    if (!selectedMaterials.length) { setError("Selecione pelo menos um material pronto."); return; }
    setSubmitting(true);
    try {
      const createResponse = await fetch("/api/quizzes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, description: description || undefined, subjectId: subjectId || undefined, educationLevel, difficulty, mode: "STUDY", generationMode: "AI", answerRevealMode: "AFTER_SUBMIT", questionDistribution: distribution, timePerQuestionSeconds: 90, materialIds: selectedMaterials }) });
      const createResult = await createResponse.json() as { data?: { id: string }; error?: string };
      if (!createResponse.ok || !createResult.data) throw new Error(createResult.error ?? "Não foi possível criar o quiz.");
      const generateResponse = await fetch(`/api/quizzes/${createResult.data.id}/generate`, { method: "POST" });
      const generateResult = await generateResponse.json() as { error?: string };
      if (!generateResponse.ok) throw new Error(generateResult.error ?? "Quiz salvo, mas a geração não pôde ser iniciada.");
      router.push("/quizzes"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao criar quiz."); } finally { setSubmitting(false); }
  }

  return <div><PageHeader eyebrow="Novo quiz" title="Monte sua próxima revisão" description="A configuração será persistida e a Lumina gerará questões fundamentadas nos materiais selecionados." icon={Sparkles} />
    {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-5">
      <section className="surface p-5 sm:p-6"><h2 className="section-title mb-5">Informações básicas</h2><div className="grid gap-4 md:grid-cols-2"><Field label="Disciplina"><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-blue-400"><option value="">Sem disciplina</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></Field><Field label="Título do quiz"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Ex.: Direitos fundamentais — revisão" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-blue-400" /></Field></div><Field label="Descrição (opcional)" className="mt-4"><textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-blue-400" /></Field></section>
      <section className="surface p-5 sm:p-6"><div className="grid gap-6 md:grid-cols-2"><Field label="Nível de escolaridade"><select value={educationLevel} onChange={(event) => setEducationLevel(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm"><option value="ELEMENTARY">Ensino fundamental</option><option value="HIGH_SCHOOL">Ensino médio</option><option value="UNDERGRADUATE">Ensino superior</option><option value="GRADUATE">Pós-graduação</option></select></Field><Field label="Dificuldade"><div className="grid grid-cols-3 gap-2">{[["EASY","Fácil"],["MEDIUM","Médio"],["HARD","Difícil"]].map(([value,label]) => <button key={value} onClick={() => setDifficulty(value)} className={`h-12 rounded-xl border text-sm font-semibold ${difficulty === value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>{label}</button>)}</div></Field></div></section>
      <section className="surface p-5 sm:p-6"><h2 className="section-title">Distribuição das questões</h2><p className="mt-1 text-xs text-slate-500">Defina quantas perguntas de cada formato serão geradas.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><NumberField label="Múltipla escolha" value={distribution.multipleChoice} onChange={(value) => setCount("multipleChoice", value)} /><NumberField label="Verdadeiro ou falso" value={distribution.trueFalse} onChange={(value) => setCount("trueFalse", value)} /><NumberField label="Questões abertas" value={distribution.open} onChange={(value) => setCount("open", value)} /></div></section>
      <section className="surface p-5 sm:p-6"><div className="mb-4"><h2 className="section-title">Materiais de referência</h2><p className="mt-1 text-xs text-slate-500">Somente materiais processados podem fundamentar a geração.</p></div>{materials.length ? <div className="grid gap-3 md:grid-cols-2">{materials.map((material) => <button key={material.id} onClick={() => toggleMaterial(material.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selectedMaterials.includes(material.id) ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}><span className="grid size-9 place-items-center rounded-lg bg-red-50 text-red-500"><FileText className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-navy">{material.title}</strong><small className="text-[10px] text-slate-500">{material.type} · {(material.size / 1024 / 1024).toFixed(1)} MB</small></span>{selectedMaterials.includes(material.id) && <Check className="size-4 text-blue-600" />}</button>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nenhum material pronto. Envie e processe um documento primeiro.</div>}</section>
    </div><aside className="xl:sticky xl:top-24 xl:self-start"><section className="surface overflow-hidden"><div className="border-b border-slate-100 bg-blue-50 p-5"><span className="eyebrow">Resumo do quiz</span><h2 className="mt-2 text-lg font-extrabold text-navy">{title || "Novo quiz"}</h2></div><div className="space-y-4 p-5"><Summary icon={<GraduationCap />} label="Escolaridade" value={educationLevel === "UNDERGRADUATE" ? "Ensino superior" : educationLevel === "HIGH_SCHOOL" ? "Ensino médio" : educationLevel === "GRADUATE" ? "Pós-graduação" : "Ensino fundamental"} /><Summary icon={<BookOpen />} label="Questões" value={String(count)} /><Summary icon={<FileText />} label="Materiais" value={String(selectedMaterials.length)} /><Summary icon={<Clock3 />} label="Duração estimada" value={`${duration} min`} /><Summary icon={<Target />} label="Modo" value="Estudo" /></div><div className="border-t border-slate-100 p-5"><button disabled={submitting || materials.length === 0} onClick={() => void createAndGenerate()} className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-60"><Sparkles className="size-4" />{submitting ? "Salvando..." : "Salvar e gerar quiz"}</button><p className="mt-3 text-center text-[10px] text-slate-500">A geração acontece em segundo plano.</p></div></section></aside></div>
  </div>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <label className={`block ${className}`}><span className="mb-2 block text-xs font-bold text-navy">{label}</span>{children}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="rounded-xl border border-slate-200 p-3"><span className="block text-xs font-semibold text-navy">{label}</span><input type="number" min="0" max="50" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-3 h-10 w-full rounded-lg bg-slate-50 px-3 text-center text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500" /></label>; }
function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3 text-xs"><span className="text-blue-600 [&>svg]:size-4">{icon}</span><span className="text-slate-500">{label}</span><strong className="ml-auto text-right text-navy">{value}</strong></div>; }
