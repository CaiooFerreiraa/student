# Student — runtime e integrações

## Variáveis

Copie `.env.example` para `.env.local` e preencha:

- `DATABASE_URL`: URL pooled do Neon para runtime e migrations com Prisma 7.
- `BLOB_READ_WRITE_TOKEN`: store privada do Vercel Blob.
- `OPENAI_API_KEY`: provedor de chat, embeddings, transcrição e correção.
- `OPENAI_CHAT_MODEL`: modelo multimodal/tool-calling.
- `OPENAI_EMBEDDING_MODEL`: deve produzir 1536 dimensões para o schema v1.
- `DEMO_USER_EMAIL`: identidade temporária até a autenticação ser escolhida.
- `VERCEL_BLOB_CALLBACK_URL`: URL pública/túnel para callback local do Blob.

## Upload de material

```text
browser -> /api/blob/upload (token exchange) -> Vercel Blob privado
        -> /api/materials/complete -> FileAsset + Material + BackgroundJob
        -> after() -> loader PDF/DOCX -> chunks -> embeddings -> pgvector
```

O endpoint de conclusão é idempotente por pathname e complementa o callback do Vercel Blob, que não consegue alcançar localhost sem túnel.

## Lumina

- System prompt: `lib/server/ai/lumina-prompt.ts`.
- Tools: `lib/server/ai/lumina-tools.ts`.
- Execução e persistência: `lib/server/ai/run-lumina.ts`.
- Toda tool fecha sobre o `userId` autenticado/desenvolvimento e revalida ownership no banco.
- As mutações disponíveis ao agente criam apenas rascunhos.

## Redação

```text
texto -> confirmação automática -> correção
DOCX -> extração -> revisão do aluno -> correção
imagens -> visão/transcrição -> revisão do aluno -> correção
```

Transcrição e avaliação possuem prompts e registros de execução independentes. A nota é apresentada como estimativa pedagógica.

## Jobs

Na v1, `after()` executa o job após a resposta e `BackgroundJob` mantém idempotência/estado. Para volumes altos ou tarefas acima do limite da Function, o executor pode ser trocado por uma fila sem alterar os casos de uso.

## Segurança pendente

O schema suporta `UserIdentity`, mas o runtime usa `DEMO_USER_EMAIL` enquanto o provedor de autenticação não for definido. Antes de produção, substituir `getCurrentUser()` por uma sessão verificada e manter os mesmos filtros por `ownerId`.
