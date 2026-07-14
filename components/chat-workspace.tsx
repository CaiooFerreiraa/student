"use client";

import Image from "next/image";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Globe2,
  Library,
  LoaderCircle,
  MessageCircle,
  MessageSquarePlus,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { formatConversationTimestamp, formatMessageTimestamp } from "@/domain/chat/date-format";
import type { ChatConversation, ChatMessage } from "@/domain/chat/models";
import { readApiResponse } from "@/lib/api-client";

export type ChatMaterial = {
  id: string;
  title: string;
  type: string;
  pageCount: number | null;
};

type ConversationDetail = {
  conversation: ChatConversation;
  messages: ChatMessage[];
};

type SendMessageResult = {
  conversation: ChatConversation;
  message: { id: string; content: string; createdAt: string };
};

type ChatWorkspaceProps = {
  initialConversations: ChatConversation[];
  initialConversation: ConversationDetail | null;
  materials: ChatMaterial[];
  aiEnabled: boolean;
  renderedAt: string;
};

export function ChatWorkspace({
  initialConversations,
  initialConversation,
  materials,
  aiEnabled,
  renderedAt,
}: ChatWorkspaceProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [conversationId, setConversationId] = useState(initialConversation?.conversation.id ?? null);
  const [conversationTitle, setConversationTitle] = useState(initialConversation?.conversation.title ?? "Nova conversa");
  const [messages, setMessages] = useState(initialConversation?.messages ?? []);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [error, setError] = useState<string | null>(
    aiEnabled ? null : "Configure OPENAI_API_KEY para conversar com a Lumina.",
  );
  const messageViewport = useRef<HTMLDivElement>(null);

  const filteredConversations = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return conversations;
    return conversations.filter((conversation) =>
      `${conversation.title} ${conversation.preview}`.toLocaleLowerCase("pt-BR").includes(normalized));
  }, [conversations, search]);

  useEffect(() => {
    const viewport = messageViewport.current;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function startNewConversation(): void {
    if (sending) return;
    setConversationId(null);
    setConversationTitle("Nova conversa");
    setMessages([]);
    setInput("");
    setError(null);
    setMobileListOpen(false);
  }

  async function selectConversation(id: string): Promise<void> {
    if (sending || loadingConversation) return;
    if (id === conversationId) {
      setMobileListOpen(false);
      return;
    }

    setLoadingConversation(true);
    setError(null);
    try {
      const response = await fetch(`/api/chat/conversations/${id}`);
      const result = await readApiResponse<ConversationDetail>(response);
      if (!result.data) throw new Error("A conversa não pôde ser carregada.");
      setConversationId(result.data.conversation.id);
      setConversationTitle(result.data.conversation.title);
      setMessages(result.data.messages);
      setMobileListOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar a conversa.");
    } finally {
      setLoadingConversation(false);
    }
  }

  function promoteConversation(conversation: ChatConversation): void {
    setConversations((current) => [
      conversation,
      ...current.filter((item) => item.id !== conversation.id),
    ]);
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const optimistic: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId ?? undefined, message: text }),
      });
      const result = await readApiResponse<SendMessageResult>(response);
      if (!result.data) throw new Error("A Lumina não retornou uma mensagem.");

      setConversationId(result.data.conversation.id);
      setConversationTitle(result.data.conversation.title);
      promoteConversation(result.data.conversation);
      setMessages((current) => [...current, {
        id: result.data!.message.id,
        role: "assistant",
        text: result.data!.message.content,
        createdAt: result.data!.message.createdAt,
      }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha inesperada.");
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const suggestions = [
    materials[0] ? `Explique os pontos principais de “${materials[0].title}”.` : "Monte um plano de estudos para esta semana.",
    "Pesquise na internet as novidades mais importantes da minha área de estudo.",
  ];

  return (
    <div className="grid h-[calc(100dvh-8rem)] min-h-0 overflow-hidden rounded-[26px] border border-border bg-card shadow-[0_24px_70px_-42px_rgba(7,26,79,.45)] lg:grid-cols-[310px_minmax(0,1fr)]">
      <aside className={`${mobileListOpen ? "flex" : "hidden"} min-h-0 flex-col border-r border-slate-200 bg-slate-50/80 lg:flex`}>
        <div className="shrink-0 border-b border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#0b246d] text-cyan-300">
              <MessageCircle className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-extrabold text-navy">Conversas</h1>
              <p className="text-[11px] text-slate-500">Um assunto por chat</p>
            </div>
            <button
              type="button"
              onClick={startNewConversation}
              disabled={sending}
              aria-label="Nova conversa"
              className="grid size-11 cursor-pointer place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageSquarePlus className="size-5" />
            </button>
          </div>
          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar assunto..."
              className="h-11 w-full rounded-xl border border-border bg-muted pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-primary focus:bg-card focus:ring-4 focus:ring-ring/10"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {filteredConversations.length ? filteredConversations.map((conversation) => {
            const active = conversation.id === conversationId;
            return (
              <button
                type="button"
                key={conversation.id}
                onClick={() => void selectConversation(conversation.id)}
                disabled={sending || loadingConversation}
                className={`mb-1 flex min-h-[76px] w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait ${active ? "bg-secondary text-secondary-foreground" : "hover:bg-card"}`}
              >
                <span className={`grid size-11 shrink-0 place-items-center rounded-full ${active ? "bg-primary text-primary-foreground" : "bg-card text-primary shadow-sm"}`}>
                  <Bot className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <strong className="min-w-0 flex-1 truncate text-sm">{conversation.title}</strong>
                    <time dateTime={conversation.updatedAt} className="shrink-0 text-[10px] text-slate-400">
                      {formatConversationTimestamp(conversation.updatedAt, renderedAt)}
                    </time>
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{conversation.preview}</span>
                </span>
              </button>
            );
          }) : (
            <div className="grid h-full min-h-48 place-items-center px-5 text-center">
              <div>
                <MessageCircle className="mx-auto size-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-600">Nenhum assunto encontrado</p>
                <p className="mt-1 text-xs text-slate-400">Comece uma nova conversa com a Lumina.</p>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-border bg-card p-4 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-2"><Globe2 className="size-4 text-blue-600" /> Pesquisa na internet disponível</p>
          <p className="flex items-center gap-2"><Library className="size-4 text-emerald-600" /> {materials.length} materiais prontos</p>
        </div>
      </aside>

      <section className={`${mobileListOpen ? "hidden" : "flex"} min-h-0 min-w-0 flex-col lg:flex`}>
        <header className="flex min-h-[72px] shrink-0 items-center gap-3 border-b border-border bg-card px-4 sm:px-5">
          <button
            type="button"
            onClick={() => setMobileListOpen(true)}
            aria-label="Abrir lista de conversas"
            className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
          >
            <ChevronLeft className="size-5" />
          </button>
          <Image src="/robozinho-student.png" alt="Lumina" width={48} height={48} className="size-11 shrink-0 rounded-full bg-cyan-100 object-cover object-top" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-extrabold text-navy">{conversationTitle}</h2>
              <span className={`size-2 shrink-0 rounded-full ${aiEnabled ? "bg-emerald-500" : "bg-slate-300"}`} />
            </div>
            <p className="truncate text-[11px] text-slate-500">Lumina · materiais e pesquisa web com fontes</p>
          </div>
          <button
            type="button"
            onClick={startNewConversation}
            disabled={sending}
            className="hidden min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex"
          >
            <MessageSquarePlus className="size-4" /> Novo assunto
          </button>
        </header>

        <div
          ref={messageViewport}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted bg-[radial-gradient(circle_at_1px_1px,rgba(36,88,255,.09)_1px,transparent_0)] [background-size:22px_22px] p-4 sm:p-6"
        >
          {loadingConversation ? (
            <div className="grid h-full place-items-center text-sm text-slate-500">
              <LoaderCircle className="mb-3 size-6 animate-spin text-blue-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="grid h-full place-items-center py-8 text-center">
              <div className="max-w-lg">
                <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-[#0b246d] text-cyan-300 shadow-lg shadow-blue-950/15"><Sparkles /></span>
                <h2 className="mt-5 text-xl font-extrabold text-navy">Qual assunto vamos explorar?</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Crie um chat para cada matéria ou objetivo. A Lumina pode combinar seus materiais com pesquisa atual na internet.</p>
                <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="min-h-16 cursor-pointer rounded-2xl border border-border bg-card px-4 py-3 text-xs font-semibold leading-5 text-card-foreground shadow-sm transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-4xl flex-col gap-3">
              {messages.map((message) => message.role === "user" ? (
                <div key={message.id} className="ml-auto max-w-[88%] sm:max-w-[75%]">
                  <div className="rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-sm leading-6 text-white shadow-sm">
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    <time dateTime={message.createdAt} className="mt-1 block text-right text-[9px] text-blue-100">
                      {formatMessageTimestamp(message.createdAt)}
                    </time>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex max-w-[94%] items-end gap-2 sm:max-w-[82%]">
                  <Image src="/robozinho-student.png" alt="Lumina" width={32} height={32} className="size-8 shrink-0 rounded-full bg-cyan-100 object-cover object-top" />
                  <div className="min-w-0 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm leading-7 text-card-foreground shadow-sm">
                    <MarkdownContent>{message.text}</MarkdownContent>
                    <time dateTime={message.createdAt} className="mt-1 block text-right text-[9px] text-slate-400">
                      {formatMessageTimestamp(message.createdAt)}
                    </time>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-end gap-2">
                  <Image src="/robozinho-student.png" alt="Lumina" width={32} height={32} className="size-8 rounded-full bg-cyan-100 object-cover object-top" />
                  <div className="flex h-11 items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-card px-4 shadow-sm">
                    {[0, 1, 2].map((index) => <span key={index} className="size-1.5 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: `${index * 120}ms` }} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-card p-3 sm:p-4">
          {error && <div role="alert" className="mx-auto mb-2 max-w-4xl rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <form onSubmit={(event) => void submit(event)} className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-border bg-muted p-2 transition focus-within:border-primary focus-within:bg-card focus-within:ring-4 focus-within:ring-ring/10">
            <textarea
              disabled={!aiEnabled || sending}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={1}
              maxLength={4000}
              placeholder="Mensagem para a Lumina..."
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none disabled:cursor-not-allowed"
            />
            <button
              disabled={!aiEnabled || sending || !input.trim()}
              aria-label="Enviar mensagem"
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
          <div className="mx-auto mt-2 flex max-w-4xl items-center justify-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><CheckCircle2 className="size-3 text-emerald-500" /> Fontes verificáveis</span>
            <span className="hidden items-center gap-1 sm:flex"><Globe2 className="size-3 text-blue-500" /> Links clicáveis</span>
            <span className="hidden items-center gap-1 sm:flex"><FileText className="size-3 text-red-400" /> Seus materiais</span>
          </div>
        </div>
      </section>
    </div>
  );
}
