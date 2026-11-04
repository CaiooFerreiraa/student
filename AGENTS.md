# Repository Guidelines

<!-- BEGIN:nextjs-agent-rules -->
## Next.js 16

Esta versão tem mudanças incompatíveis em APIs, convenções e estrutura. Antes de alterar código Next.js, leia o guia pertinente em `node_modules/next/dist/docs/` e observe avisos de depreciação.
<!-- END:nextjs-agent-rules -->

## Estrutura do projeto

`app/` contém páginas, layouts e Route Handlers (`app/api/**/route.ts`). `components/` reúne a interface; `components/ui/`, elementos reutilizáveis. Regras puras ficam em `domain/`; casos de uso e integrações, em `lib/server/`. O schema Drizzle está em `lib/server/db/schema.ts`, as migrations em `drizzle/`, os testes em `tests/` e os arquivos estáticos em `public/`. Consulte `docs/architecture/runtime.md` e `docs/architecture/database-schema.md` para detalhes.

## Desenvolvimento e validação

Use Bun (`bun.lock`): `bun install` instala dependências; `bun run dev` inicia o servidor. Execute `bun run lint`, `bun run typecheck`, `bun run test` e `bun run build` conforme o escopo. `bun run db:generate` cria migrations após alterar o schema; revise o SQL antes de `bun run db:deploy`. `bun run db:seed` popula dados iniciais.

## Estilo e arquitetura

Siga TypeScript estrito, indentação de dois espaços, imports `@/` e arquivos em kebab-case. Use PascalCase para componentes e tipos; camelCase para funções e variáveis. Mantenha Route Handlers finos, valide entradas com Zod e coloque regras no domínio ou em casos de uso. Aplique SOLID com simplicidade e prefira tipos específicos a `any`. Use Drizzle com Neon e filtre consultas por `ownerId`.

## Testes

Use `bun:test`. Nomeie testes unitários `*.test.ts(x)` e integrações `*.integration.test.ts` em `tests/`. Verifique comportamento real, erros e autorização quando relevantes. Integrações acessam `DATABASE_URL`: use um banco isolado e limpe registros criados. Execute um arquivo com `bun test tests/quiz-domain.test.ts` ou a suíte com `bun run test`. Não há meta numérica de cobertura.

## Commits e pull requests

O histórico usa principalmente `feat:` e `fix:`, às vezes com escopo, como `feat(api): ...`. Mantenha mensagens curtas e descritivas. Em pull requests, explique a mudança, vincule a issue quando houver, informe os comandos de validação e inclua capturas para alterações visuais. Destaque migrations, novas variáveis de ambiente e efeitos em integrações.

## Configuração e revisão

Use `.env.example` como referência e mantenha segredos em `.env.local`. Em mudanças de código ou configuração executável, acione `quality_gate` com o diff, aguarde o parecer e corrija bloqueios. Dispense-o em documentação e pequenos ajustes visuais sem risco concreto; revisões de código solicitadas sempre exigem o gate.
