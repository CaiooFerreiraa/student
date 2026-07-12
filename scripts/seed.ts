import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { EducationLevel, EssayType } from "../domain/enums";
import * as tables from "../lib/server/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não configurada.");
const sql = postgres(connectionString, { max: 1, prepare: false });
const db = drizzle(sql);

const subjectSeeds = [
  ["Direito Constitucional", "direito-constitucional", "#2458ff"],
  ["Direito Administrativo", "direito-administrativo", "#7c3aed"],
  ["Português", "portugues", "#06b6d4"],
  ["Matemática", "matematica", "#f59e0b"],
  ["Redação", "redacao", "#ef4444"],
] as const;
const enemCriteria = [
  ["C1", "Domínio da escrita formal", "Demonstrar domínio da modalidade escrita formal da língua portuguesa."],
  ["C2", "Compreensão da proposta", "Compreender a proposta e desenvolver o tema em texto dissertativo-argumentativo."],
  ["C3", "Argumentação", "Selecionar, relacionar, organizar e interpretar informações em defesa de um ponto de vista."],
  ["C4", "Coesão", "Demonstrar conhecimento dos mecanismos linguísticos necessários à argumentação."],
  ["C5", "Proposta de intervenção", "Elaborar proposta de intervenção respeitando os direitos humanos."],
] as const;

async function seed(): Promise<void> {
  const email = process.env.DEMO_USER_EMAIL ?? "caio@lumina.local";
  const [existingUser] = await db.select().from(tables.users).where(eq(tables.users.email, email)).limit(1);
  let user = existingUser;
  if (user) {
    [user] = await db.update(tables.users).set({ displayName: "Caio Martins", updatedAt: new Date() }).where(eq(tables.users.id, user.id)).returning();
  } else {
    [user] = await db.insert(tables.users).values({ email, displayName: "Caio Martins", updatedAt: new Date() }).returning();
    if (!user) throw new Error("Usuário seed não criado.");
    await db.insert(tables.profiles).values({ userId: user.id, bio: "Estudante focado em transformar constância em aprovação.", educationLevel: EducationLevel.UNDERGRADUATE, primaryGoal: "Concursos públicos", updatedAt: new Date() });
  }
  await db.insert(tables.userPreferences).values({ userId: user.id, updatedAt: new Date() }).onConflictDoNothing({ target: tables.userPreferences.userId });

  for (const [name, slug, color] of subjectSeeds) {
    const [existing] = await db.select({ id: tables.subjects.id }).from(tables.subjects).where(and(isNull(tables.subjects.ownerId), eq(tables.subjects.slug, slug))).limit(1);
    if (!existing) await db.insert(tables.subjects).values({ name, slug, color });
  }
  let [rubric] = await db.select().from(tables.essayRubrics).where(and(isNull(tables.essayRubrics.ownerId), eq(tables.essayRubrics.name, "ENEM"), eq(tables.essayRubrics.version, 2025))).limit(1);
  if (!rubric) {
    [rubric] = await db.insert(tables.essayRubrics).values({ name: "ENEM", version: 2025, essayType: EssayType.ENEM, maximumScore: 1000 }).returning();
    if (!rubric) throw new Error("Rubrica seed não criada.");
    await db.insert(tables.essayRubricCriteria).values(enemCriteria.map(([code, name, description], index) => ({ rubricId: rubric!.id, code, name, description, position: index + 1, maximumScore: 200 })));
  }
  const [writingSubject] = await db.select().from(tables.subjects).where(and(isNull(tables.subjects.ownerId), eq(tables.subjects.slug, "redacao"))).limit(1);
  const [assignment] = await db.select().from(tables.essayAssignments).where(and(eq(tables.essayAssignments.ownerId, user.id), eq(tables.essayAssignments.title, "Desinformação na sociedade brasileira"), isNull(tables.essayAssignments.deletedAt))).limit(1);
  if (!assignment) await db.insert(tables.essayAssignments).values({ ownerId: user.id, subjectId: writingSubject?.id, rubricId: rubric.id, title: "Desinformação na sociedade brasileira", prompt: "A partir de seus conhecimentos, escreva um texto dissertativo-argumentativo sobre os desafios para combater a desinformação na sociedade brasileira, apresentando uma proposta de intervenção que respeite os direitos humanos.", essayType: EssayType.ENEM, minimumLines: 7, maximumLines: 30, timeLimitSeconds: 3600, updatedAt: new Date() });
  console.info(`Seed concluído para ${user.email}; rubrica ${rubric.name} ${rubric.version}.`);
}

await seed();
await sql.end();
