ALTER TABLE "quiz_versions" ALTER COLUMN "answerRevealMode" SET DEFAULT 'AFTER_QUESTION';--> statement-breakpoint
UPDATE "quiz_versions" SET "answerRevealMode" = 'AFTER_QUESTION'
WHERE "mode" = 'STUDY' AND "answerRevealMode" = 'AFTER_SUBMIT';
