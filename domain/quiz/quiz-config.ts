import { z } from "zod";
import { AnswerRevealMode, DifficultyLevel, EducationLevel, GenerationMode, QuizMode } from "@/generated/prisma/enums";

export const createQuizSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1000).optional(),
  subjectId: z.string().uuid().optional(),
  educationLevel: z.enum(EducationLevel),
  difficulty: z.enum(DifficultyLevel),
  mode: z.enum(QuizMode).default(QuizMode.STUDY),
  generationMode: z.enum(GenerationMode).default(GenerationMode.AI),
  answerRevealMode: z.enum(AnswerRevealMode).default(AnswerRevealMode.AFTER_SUBMIT),
  questionDistribution: z.object({
    multipleChoice: z.number().int().min(0).max(50),
    trueFalse: z.number().int().min(0).max(50),
    open: z.number().int().min(0).max(20),
  }),
  timeLimitSeconds: z.number().int().min(60).max(14_400).optional(),
  timePerQuestionSeconds: z.number().int().min(15).max(1_800).optional(),
  materialIds: z.array(z.string().uuid()).max(10).default([]),
}).superRefine((value, context) => {
  const total = value.questionDistribution.multipleChoice + value.questionDistribution.trueFalse + value.questionDistribution.open;
  if (total < 5 || total > 50) context.addIssue({ code: "custom", message: "O quiz deve ter entre 5 e 50 questões.", path: ["questionDistribution"] });
});

export type CreateQuizInput = z.input<typeof createQuizSchema>;
