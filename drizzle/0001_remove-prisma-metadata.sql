ALTER TABLE "_prisma_migrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "_prisma_migrations" CASCADE;--> statement-breakpoint
ALTER TABLE "quizzes" DROP CONSTRAINT "quizzes_currentVersionId_fkey";
--> statement-breakpoint
ALTER TABLE "essay_submissions" DROP CONSTRAINT "essay_submissions_finalEvaluationId_fkey";
--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_currentVersionId_quiz_versions_id_fk" FOREIGN KEY ("currentVersionId") REFERENCES "public"."quiz_versions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "essay_submissions" ADD CONSTRAINT "essay_submissions_finalEvaluationId_essay_evaluations_id_fk" FOREIGN KEY ("finalEvaluationId") REFERENCES "public"."essay_evaluations"("id") ON DELETE set null ON UPDATE cascade;