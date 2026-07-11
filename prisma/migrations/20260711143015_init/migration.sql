-- Extensions required by the application
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('ELEMENTARY', 'HIGH_SCHOOL', 'UNDERGRADUATE', 'GRADUATE', 'OTHER');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('MATERIAL', 'ESSAY_SUBMISSION', 'AVATAR', 'CONVERSATION_ATTACHMENT');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'AVAILABLE', 'DELETE_PENDING', 'DELETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('PDF', 'DOCX', 'IMAGE', 'TEXT');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuizVersionStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuizMode" AS ENUM ('STUDY', 'SIMULATION');

-- CreateEnum
CREATE TYPE "GenerationMode" AS ENUM ('MANUAL', 'AI', 'HYBRID');

-- CreateEnum
CREATE TYPE "AnswerRevealMode" AS ENUM ('AFTER_QUESTION', 'AFTER_SUBMIT', 'NEVER');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'OPEN');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "GradingStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'GRADED', 'FAILED');

-- CreateEnum
CREATE TYPE "GradedBy" AS ENUM ('SYSTEM', 'AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('ACTIVE', 'SNOOZED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EssayType" AS ENUM ('ENEM', 'DISSERTATIVE', 'FREE');

-- CreateEnum
CREATE TYPE "EssayInputType" AS ENUM ('TEXT', 'DOCX', 'IMAGE');

-- CreateEnum
CREATE TYPE "EssaySubmissionStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'NEEDS_REVIEW', 'READY_TO_GRADE', 'GRADING', 'GRADED', 'FAILED');

-- CreateEnum
CREATE TYPE "EssayEvaluationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('MATERIAL_SUMMARY', 'MATERIAL_EMBEDDING', 'QUIZ_GENERATION', 'OPEN_ANSWER_GRADING', 'ESSAY_TRANSCRIPTION', 'ESSAY_GRADING', 'CHAT');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('PROCESS_MATERIAL', 'GENERATE_QUIZ', 'TRANSCRIBE_ESSAY', 'GRADE_ESSAY', 'DELETE_BLOB');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "userId" UUID NOT NULL,
    "avatarFileId" UUID,
    "bio" VARCHAR(500),
    "educationLevel" "EducationLevel" NOT NULL DEFAULT 'UNDERGRADUATE',
    "primaryGoal" VARCHAR(160),
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'America/Bahia',
    "locale" VARCHAR(20) NOT NULL DEFAULT 'pt-BR',
    "weeklyStudyGoalMinutes" INTEGER NOT NULL DEFAULT 480,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "color" VARCHAR(20),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "pathname" VARCHAR(1024) NOT NULL,
    "url" TEXT NOT NULL,
    "downloadUrl" TEXT,
    "originalName" VARCHAR(255) NOT NULL,
    "contentType" VARCHAR(150) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "checksum" VARCHAR(128),
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "parentId" UUID,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "folderId" UUID,
    "subjectId" UUID,
    "title" VARCHAR(255) NOT NULL,
    "type" "MaterialType" NOT NULL,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "pageCount" INTEGER,
    "summary" TEXT,
    "metadata" JSONB,
    "processingError" TEXT,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_tags" (
    "materialId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "material_tags_pkey" PRIMARY KEY ("materialId","tagId")
);

-- CreateTable
CREATE TABLE "material_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "materialId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "contentHash" VARCHAR(128) NOT NULL,
    "metadata" JSONB,
    "embedding" vector(1536),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "subjectId" UUID,
    "currentVersionId" UUID,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000),
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_tags" (
    "quizId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "quiz_tags_pkey" PRIMARY KEY ("quizId","tagId")
);

