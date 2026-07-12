# Student — runtime e integrações

## Variáveis

Copie `.env.example` para `.env.local` e preencha:

- `DATABASE_URL`: URL pooled do Neon para runtime e migrations.
- `BLOB_READ_WRITE_TOKEN`: store privada do Vercel Blob.
- `OPENAI_API_KEY`: provedor de chat, embeddings, transcrição e correção.
- `OPENAI_CHAT_MODEL`: modelo multimodal/tool-calling.
- `OPENAI_EMBEDDING_MODEL`: deve produzir 1536 dimensões para o schema v1.
- `VERCEL_BLOB_CALLBACK_URL`: URL pública/túnel para callback local do Blob.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: chave pública do Clerk.
- `CLERK_SECRET_KEY`: chave privada do Clerk, usada somente no servidor.
- `NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED`: desativa a telemetria do Clerk no cliente Next.js quando definido como `1`.
- `CLERK_TELEMETRY_DISABLED`: desativa a telemetria do SDK do Clerk no servidor quando definido como `1`.

## Banco de dados

- O schema Drizzle em `lib/server/db/schema.ts` é a fonte de verdade.
- As relações ficam em `lib/server/db/relations.ts` e a conexão transacional com o pooler do Neon, via `postgres.js`, em `lib/server/db/index.ts`.
- `drizzle/0000_brainy_longshot.sql` registra o baseline do banco existente sem recriar tabelas.
- Migrations incrementais são geradas com `bun run db:generate` e aplicadas com `bun run db:deploy`.

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
- Toda tool fecha sobre o `userId` interno associado à sessão Clerk e revalida ownership no banco.
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

## Autenticação

O `proxy.ts` apenas inicializa o `clerkMiddleware`, sem decidir autorização por caminho. Cada página protegida chama `auth.protect()` e cada recurso de dados/Route Handler resolve a sessão por `getCurrentUser()`, retornando JSON 401 quando ela não existe. No primeiro acesso, o subject do Clerk é associado a um UUID interno em `UserIdentity`; essa identidade continua sendo usada nos filtros por `ownerId`. Os callbacks do Vercel Blob são públicos, mas confiam apenas no payload assinado emitido depois da autenticação do upload.
