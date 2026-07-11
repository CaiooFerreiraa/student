"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { Bot, CheckCircle2, FileText, MessageSquarePlus, Send, Sparkles } from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { readApiResponse } from "@/lib/api-client";

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; createdAt: string };
export type ChatMaterial = { id: string; title: string; type: string; pageCount: number | null };

export function ChatWorkspace({ initialConversationId, initialMessages, materials, aiEnabled }: { initialConversationId: string | null; initialMessages: ChatMessage[]; materials: ChatMaterial[]; aiEnabled: boolean }) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(aiEnabled ? null : "Configure OPENAI_API_KEY para conversar com a Lumina.");

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault(); const text = input.trim(); if (!text || sending) return;
    const optimistic: ChatMessage = { id: crypto.randomUUID(), role: "user", text, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, optimistic]); setInput(""); setSending(true); setError(null);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: conversationId ?? undefined, message: text }) });
      const result = await readApiResponse<{ conversationId: string; message: { id: string; content: string; createdAt: string } }>(response);
      if (!result.data) throw new Error("A Lumina não retornou uma mensagem.");
      setConversationId(result.data.conversationId);
      setMessages((current) => [...current, { id: result.data!.message.id, role: "assistant", text: result.data!.message.content, createdAt: result.data!.message.createdAt }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha inesperada."); } finally { setSending(false); }
  }

  return <div className="grid min-h-[calc(100vh-8rem)] gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="surface flex min-h-[720px] flex-col overflow-hidden"><header className="flex items-center gap-3 border-b border-slate-100 p-5"><span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-600"><Bot className="size-5" /></span><div><div className="flex items-center gap-2"><h1 className="text-xl font-extrabold text-navy">Tutora Lumina</h1><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${aiEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{aiEnabled ? "Online" : "Aguardando configuração"}</span></div><p className="mt-1 text-xs text-slate-500">Respostas com recuperação dos seus materiais processados.</p></div><button onClick={() => { setConversationId(null); setMessages([]); }} className="secondary-button ml-auto min-h-10 px-3"><MessageSquarePlus className="size-4" /> Nova conversa</button></header>
    <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">{messages.length === 0 ? <div className="grid h-full place-items-center text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-3xl bg-blue-50 text-blue-600"><Sparkles /></span><h2 className="mt-4 font-bold text-navy">O que vamos aprender?</h2><p className="mt-2 text-sm text-slate-500">Faça uma pergunta sobre seus materiais.</p></div></div> : messages.map((message) => message.role === "user" ? <div key={message.id} className="ml-auto max-w-2xl"><div className="rounded-2xl rounded-br-md bg-blue-600 px-5 py-4 text-sm leading-relaxed text-white">{message.text}</div></div> : <div key={message.id} className="flex max-w-3xl gap-3"><Image src="/robozinho-student.png" alt="Lumina" width={42} height={42} className="size-10 shrink-0 rounded-xl bg-blue-100 object-cover object-top" /><div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm"><MarkdownContent>{message.text}</MarkdownContent></div></div>)}</div>
    <div className="border-t border-slate-100 p-5">{error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}<form onSubmit={(event) => void submit(event)} className="rounded-2xl border border-blue-200 bg-slate-50 p-3 focus-within:border-blue-500"><textarea disabled={!aiEnabled || sending} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Pergunte algo à Lumina..." className="min-h-20 w-full resize-none bg-transparent px-2 text-sm outline-none disabled:cursor-not-allowed" /><div className="flex justify-end"><button disabled={!aiEnabled || sending || !input.trim()} className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="size-4" /></button></div></form></div></section>
    <aside className="space-y-5"><section className="surface p-5"><div className="flex items-center justify-between"><h2 className="section-title">Materiais disponíveis</h2><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{materials.length} prontos</span></div><div className="mt-4 space-y-2">{materials.length ? materials.map((material) => <div key={material.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><FileText className="size-4 shrink-0 text-red-500" /><span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-navy">{material.title}</span><small className="text-[9px] text-slate-400">{material.pageCount ? `${material.pageCount}p` : material.type}</small></div>) : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">Processe um material para habilitar respostas contextuais.</p>}</div></section><section className="rounded-2xl border border-violet-200 bg-violet-50 p-5"><Sparkles className="size-5 text-violet-600" /><h2 className="mt-3 font-bold text-violet-800">Como a Lumina responde</h2><div className="mt-4 space-y-2 text-xs text-slate-600"><p className="flex gap-2"><CheckCircle2 className="size-4 text-emerald-500" />Busca semântica nos seus documentos</p><p className="flex gap-2"><CheckCircle2 className="size-4 text-emerald-500" />Tool calling com autorização por usuário</p><p className="flex gap-2"><CheckCircle2 className="size-4 text-emerald-500" />Instruções contra fontes inventadas</p></div></section></aside></div>;
}