-- CreateTable
CREATE TABLE "quiz_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quizId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "QuizVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "educationLevel" "EducationLevel" NOT NULL,
    "difficulty" "DifficultyLevel" NOT NULL,
    "mode" "QuizMode" NOT NULL DEFAULT 'STUDY',
    "generationMode" "GenerationMode" NOT NULL DEFAULT 'AI',
    "answerRevealMode" "AnswerRevealMode" NOT NULL DEFAULT 'AFTER_SUBMIT',
    "requestedQuestionCount" INTEGER NOT NULL,
    "timeLimitSeconds" INTEGER,
    "timePerQuestionSeconds" INTEGER,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "generationModel" VARCHAR(100),
    "promptVersion" VARCHAR(100),
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_version_materials" (
    "quizVersionId" UUID NOT NULL,
    "materialId" UUID NOT NULL,

    CONSTRAINT "quiz_version_materials_pkey" PRIMARY KEY ("quizVersionId","materialId")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quizVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL,
    "statement" TEXT NOT NULL,
    "explanation" TEXT,
    "difficulty" "DifficultyLevel" NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "correctBoolean" BOOLEAN,
    "modelAnswer" TEXT,
    "gradingRubric" JSONB,
    "minimumAnswerLength" INTEGER,
    "maximumAnswerLength" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "questionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "questionId" UUID NOT NULL,
    "chunkId" UUID NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "excerpt" TEXT,

    CONSTRAINT "question_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "quizVersionId" UUID NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMPTZ(3),
    "durationSeconds" INTEGER,
    "score" DECIMAL(8,2),
    "maximumScore" DECIMAL(8,2),
    "percentage" DECIMAL(5,2),
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "unansweredCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "selectedOptionId" UUID,
    "booleanAnswer" BOOLEAN,
    "textAnswer" TEXT,
    "gradingStatus" "GradingStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "isCorrect" BOOLEAN,
    "pointsAwarded" DECIMAL(8,2),
    "feedback" TEXT,
    "gradedBy" "GradedBy",
    "gradingModel" VARCHAR(100),
    "gradingPromptVersion" VARCHAR(100),
    "answeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMPTZ(3),

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_review_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "lastAttemptId" UUID,
    "status" "ReviewStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextReviewAt" TIMESTAMPTZ(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "repetitionCount" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DECIMAL(4,2) NOT NULL DEFAULT 2.50,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quiz_review_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essay_rubrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "version" INTEGER NOT NULL,
    "essayType" "EssayType" NOT NULL,
    "maximumScore" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activeFrom" TIMESTAMPTZ(3),
    "activeUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "essay_rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essay_rubric_criteria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rubricId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "maximumScore" INTEGER NOT NULL,
    "levels" JSONB,

    CONSTRAINT "essay_rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essay_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "subjectId" UUID,
    "quizVersionId" UUID,
    "rubricId" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "prompt" TEXT NOT NULL,
    "essayType" "EssayType" NOT NULL,
    "supportingTexts" JSONB,
    "minimumLines" INTEGER,
    "maximumLines" INTEGER,
    "timeLimitSeconds" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "essay_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essay_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assignmentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "finalEvaluationId" UUID,
    "inputType" "EssayInputType" NOT NULL,
    "status" "EssaySubmissionStatus" NOT NULL DEFAULT 'UPLOADED',
    "originalText" TEXT,
    "confirmedText" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "gradedAt" TIMESTAMPTZ(3),

    CONSTRAINT "essay_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essay_submission_files" (
    "submissionId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "pageNumber" INTEGER,

    CONSTRAINT "essay_submission_files_pkey" PRIMARY KEY ("submissionId","fileId")
);

-- CreateTable
CREATE TABLE "essay_transcriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submissionId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "uncertainSegments" JSONB,
    "model" VARCHAR(100),
    "promptVersion" VARCHAR(100),
    "confirmedByUserAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "essay_transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essay_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submissionId" UUID NOT NULL,
    "rubricId" UUID NOT NULL,
    "evaluatorIndex" INTEGER NOT NULL DEFAULT 1,
    "status" "EssayEvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "totalScore" INTEGER,
    "summary" TEXT,
    "strengths" JSONB,
    "improvementPlan" JSONB,
    "model" VARCHAR(100),
    "promptVersion" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "essay_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essay_criterion_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evaluationId" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "evidence" JSONB,
    "suggestions" JSONB,

    CONSTRAINT "essay_criterion_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_materials" (
    "conversationId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_materials_pkey" PRIMARY KEY ("conversationId","materialId")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversationId" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "structuredData" JSONB,
    "toolName" VARCHAR(100),
    "toolCallId" VARCHAR(150),
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "targetType" VARCHAR(80),
    "targetId" UUID,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "model" VARCHAR(100) NOT NULL,
    "promptVersion" VARCHAR(100) NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "metadata" JSONB,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "kind" "JobKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "targetType" VARCHAR(80) NOT NULL,
    "targetId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMPTZ(3),
    "lockedBy" VARCHAR(120),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_createdAt_idx" ON "users"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_identities_userId_idx" ON "user_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_subject_key" ON "user_identities"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_avatarFileId_key" ON "profiles"("avatarFileId");

-- CreateIndex
CREATE INDEX "subjects_name_idx" ON "subjects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_ownerId_slug_key" ON "subjects"("ownerId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_ownerId_slug_key" ON "tags"("ownerId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_pathname_key" ON "file_assets"("pathname");

-- CreateIndex
CREATE INDEX "file_assets_ownerId_purpose_status_uploadedAt_idx" ON "file_assets"("ownerId", "purpose", "status", "uploadedAt" DESC);

-- CreateIndex
CREATE INDEX "file_assets_ownerId_checksum_idx" ON "file_assets"("ownerId", "checksum");

-- CreateIndex
CREATE INDEX "folders_ownerId_parentId_idx" ON "folders"("ownerId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "folders_ownerId_parentId_name_key" ON "folders"("ownerId", "parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "materials_fileId_key" ON "materials"("fileId");

-- CreateIndex
CREATE INDEX "materials_ownerId_processingStatus_createdAt_idx" ON "materials"("ownerId", "processingStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "materials_ownerId_folderId_createdAt_idx" ON "materials"("ownerId", "folderId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "materials_ownerId_subjectId_idx" ON "materials"("ownerId", "subjectId");

-- CreateIndex
CREATE INDEX "material_tags_tagId_idx" ON "material_tags"("tagId");

-- CreateIndex
CREATE INDEX "material_chunks_materialId_pageStart_idx" ON "material_chunks"("materialId", "pageStart");

-- CreateIndex
CREATE INDEX "material_chunks_contentHash_idx" ON "material_chunks"("contentHash");

-- Vector similarity index used by material retrieval (cosine distance)
CREATE INDEX "material_chunks_embedding_hnsw_idx"
ON "material_chunks"
USING hnsw ("embedding" vector_cosine_ops);

-- CreateIndex
CREATE UNIQUE INDEX "material_chunks_materialId_position_key" ON "material_chunks"("materialId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_currentVersionId_key" ON "quizzes"("currentVersionId");

-- CreateIndex
CREATE INDEX "quizzes_ownerId_status_updatedAt_idx" ON "quizzes"("ownerId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "quizzes_ownerId_subjectId_idx" ON "quizzes"("ownerId", "subjectId");

-- CreateIndex
CREATE INDEX "quiz_tags_tagId_idx" ON "quiz_tags"("tagId");

-- CreateIndex
CREATE INDEX "quiz_versions_quizId_status_idx" ON "quiz_versions"("quizId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_versions_quizId_versionNumber_key" ON "quiz_versions"("quizId", "versionNumber");

-- CreateIndex
CREATE INDEX "quiz_version_materials_materialId_idx" ON "quiz_version_materials"("materialId");

-- CreateIndex
CREATE INDEX "questions_quizVersionId_type_idx" ON "questions"("quizVersionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "questions_quizVersionId_position_key" ON "questions"("quizVersionId", "position");

-- CreateIndex
CREATE INDEX "question_options_questionId_isCorrect_idx" ON "question_options"("questionId", "isCorrect");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_questionId_position_key" ON "question_options"("questionId", "position");

-- CreateIndex
CREATE INDEX "question_sources_chunkId_idx" ON "question_sources"("chunkId");

-- CreateIndex
CREATE UNIQUE INDEX "question_sources_questionId_chunkId_key" ON "question_sources"("questionId", "chunkId");

-- CreateIndex
CREATE INDEX "quiz_attempts_userId_status_startedAt_idx" ON "quiz_attempts"("userId", "status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "quiz_attempts_userId_quizId_submittedAt_idx" ON "quiz_attempts"("userId", "quizId", "submittedAt" DESC);

-- CreateIndex
CREATE INDEX "quiz_attempts_quizVersionId_idx" ON "quiz_attempts"("quizVersionId");

-- CreateIndex
CREATE INDEX "attempt_answers_questionId_idx" ON "attempt_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_attemptId_questionId_key" ON "attempt_answers"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "quiz_review_schedules_userId_status_nextReviewAt_idx" ON "quiz_review_schedules"("userId", "status", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_review_schedules_userId_quizId_key" ON "quiz_review_schedules"("userId", "quizId");

-- CreateIndex
CREATE INDEX "essay_rubrics_essayType_isActive_idx" ON "essay_rubrics"("essayType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "essay_rubrics_ownerId_name_version_key" ON "essay_rubrics"("ownerId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "essay_rubric_criteria_rubricId_code_key" ON "essay_rubric_criteria"("rubricId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "essay_rubric_criteria_rubricId_position_key" ON "essay_rubric_criteria"("rubricId", "position");

-- CreateIndex
CREATE INDEX "essay_assignments_ownerId_createdAt_idx" ON "essay_assignments"("ownerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "essay_assignments_quizVersionId_idx" ON "essay_assignments"("quizVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "essay_submissions_finalEvaluationId_key" ON "essay_submissions"("finalEvaluationId");

-- CreateIndex
CREATE INDEX "essay_submissions_userId_status_startedAt_idx" ON "essay_submissions"("userId", "status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "essay_submissions_assignmentId_userId_idx" ON "essay_submissions"("assignmentId", "userId");

-- CreateIndex
CREATE INDEX "essay_submission_files_fileId_idx" ON "essay_submission_files"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "essay_submission_files_submissionId_position_key" ON "essay_submission_files"("submissionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "essay_transcriptions_submissionId_versionNumber_key" ON "essay_transcriptions"("submissionId", "versionNumber");

-- CreateIndex
CREATE INDEX "essay_evaluations_submissionId_status_idx" ON "essay_evaluations"("submissionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "essay_evaluations_submissionId_evaluatorIndex_key" ON "essay_evaluations"("submissionId", "evaluatorIndex");

-- CreateIndex
CREATE INDEX "essay_criterion_scores_criterionId_idx" ON "essay_criterion_scores"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "essay_criterion_scores_evaluationId_criterionId_key" ON "essay_criterion_scores"("evaluationId", "criterionId");

-- CreateIndex
CREATE INDEX "conversations_userId_status_updatedAt_idx" ON "conversations"("userId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "conversation_materials_materialId_idx" ON "conversation_materials"("materialId");

-- CreateIndex
CREATE INDEX "conversation_messages_conversationId_createdAt_idx" ON "conversation_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "conversation_messages_toolCallId_idx" ON "conversation_messages"("toolCallId");

-- CreateIndex
CREATE INDEX "ai_runs_userId_feature_createdAt_idx" ON "ai_runs"("userId", "feature", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_runs_targetType_targetId_idx" ON "ai_runs"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "background_jobs_idempotencyKey_key" ON "background_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "background_jobs_status_runAfter_idx" ON "background_jobs"("status", "runAfter");

-- CreateIndex
CREATE INDEX "background_jobs_targetType_targetId_idx" ON "background_jobs"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_tags" ADD CONSTRAINT "material_tags_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_tags" ADD CONSTRAINT "material_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_chunks" ADD CONSTRAINT "material_chunks_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "quiz_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_tags" ADD CONSTRAINT "quiz_tags_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_tags" ADD CONSTRAINT "quiz_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_versions" ADD CONSTRAINT "quiz_versions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_version_materials" ADD CONSTRAINT "quiz_version_materials_quizVersionId_fkey" FOREIGN KEY ("quizVersionId") REFERENCES "quiz_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_version_materials" ADD CONSTRAINT "quiz_version_materials_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_quizVersionId_fkey" FOREIGN KEY ("quizVersionId") REFERENCES "quiz_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_sources" ADD CONSTRAINT "question_sources_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_sources" ADD CONSTRAINT "question_sources_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "material_chunks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizVersionId_fkey" FOREIGN KEY ("quizVersionId") REFERENCES "quiz_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_review_schedules" ADD CONSTRAINT "quiz_review_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_review_schedules" ADD CONSTRAINT "quiz_review_schedules_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_review_schedules" ADD CONSTRAINT "quiz_review_schedules_lastAttemptId_fkey" FOREIGN KEY ("lastAttemptId") REFERENCES "quiz_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_rubrics" ADD CONSTRAINT "essay_rubrics_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_rubric_criteria" ADD CONSTRAINT "essay_rubric_criteria_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "essay_rubrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_assignments" ADD CONSTRAINT "essay_assignments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_assignments" ADD CONSTRAINT "essay_assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_assignments" ADD CONSTRAINT "essay_assignments_quizVersionId_fkey" FOREIGN KEY ("quizVersionId") REFERENCES "quiz_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_assignments" ADD CONSTRAINT "essay_assignments_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "essay_rubrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_submissions" ADD CONSTRAINT "essay_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "essay_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_submissions" ADD CONSTRAINT "essay_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_submissions" ADD CONSTRAINT "essay_submissions_finalEvaluationId_fkey" FOREIGN KEY ("finalEvaluationId") REFERENCES "essay_evaluations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_submission_files" ADD CONSTRAINT "essay_submission_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "essay_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_submission_files" ADD CONSTRAINT "essay_submission_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_transcriptions" ADD CONSTRAINT "essay_transcriptions_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "essay_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_evaluations" ADD CONSTRAINT "essay_evaluations_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "essay_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_evaluations" ADD CONSTRAINT "essay_evaluations_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "essay_rubrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_criterion_scores" ADD CONSTRAINT "essay_criterion_scores_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "essay_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essay_criterion_scores" ADD CONSTRAINT "essay_criterion_scores_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "essay_rubric_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_materials" ADD CONSTRAINT "conversation_materials_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_materials" ADD CONSTRAINT "conversation_materials_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
