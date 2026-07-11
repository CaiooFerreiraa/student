# Student — modelo de dados v1

Status: aprovado para implementação. Este documento define o primeiro schema do Neon antes das migrations.

## Princípios

- IDs são UUIDs gerados no banco e datas são armazenadas em UTC.
- Todo agregado do usuário possui `ownerId` e índices iniciados por esse campo.
- Arquivos permanecem privados no Vercel Blob; o banco guarda metadados e nunca o binário.
- Conteúdo publicado é imutável. Editar um quiz publicado cria uma nova `QuizVersion`.
- Tentativas apontam para a versão exata executada.
- Redação é um módulo próprio, embora possa ser vinculada a um quiz.
- Exclusão de agregados visíveis é lógica; arquivos físicos são removidos por job idempotente.
- Respostas e saídas de IA relevantes são estruturadas, versionadas e auditáveis.

## Mapa de agregados

```text
User
├── Profile
├── Folder ── Material ── MaterialChunk
│             └── FileAsset
├── Quiz ── QuizVersion ── Question ── QuestionOption
│          │               └── QuestionSource ── MaterialChunk
│          └── QuizVersionMaterial ── Material
│
├── QuizAttempt ── AttemptAnswer
├── QuizReviewSchedule
├── EssayAssignment ── EssaySubmission ── EssaySubmissionFile
│                    │                  └── FileAsset
│                    ├── EssayTranscription
│                    └── EssayEvaluation ── EssayCriterionScore
├── Conversation ── ConversationMessage
│                └── ConversationMaterial
└── AiRun / BackgroundJob
```

## Identidade e catálogo

### User

Registro interno independente do futuro provedor de autenticação.

- `id`, `email`, `displayName`, `status`, `createdAt`, `updatedAt`, `deletedAt`.
- E-mail único enquanto o usuário não estiver removido.

### UserIdentity

Vincula provedores de autenticação sem contaminar o domínio.

- `userId`, `provider`, `subject`, `createdAt`.
- Único por `(provider, subject)`.

### Profile

- `userId`, `avatarFileId`, `bio`, `educationLevel`, `primaryGoal`, `timezone`, `locale`, `weeklyStudyGoalMinutes`.

### Subject e Tag

- `Subject` pode ser de sistema (`ownerId = null`) ou personalizado.
- `Tag`, `MaterialTag` e `QuizTag` organizam a biblioteca.

## Arquivos e materiais

### FileAsset

- Metadados do Vercel Blob: `pathname`, `url`, `downloadUrl`, `contentType`, `byteSize`, `checksum`.
- `purpose`: material, redação, avatar ou anexo de conversa.
- `status`: pendente, disponível, exclusão pendente, removido ou falha.
- Não há overwrite: cada upload recebe pathname único e imutável.

### Folder e Material

- Pastas usam relação hierárquica opcional com `parentId`.
- `Material` aponta para um `FileAsset` e registra tipo, status de processamento, resumo, número de páginas e erro.
- Um arquivo pode originar no máximo um material.

### MaterialChunk

- Texto normalizado, posição, páginas, quantidade aproximada de tokens e hash.
- `embedding` usa `vector` do pgvector e será criado/ajustado por SQL na migration.
- Busca vetorial sempre filtra por `ownerId`/materiais autorizados antes de calcular similaridade.

## Quiz

### Quiz

- Metadados mutáveis da biblioteca: dono, título, descrição, disciplina, status e versão atual.
- Soft delete preserva tentativas e métricas.

### QuizVersion

- Configuração imutável: escolaridade, dificuldade, modo, origem, tempo, política de gabarito, pontos e versão do prompt/modelo.
- Estados: rascunho, gerando, pronta, publicada ou falha.
- Única por `(quizId, versionNumber)`.

### Question

- Tipos iniciais: múltipla escolha, verdadeiro/falso e aberta.
- Guarda enunciado, explicação, dificuldade, pontos, gabarito booleano ou resposta-modelo/rubrica.
- Única por `(quizVersionId, position)`.

### QuestionOption e QuestionSource

- Alternativas existem apenas para múltipla escolha e têm uma única correta na v1.
- Fontes apontam para chunks e guardam páginas/excerto para auditoria.

### QuizAttempt e AttemptAnswer

- Tentativa referencia `quizVersionId`; seu conteúdo nunca muda depois do envio.
- Respostas objetivas são corrigidas deterministicamente.
- Respostas abertas possuem estado de correção e dados do modelo/prompt quando avaliadas por IA.

### QuizReviewSchedule

- Único por `(userId, quizId)`.
- Guarda próxima revisão, intervalo, repetições e fator de facilidade.

## Redação

### EssayRubric e EssayRubricCriterion

- Rubricas versionadas e opcionais por usuário; a rubrica ENEM inicial possui cinco critérios de 0 a 200.
- Critérios têm código, posição, descrição e pontuação máxima.

### EssayAssignment

- Proposta independente ou ligada a uma `QuizVersion`.
- Guarda tema, instruções, tipo, textos motivadores, limites de linhas e tempo.

### EssaySubmission e EssaySubmissionFile

- Aceita texto, DOCX ou uma/múltiplas imagens ordenadas.
- Fluxo: upload, extração, revisão, pronta para correção, corrigindo, corrigida ou falha.
- O texto confirmado pelo aluno é separado do texto bruto extraído.

### EssayTranscription

- Versiona texto bruto/normalizado, confiança, trechos incertos, modelo e prompt.
- Correção só inicia após confirmação do usuário ou transcrição confiável explicitamente aceita.

### EssayEvaluation e EssayCriterionScore

- Permite múltiplas avaliações independentes e uma avaliação final.
- Cada critério armazena nota, feedback, evidências e sugestões.
- A nota é uma estimativa pedagógica, não uma nota oficial do Inep.

## Conversas e agente

### Conversation e ConversationMessage

- Conversas pertencem a um usuário e podem ter materiais ativos.
- Mensagens guardam papel, texto, conteúdo estruturado, chamada de tool e consumo de tokens.

### AiRun

- Auditoria transversal: feature, alvo, modelo, prompt, status, tokens, duração e erro sanitizado.
- Conteúdo sensível integral não é duplicado no log.

### BackgroundJob

- Job idempotente para material, transcrição, correção, geração e exclusão de Blob.
- Possui `idempotencyKey`, tentativas, `runAfter`, lock e último erro.

## Integridade e índices críticos

- Índices compostos por `ownerId`, status e datas nas listagens.
- FKs de histórico usam `Restrict`; dependentes internos de rascunhos usam `Cascade`.
- `FileAsset.pathname`, identidade externa, posições e idempotency keys são únicos.
- Publicação, envio de tentativa e confirmação de transcrição ocorrem em transações.
- Estatísticas são derivadas de tentativas; tabelas agregadas só serão adicionadas após medição.

## Fora da v1

- Questões de associação e múltiplas alternativas corretas.
- Colaboração entre usuários.
- Correção humana integrada.
- Materialized views de desempenho.
- RLS do Postgres; a v1 aplica autorização nos casos de uso/repositórios e mantém `ownerId` em todas as consultas.
