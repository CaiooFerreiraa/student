import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../generated/prisma/client";
import { EducationLevel, EssayType } from "../generated/prisma/enums";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não configurada.");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const subjects = [
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

async function main(): Promise<void> {
  const email = process.env.DEMO_USER_EMAIL ?? "caio@lumina.local";
  const user = await prisma.user.upsert({
    where: { email },
    update: { displayName: "Caio Martins" },
    create: {
      email,
      displayName: "Caio Martins",
      profile: {
        create: {
          bio: "Estudante focado em transformar constância em aprovação.",
          educationLevel: EducationLevel.UNDERGRADUATE,
          primaryGoal: "Concursos públicos",
        },
      },
    },
  });
  await prisma.userPreference.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });

  for (const [name, slug, color] of subjects) {
    const existing = await prisma.subject.findFirst({ where: { ownerId: null, slug } });
    if (!existing) await prisma.subject.create({ data: { name, slug, color } });
  }

  let rubric = await prisma.essayRubric.findFirst({
    where: { ownerId: null, name: "ENEM", version: 2025 },
  });

  if (!rubric) {
    rubric = await prisma.essayRubric.create({
      data: {
        name: "ENEM",
        version: 2025,
        essayType: EssayType.ENEM,
        maximumScore: 1000,
        criteria: {
          create: enemCriteria.map(([code, name, description], position) => ({
            code,
            name,
            description,
            position: position + 1,
            maximumScore: 200,
          })),
        },
      },
    });
  }

  const writingSubject = await prisma.subject.findFirst({ where: { ownerId: null, slug: "redacao" } });
  const assignment = await prisma.essayAssignment.findFirst({ where: { ownerId: user.id, title: "Desinformação na sociedade brasileira", deletedAt: null } });
  if (!assignment) {
    await prisma.essayAssignment.create({
      data: {
        ownerId: user.id,
        subjectId: writingSubject?.id,
        rubricId: rubric.id,
        title: "Desinformação na sociedade brasileira",
        prompt: "A partir de seus conhecimentos, escreva um texto dissertativo-argumentativo sobre os desafios para combater a desinformação na sociedade brasileira, apresentando uma proposta de intervenção que respeite os direitos humanos.",
        essayType: EssayType.ENEM,
        minimumLines: 7,
        maximumLines: 30,
        timeLimitSeconds: 3600,
      },
    });
  }

  console.info(`Seed concluído para ${user.email}; rubrica ${rubric.name} ${rubric.version}.`);
}

await main();
await prisma.$disconnect();
