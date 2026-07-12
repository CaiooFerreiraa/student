import { pgTable, varchar, timestamp, text, integer, index, uniqueIndex, foreignKey, uuid, bigint, type AnyPgColumn, jsonb, vector, boolean, numeric, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const aiFeature = pgEnum("AiFeature", ['MATERIAL_SUMMARY', 'MATERIAL_EMBEDDING', 'QUIZ_GENERATION', 'OPEN_ANSWER_GRADING', 'ESSAY_TRANSCRIPTION', 'ESSAY_GRADING', 'CHAT'])
export const answerRevealMode = pgEnum("AnswerRevealMode", ['AFTER_QUESTION', 'AFTER_SUBMIT', 'NEVER'])
export const attemptStatus = pgEnum("AttemptStatus", ['IN_PROGRESS', 'SUBMITTED', 'ABANDONED'])
export const conversationStatus = pgEnum("ConversationStatus", ['ACTIVE', 'ARCHIVED'])
export const difficultyLevel = pgEnum("DifficultyLevel", ['EASY', 'MEDIUM', 'HARD'])
export const educationLevel = pgEnum("EducationLevel", ['ELEMENTARY', 'HIGH_SCHOOL', 'UNDERGRADUATE', 'GRADUATE', 'OTHER'])
export const essayEvaluationStatus = pgEnum("EssayEvaluationStatus", ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
export const essayInputType = pgEnum("EssayInputType", ['TEXT', 'DOCX', 'IMAGE'])
export const essaySubmissionStatus = pgEnum("EssaySubmissionStatus", ['UPLOADED', 'EXTRACTING', 'NEEDS_REVIEW', 'READY_TO_GRADE', 'GRADING', 'GRADED', 'FAILED'])
export const essayType = pgEnum("EssayType", ['ENEM', 'DISSERTATIVE', 'FREE'])
export const filePurpose = pgEnum("FilePurpose", ['MATERIAL', 'ESSAY_SUBMISSION', 'AVATAR', 'CONVERSATION_ATTACHMENT'])
export const fileStatus = pgEnum("FileStatus", ['PENDING', 'AVAILABLE', 'DELETE_PENDING', 'DELETED', 'FAILED'])
export const generationMode = pgEnum("GenerationMode", ['MANUAL', 'AI', 'HYBRID'])
export const gradedBy = pgEnum("GradedBy", ['SYSTEM', 'AI', 'MANUAL'])
export const gradingStatus = pgEnum("GradingStatus", ['NOT_REQUIRED', 'PENDING', 'GRADED', 'FAILED'])
export const jobKind = pgEnum("JobKind", ['PROCESS_MATERIAL', 'GENERATE_QUIZ', 'TRANSCRIBE_ESSAY', 'GRADE_ESSAY', 'DELETE_BLOB'])
export const jobStatus = pgEnum("JobStatus", ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'])
export const materialType = pgEnum("MaterialType", ['PDF', 'DOCX', 'IMAGE', 'TEXT'])
export const messageRole = pgEnum("MessageRole", ['USER', 'ASSISTANT', 'SYSTEM', 'TOOL'])
export const processingStatus = pgEnum("ProcessingStatus", ['PENDING', 'PROCESSING', 'READY', 'FAILED'])
export const questionType = pgEnum("QuestionType", ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'OPEN'])
export const quizMode = pgEnum("QuizMode", ['STUDY', 'SIMULATION'])
export const quizStatus = pgEnum("QuizStatus", ['DRAFT', 'GENERATING', 'READY', 'ARCHIVED'])
export const quizVersionStatus = pgEnum("QuizVersionStatus", ['DRAFT', 'GENERATING', 'READY', 'PUBLISHED', 'FAILED'])
export const reviewStatus = pgEnum("ReviewStatus", ['ACTIVE', 'SNOOZED', 'COMPLETED'])
export const runStatus = pgEnum("RunStatus", ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED'])
export const themePreference = pgEnum("ThemePreference", ['LIGHT', 'DARK', 'SYSTEM'])
export const userStatus = pgEnum("UserStatus", ['ACTIVE', 'SUSPENDED', 'DELETED'])


export const fileAssets = pgTable("file_assets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid().notNull(),
	purpose: filePurpose().notNull(),
	status: fileStatus().default('PENDING').notNull(),
	pathname: varchar({ length: 1024 }).notNull(),
	url: text().notNull(),
	downloadUrl: text(),
	originalName: varchar({ length: 255 }).notNull(),
	contentType: varchar({ length: 150 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	byteSize: bigint({ mode: "number" }).notNull(),
	checksum: varchar({ length: 128 }),
	uploadedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	deletedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
}, (table) => [
	index("file_assets_ownerId_checksum_idx").using("btree", table.ownerId.asc().nullsLast().op("text_ops"), table.checksum.asc().nullsLast().op("text_ops")),
	index("file_assets_ownerId_purpose_status_uploadedAt_idx").using("btree", table.ownerId.asc().nullsLast().op("timestamptz_ops"), table.purpose.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("uuid_ops"), table.uploadedAt.desc().nullsFirst().op("enum_ops")),
	uniqueIndex("file_assets_pathname_key").using("btree", table.pathname.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "file_assets_ownerId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const subjects = pgTable("subjects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid(),
	name: varchar({ length: 100 }).notNull(),
	slug: varchar({ length: 120 }).notNull(),
	color: varchar({ length: 20 }),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("subjects_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	uniqueIndex("subjects_ownerId_slug_key").using("btree", table.ownerId.asc().nullsLast().op("text_ops"), table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "subjects_ownerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const quizzes = pgTable("quizzes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid().notNull(),
	subjectId: uuid(),
	currentVersionId: uuid().references((): AnyPgColumn => quizVersions.id, { onUpdate: "cascade", onDelete: "set null" }),
	title: varchar({ length: 160 }).notNull(),
	description: varchar({ length: 1000 }),
	status: quizStatus().default('DRAFT').notNull(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
	deletedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
}, (table) => [
	uniqueIndex("quizzes_currentVersionId_key").using("btree", table.currentVersionId.asc().nullsLast().op("uuid_ops")),
	index("quizzes_ownerId_status_updatedAt_idx").using("btree", table.ownerId.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("uuid_ops"), table.updatedAt.desc().nullsFirst().op("enum_ops")),
	index("quizzes_ownerId_subjectId_idx").using("btree", table.ownerId.asc().nullsLast().op("uuid_ops"), table.subjectId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "quizzes_ownerId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjects.id],
			name: "quizzes_subjectId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const profiles = pgTable("profiles", {
	userId: uuid().primaryKey().notNull(),
	avatarFileId: uuid(),
	bio: varchar({ length: 500 }),
	educationLevel: educationLevel().default('UNDERGRADUATE').notNull(),
	primaryGoal: varchar({ length: 160 }),
	timezone: varchar({ length: 80 }).default('America/Bahia').notNull(),
	locale: varchar({ length: 20 }).default('pt-BR').notNull(),
	weeklyStudyGoalMinutes: integer().default(480).notNull(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
	uniqueIndex("profiles_avatarFileId_key").using("btree", table.avatarFileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "profiles_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.avatarFileId],
			foreignColumns: [fileAssets.id],
			name: "profiles_avatarFileId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const tags = pgTable("tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid().notNull(),
	name: varchar({ length: 50 }).notNull(),
	slug: varchar({ length: 60 }).notNull(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("tags_ownerId_slug_key").using("btree", table.ownerId.asc().nullsLast().op("text_ops"), table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "tags_ownerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const folders = pgTable("folders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid().notNull(),
	parentId: uuid(),
	name: varchar({ length: 100 }).notNull(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
	index("folders_ownerId_parentId_idx").using("btree", table.ownerId.asc().nullsLast().op("uuid_ops"), table.parentId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("folders_ownerId_parentId_name_key").using("btree", table.ownerId.asc().nullsLast().op("text_ops"), table.parentId.asc().nullsLast().op("uuid_ops"), table.name.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "folders_ownerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "folders_parentId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const materials = pgTable("materials", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid().notNull(),
	fileId: uuid().notNull(),
	folderId: uuid(),
	subjectId: uuid(),
	title: varchar({ length: 255 }).notNull(),
	type: materialType().notNull(),
	processingStatus: processingStatus().default('PENDING').notNull(),
	pageCount: integer(),
	summary: text(),
	metadata: jsonb(),
	processingError: text(),
	processedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
	deletedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
}, (table) => [
	uniqueIndex("materials_fileId_key").using("btree", table.fileId.asc().nullsLast().op("uuid_ops")),
	index("materials_ownerId_folderId_createdAt_idx").using("btree", table.ownerId.asc().nullsLast().op("timestamptz_ops"), table.folderId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("materials_ownerId_processingStatus_createdAt_idx").using("btree", table.ownerId.asc().nullsLast().op("enum_ops"), table.processingStatus.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("materials_ownerId_subjectId_idx").using("btree", table.ownerId.asc().nullsLast().op("uuid_ops"), table.subjectId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "materials_ownerId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [fileAssets.id],
			name: "materials_fileId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.folderId],
			foreignColumns: [folders.id],
			name: "materials_folderId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjects.id],
			name: "materials_subjectId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const materialChunks = pgTable("material_chunks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	materialId: uuid().notNull(),
	position: integer().notNull(),
	pageStart: integer(),
	pageEnd: integer(),
	content: text().notNull(),
	tokenCount: integer(),
	contentHash: varchar({ length: 128 }).notNull(),
	metadata: jsonb(),
	embedding: vector({ dimensions: 1536 }),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("material_chunks_contentHash_idx").using("btree", table.contentHash.asc().nullsLast().op("text_ops")),
	index("material_chunks_materialId_pageStart_idx").using("btree", table.materialId.asc().nullsLast().op("int4_ops"), table.pageStart.asc().nullsLast().op("int4_ops")),
	uniqueIndex("material_chunks_materialId_position_key").using("btree", table.materialId.asc().nullsLast().op("uuid_ops"), table.position.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "material_chunks_materialId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const quizVersions = pgTable("quiz_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quizId: uuid().notNull(),
	versionNumber: integer().notNull(),
	status: quizVersionStatus().default('DRAFT').notNull(),
	educationLevel: educationLevel().notNull(),
	difficulty: difficultyLevel().notNull(),
	mode: quizMode().default('STUDY').notNull(),
	generationMode: generationMode().default('AI').notNull(),
	answerRevealMode: answerRevealMode().default('AFTER_SUBMIT').notNull(),
	requestedQuestionCount: integer().notNull(),
	timeLimitSeconds: integer(),
	timePerQuestionSeconds: integer(),
	totalPoints: integer().default(0).notNull(),
	generationModel: varchar({ length: 100 }),
	promptVersion: varchar({ length: 100 }),
	publishedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	questionDistribution: jsonb(),
}, (table) => [
	index("quiz_versions_quizId_status_idx").using("btree", table.quizId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("quiz_versions_quizId_versionNumber_key").using("btree", table.quizId.asc().nullsLast().op("int4_ops"), table.versionNumber.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.quizId],
			foreignColumns: [quizzes.id],
			name: "quiz_versions_quizId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const questionOptions = pgTable("question_options", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	questionId: uuid().notNull(),
	position: integer().notNull(),
	content: text().notNull(),
	isCorrect: boolean().default(false).notNull(),
	explanation: text(),
}, (table) => [
	index("question_options_questionId_isCorrect_idx").using("btree", table.questionId.asc().nullsLast().op("bool_ops"), table.isCorrect.asc().nullsLast().op("bool_ops")),
	uniqueIndex("question_options_questionId_position_key").using("btree", table.questionId.asc().nullsLast().op("int4_ops"), table.position.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "question_options_questionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const questionSources = pgTable("question_sources", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	questionId: uuid().notNull(),
	chunkId: uuid().notNull(),
	pageStart: integer(),
	pageEnd: integer(),
	excerpt: text(),
}, (table) => [
	index("question_sources_chunkId_idx").using("btree", table.chunkId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("question_sources_questionId_chunkId_key").using("btree", table.questionId.asc().nullsLast().op("uuid_ops"), table.chunkId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "question_sources_questionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.chunkId],
			foreignColumns: [materialChunks.id],
			name: "question_sources_chunkId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const quizAttempts = pgTable("quiz_attempts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	quizId: uuid().notNull(),
	quizVersionId: uuid().notNull(),
	status: attemptStatus().default('IN_PROGRESS').notNull(),
	startedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	submittedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
	durationSeconds: integer(),
	score: numeric({ precision: 8, scale:  2 }),
	maximumScore: numeric({ precision: 8, scale:  2 }),
	percentage: numeric({ precision: 5, scale:  2 }),
	correctCount: integer().default(0).notNull(),
	incorrectCount: integer().default(0).notNull(),
	unansweredCount: integer().default(0).notNull(),
}, (table) => [
	index("quiz_attempts_quizVersionId_idx").using("btree", table.quizVersionId.asc().nullsLast().op("uuid_ops")),
	index("quiz_attempts_userId_quizId_submittedAt_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.quizId.asc().nullsLast().op("uuid_ops"), table.submittedAt.desc().nullsFirst().op("uuid_ops")),
	index("quiz_attempts_userId_status_startedAt_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("enum_ops"), table.startedAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "quiz_attempts_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.quizId],
			foreignColumns: [quizzes.id],
			name: "quiz_attempts_quizId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.quizVersionId],
			foreignColumns: [quizVersions.id],
			name: "quiz_attempts_quizVersionId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const questions = pgTable("questions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	quizVersionId: uuid().notNull(),
	position: integer().notNull(),
	type: questionType().notNull(),
	statement: text().notNull(),
	explanation: text(),
	difficulty: difficultyLevel().notNull(),
	points: integer().default(1).notNull(),
	correctBoolean: boolean(),
	modelAnswer: text(),
	gradingRubric: jsonb(),
	minimumAnswerLength: integer(),
	maximumAnswerLength: integer(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("questions_quizVersionId_position_key").using("btree", table.quizVersionId.asc().nullsLast().op("int4_ops"), table.position.asc().nullsLast().op("uuid_ops")),
	index("questions_quizVersionId_type_idx").using("btree", table.quizVersionId.asc().nullsLast().op("enum_ops"), table.type.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.quizVersionId],
			foreignColumns: [quizVersions.id],
			name: "questions_quizVersionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const attemptAnswers = pgTable("attempt_answers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	attemptId: uuid().notNull(),
	questionId: uuid().notNull(),
	selectedOptionId: uuid(),
	booleanAnswer: boolean(),
	textAnswer: text(),
	gradingStatus: gradingStatus().default('NOT_REQUIRED').notNull(),
	isCorrect: boolean(),
	pointsAwarded: numeric({ precision: 8, scale:  2 }),
	feedback: text(),
	gradedBy: gradedBy(),
	gradingModel: varchar({ length: 100 }),
	gradingPromptVersion: varchar({ length: 100 }),
	answeredAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	gradedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
}, (table) => [
	uniqueIndex("attempt_answers_attemptId_questionId_key").using("btree", table.attemptId.asc().nullsLast().op("uuid_ops"), table.questionId.asc().nullsLast().op("uuid_ops")),
	index("attempt_answers_questionId_idx").using("btree", table.questionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.attemptId],
			foreignColumns: [quizAttempts.id],
			name: "attempt_answers_attemptId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "attempt_answers_questionId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.selectedOptionId],
			foreignColumns: [questionOptions.id],
			name: "attempt_answers_selectedOptionId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const quizReviewSchedules = pgTable("quiz_review_schedules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	quizId: uuid().notNull(),
	lastAttemptId: uuid(),
	status: reviewStatus().default('ACTIVE').notNull(),
	nextReviewAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
	intervalDays: integer().default(1).notNull(),
	repetitionCount: integer().default(0).notNull(),
	easeFactor: numeric({ precision: 4, scale:  2 }).default('2.50').notNull(),
	updatedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
	uniqueIndex("quiz_review_schedules_userId_quizId_key").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.quizId.asc().nullsLast().op("uuid_ops")),
	index("quiz_review_schedules_userId_status_nextReviewAt_idx").using("btree", table.userId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("enum_ops"), table.nextReviewAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "quiz_review_schedules_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.quizId],
			foreignColumns: [quizzes.id],
			name: "quiz_review_schedules_quizId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.lastAttemptId],
			foreignColumns: [quizAttempts.id],
			name: "quiz_review_schedules_lastAttemptId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const essayRubrics = pgTable("essay_rubrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid(),
	name: varchar({ length: 120 }).notNull(),
	version: integer().notNull(),
	essayType: essayType().notNull(),
	maximumScore: integer().notNull(),
	isActive: boolean().default(true).notNull(),
	activeFrom: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
	activeUntil: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("essay_rubrics_essayType_isActive_idx").using("btree", table.essayType.asc().nullsLast().op("enum_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	uniqueIndex("essay_rubrics_ownerId_name_version_key").using("btree", table.ownerId.asc().nullsLast().op("text_ops"), table.name.asc().nullsLast().op("text_ops"), table.version.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "essay_rubrics_ownerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const essaySubmissions = pgTable("essay_submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	assignmentId: uuid().notNull(),
	userId: uuid().notNull(),
	finalEvaluationId: uuid().references((): AnyPgColumn => essayEvaluations.id, { onUpdate: "cascade", onDelete: "set null" }),
	inputType: essayInputType().notNull(),
	status: essaySubmissionStatus().default('UPLOADED').notNull(),
	originalText: text(),
	confirmedText: text(),
	startedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	submittedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
	confirmedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
	gradedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
}, (table) => [
	index("essay_submissions_assignmentId_userId_idx").using("btree", table.assignmentId.asc().nullsLast().op("uuid_ops"), table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("essay_submissions_finalEvaluationId_key").using("btree", table.finalEvaluationId.asc().nullsLast().op("uuid_ops")),
	index("essay_submissions_userId_status_startedAt_idx").using("btree", table.userId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("enum_ops"), table.startedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.assignmentId],
			foreignColumns: [essayAssignments.id],
			name: "essay_submissions_assignmentId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "essay_submissions_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const essayEvaluations = pgTable("essay_evaluations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	submissionId: uuid().notNull(),
	rubricId: uuid().notNull(),
	evaluatorIndex: integer().default(1).notNull(),
	status: essayEvaluationStatus().default('PENDING').notNull(),
	totalScore: integer(),
	summary: text(),
	strengths: jsonb(),
	improvementPlan: jsonb(),
	model: varchar({ length: 100 }),
	promptVersion: varchar({ length: 100 }),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	completedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
}, (table) => [
	uniqueIndex("essay_evaluations_submissionId_evaluatorIndex_key").using("btree", table.submissionId.asc().nullsLast().op("int4_ops"), table.evaluatorIndex.asc().nullsLast().op("uuid_ops")),
	index("essay_evaluations_submissionId_status_idx").using("btree", table.submissionId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.submissionId],
			foreignColumns: [essaySubmissions.id],
			name: "essay_evaluations_submissionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [essayRubrics.id],
			name: "essay_evaluations_rubricId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const essayCriterionScores = pgTable("essay_criterion_scores", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	evaluationId: uuid().notNull(),
	criterionId: uuid().notNull(),
	score: integer().notNull(),
	feedback: text().notNull(),
	evidence: jsonb(),
	suggestions: jsonb(),
}, (table) => [
	index("essay_criterion_scores_criterionId_idx").using("btree", table.criterionId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("essay_criterion_scores_evaluationId_criterionId_key").using("btree", table.evaluationId.asc().nullsLast().op("uuid_ops"), table.criterionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.evaluationId],
			foreignColumns: [essayEvaluations.id],
			name: "essay_criterion_scores_evaluationId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.criterionId],
			foreignColumns: [essayRubricCriteria.id],
			name: "essay_criterion_scores_criterionId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const conversations = pgTable("conversations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	title: varchar({ length: 180 }).notNull(),
	status: conversationStatus().default('ACTIVE').notNull(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
	index("conversations_userId_status_updatedAt_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "conversations_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const essayRubricCriteria = pgTable("essay_rubric_criteria", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	rubricId: uuid().notNull(),
	code: varchar({ length: 30 }).notNull(),
	position: integer().notNull(),
	name: varchar({ length: 160 }).notNull(),
	description: text().notNull(),
	maximumScore: integer().notNull(),
	levels: jsonb(),
}, (table) => [
	uniqueIndex("essay_rubric_criteria_rubricId_code_key").using("btree", table.rubricId.asc().nullsLast().op("text_ops"), table.code.asc().nullsLast().op("text_ops")),
	uniqueIndex("essay_rubric_criteria_rubricId_position_key").using("btree", table.rubricId.asc().nullsLast().op("int4_ops"), table.position.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [essayRubrics.id],
			name: "essay_rubric_criteria_rubricId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const essayAssignments = pgTable("essay_assignments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: uuid().notNull(),
	subjectId: uuid(),
	quizVersionId: uuid(),
	rubricId: uuid().notNull(),
	title: varchar({ length: 180 }).notNull(),
	prompt: text().notNull(),
	essayType: essayType().notNull(),
	supportingTexts: jsonb(),
	minimumLines: integer(),
	maximumLines: integer(),
	timeLimitSeconds: integer(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
	deletedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
}, (table) => [
	index("essay_assignments_ownerId_createdAt_idx").using("btree", table.ownerId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("essay_assignments_quizVersionId_idx").using("btree", table.quizVersionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "essay_assignments_ownerId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjects.id],
			name: "essay_assignments_subjectId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.quizVersionId],
			foreignColumns: [quizVersions.id],
			name: "essay_assignments_quizVersionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [essayRubrics.id],
			name: "essay_assignments_rubricId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const essayTranscriptions = pgTable("essay_transcriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	submissionId: uuid().notNull(),
	versionNumber: integer().notNull(),
	rawText: text().notNull(),
	normalizedText: text().notNull(),
	confidence: numeric({ precision: 5, scale:  4 }),
	uncertainSegments: jsonb(),
	model: varchar({ length: 100 }),
	promptVersion: varchar({ length: 100 }),
	confirmedByUserAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("essay_transcriptions_submissionId_versionNumber_key").using("btree", table.submissionId.asc().nullsLast().op("int4_ops"), table.versionNumber.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.submissionId],
			foreignColumns: [essaySubmissions.id],
			name: "essay_transcriptions_submissionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const conversationMessages = pgTable("conversation_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conversationId: uuid().notNull(),
	role: messageRole().notNull(),
	content: text().notNull(),
	structuredData: jsonb(),
	toolName: varchar({ length: 100 }),
	toolCallId: varchar({ length: 150 }),
	inputTokens: integer(),
	outputTokens: integer(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("conversation_messages_conversationId_createdAt_idx").using("btree", table.conversationId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("conversation_messages_toolCallId_idx").using("btree", table.toolCallId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "conversation_messages_conversationId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 320 }).notNull(),
	displayName: varchar({ length: 120 }).notNull(),
	status: userStatus().default('ACTIVE').notNull(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
	deletedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
}, (table) => [
	uniqueIndex("users_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("users_status_createdAt_idx").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
]);

export const userIdentities = pgTable("user_identities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	provider: varchar({ length: 50 }).notNull(),
	subject: varchar({ length: 255 }).notNull(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("user_identities_provider_subject_key").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.subject.asc().nullsLast().op("text_ops")),
	index("user_identities_userId_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_identities_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const aiRuns = pgTable("ai_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid().notNull(),
	feature: aiFeature().notNull(),
	targetType: varchar({ length: 80 }),
	targetId: uuid(),
	status: runStatus().default('PENDING').notNull(),
	model: varchar({ length: 100 }).notNull(),
	promptVersion: varchar({ length: 100 }).notNull(),
	inputTokens: integer(),
	outputTokens: integer(),
	latencyMs: integer(),
	metadata: jsonb(),
	errorCode: varchar({ length: 100 }),
	errorMessage: text(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	completedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
}, (table) => [
	index("ai_runs_targetType_targetId_idx").using("btree", table.targetType.asc().nullsLast().op("text_ops"), table.targetId.asc().nullsLast().op("uuid_ops")),
	index("ai_runs_userId_feature_createdAt_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.feature.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "ai_runs_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const backgroundJobs = pgTable("background_jobs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid(),
	kind: jobKind().notNull(),
	status: jobStatus().default('PENDING').notNull(),
	targetType: varchar({ length: 80 }).notNull(),
	targetId: uuid().notNull(),
	idempotencyKey: varchar({ length: 180 }).notNull(),
	payload: jsonb(),
	attempts: integer().default(0).notNull(),
	maxAttempts: integer().default(3).notNull(),
	runAfter: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	lockedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }),
	lockedBy: varchar({ length: 120 }),
	lastError: text(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
	uniqueIndex("background_jobs_idempotencyKey_key").using("btree", table.idempotencyKey.asc().nullsLast().op("text_ops")),
	index("background_jobs_status_runAfter_idx").using("btree", table.status.asc().nullsLast().op("timestamptz_ops"), table.runAfter.asc().nullsLast().op("enum_ops")),
	index("background_jobs_targetType_targetId_idx").using("btree", table.targetType.asc().nullsLast().op("text_ops"), table.targetId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "background_jobs_userId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const userPreferences = pgTable("user_preferences", {
	userId: uuid().primaryKey().notNull(),
	theme: themePreference().default('LIGHT').notNull(),
	reviewNotifications: boolean().default(true).notNull(),
	weeklySummary: boolean().default(true).notNull(),
	processingNotifications: boolean().default(true).notNull(),
	alwaysShowSources: boolean().default(true).notNull(),
	adaptToEducationLevel: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_preferences_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const materialTags = pgTable("material_tags", {
	materialId: uuid().notNull(),
	tagId: uuid().notNull(),
}, (table) => [
	index("material_tags_tagId_idx").using("btree", table.tagId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "material_tags_materialId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "material_tags_tagId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	primaryKey({ columns: [table.tagId, table.materialId], name: "material_tags_pkey"}),
]);

export const quizTags = pgTable("quiz_tags", {
	quizId: uuid().notNull(),
	tagId: uuid().notNull(),
}, (table) => [
	index("quiz_tags_tagId_idx").using("btree", table.tagId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.quizId],
			foreignColumns: [quizzes.id],
			name: "quiz_tags_quizId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "quiz_tags_tagId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	primaryKey({ columns: [table.tagId, table.quizId], name: "quiz_tags_pkey"}),
]);

export const quizVersionMaterials = pgTable("quiz_version_materials", {
	quizVersionId: uuid().notNull(),
	materialId: uuid().notNull(),
}, (table) => [
	index("quiz_version_materials_materialId_idx").using("btree", table.materialId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.quizVersionId],
			foreignColumns: [quizVersions.id],
			name: "quiz_version_materials_quizVersionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "quiz_version_materials_materialId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	primaryKey({ columns: [table.quizVersionId, table.materialId], name: "quiz_version_materials_pkey"}),
]);

export const conversationMaterials = pgTable("conversation_materials", {
	conversationId: uuid().notNull(),
	materialId: uuid().notNull(),
	createdAt: timestamp({ precision: 3, withTimezone: true, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("conversation_materials_materialId_idx").using("btree", table.materialId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "conversation_materials_conversationId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.materialId],
			foreignColumns: [materials.id],
			name: "conversation_materials_materialId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	primaryKey({ columns: [table.materialId, table.conversationId], name: "conversation_materials_pkey"}),
]);

export const essaySubmissionFiles = pgTable("essay_submission_files", {
	submissionId: uuid().notNull(),
	fileId: uuid().notNull(),
	position: integer().notNull(),
	pageNumber: integer(),
}, (table) => [
	index("essay_submission_files_fileId_idx").using("btree", table.fileId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("essay_submission_files_submissionId_position_key").using("btree", table.submissionId.asc().nullsLast().op("int4_ops"), table.position.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.submissionId],
			foreignColumns: [essaySubmissions.id],
			name: "essay_submission_files_submissionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [fileAssets.id],
			name: "essay_submission_files_fileId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	primaryKey({ columns: [table.submissionId, table.fileId], name: "essay_submission_files_pkey"}),
]);
