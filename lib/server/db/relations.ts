import { relations } from "drizzle-orm/relations";
import { users, fileAssets, subjects, quizzes, quizVersions, profiles, tags, folders, materials, materialChunks, questions, questionOptions, questionSources, quizAttempts, attemptAnswers, quizReviewSchedules, essayRubrics, essayAssignments, essaySubmissions, essayEvaluations, essayCriterionScores, essayRubricCriteria, conversations, essayTranscriptions, conversationMessages, userIdentities, aiRuns, backgroundJobs, userPreferences, materialTags, quizTags, quizVersionMaterials, conversationMaterials, essaySubmissionFiles } from "./schema";

export const fileAssetsRelations = relations(fileAssets, ({one, many}) => ({
	user: one(users, {
		fields: [fileAssets.ownerId],
		references: [users.id]
	}),
	profiles: many(profiles),
	materials: many(materials),
	essaySubmissionFiles: many(essaySubmissionFiles),
}));

export const usersRelations = relations(users, ({many}) => ({
	fileAssets: many(fileAssets),
	subjects: many(subjects),
	quizzes: many(quizzes),
	profiles: many(profiles),
	tags: many(tags),
	folders: many(folders),
	materials: many(materials),
	quizAttempts: many(quizAttempts),
	quizReviewSchedules: many(quizReviewSchedules),
	essayRubrics: many(essayRubrics),
	essaySubmissions: many(essaySubmissions),
	conversations: many(conversations),
	essayAssignments: many(essayAssignments),
	userIdentities: many(userIdentities),
	aiRuns: many(aiRuns),
	backgroundJobs: many(backgroundJobs),
	userPreferences: many(userPreferences),
}));

export const subjectsRelations = relations(subjects, ({one, many}) => ({
	user: one(users, {
		fields: [subjects.ownerId],
		references: [users.id]
	}),
	quizzes: many(quizzes),
	materials: many(materials),
	essayAssignments: many(essayAssignments),
}));

export const quizzesRelations = relations(quizzes, ({one, many}) => ({
	user: one(users, {
		fields: [quizzes.ownerId],
		references: [users.id]
	}),
	subject: one(subjects, {
		fields: [quizzes.subjectId],
		references: [subjects.id]
	}),
	quizVersion: one(quizVersions, {
		fields: [quizzes.currentVersionId],
		references: [quizVersions.id],
		relationName: "quizzes_currentVersionId_quizVersions_id"
	}),
	quizVersions: many(quizVersions, {
		relationName: "quizVersions_quizId_quizzes_id"
	}),
	quizAttempts: many(quizAttempts),
	quizReviewSchedules: many(quizReviewSchedules),
	quizTags: many(quizTags),
}));

export const quizVersionsRelations = relations(quizVersions, ({one, many}) => ({
	quizzes: many(quizzes, {
		relationName: "quizzes_currentVersionId_quizVersions_id"
	}),
	quiz: one(quizzes, {
		fields: [quizVersions.quizId],
		references: [quizzes.id],
		relationName: "quizVersions_quizId_quizzes_id"
	}),
	quizAttempts: many(quizAttempts),
	questions: many(questions),
	essayAssignments: many(essayAssignments),
	quizVersionMaterials: many(quizVersionMaterials),
}));

export const profilesRelations = relations(profiles, ({one}) => ({
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
	fileAsset: one(fileAssets, {
		fields: [profiles.avatarFileId],
		references: [fileAssets.id]
	}),
}));

export const tagsRelations = relations(tags, ({one, many}) => ({
	user: one(users, {
		fields: [tags.ownerId],
		references: [users.id]
	}),
	materialTags: many(materialTags),
	quizTags: many(quizTags),
}));

export const foldersRelations = relations(folders, ({one, many}) => ({
	user: one(users, {
		fields: [folders.ownerId],
		references: [users.id]
	}),
	folder: one(folders, {
		fields: [folders.parentId],
		references: [folders.id],
		relationName: "folders_parentId_folders_id"
	}),
	folders: many(folders, {
		relationName: "folders_parentId_folders_id"
	}),
	materials: many(materials),
}));

export const materialsRelations = relations(materials, ({one, many}) => ({
	user: one(users, {
		fields: [materials.ownerId],
		references: [users.id]
	}),
	fileAsset: one(fileAssets, {
		fields: [materials.fileId],
		references: [fileAssets.id]
	}),
	folder: one(folders, {
		fields: [materials.folderId],
		references: [folders.id]
	}),
	subject: one(subjects, {
		fields: [materials.subjectId],
		references: [subjects.id]
	}),
	materialChunks: many(materialChunks),
	materialTags: many(materialTags),
	quizVersionMaterials: many(quizVersionMaterials),
	conversationMaterials: many(conversationMaterials),
}));

export const materialChunksRelations = relations(materialChunks, ({one, many}) => ({
	material: one(materials, {
		fields: [materialChunks.materialId],
		references: [materials.id]
	}),
	questionSources: many(questionSources),
}));

export const questionOptionsRelations = relations(questionOptions, ({one, many}) => ({
	question: one(questions, {
		fields: [questionOptions.questionId],
		references: [questions.id]
	}),
	attemptAnswers: many(attemptAnswers),
}));

export const questionsRelations = relations(questions, ({one, many}) => ({
	questionOptions: many(questionOptions),
	questionSources: many(questionSources),
	quizVersion: one(quizVersions, {
		fields: [questions.quizVersionId],
		references: [quizVersions.id]
	}),
	attemptAnswers: many(attemptAnswers),
}));

export const questionSourcesRelations = relations(questionSources, ({one}) => ({
	question: one(questions, {
		fields: [questionSources.questionId],
		references: [questions.id]
	}),
	materialChunk: one(materialChunks, {
		fields: [questionSources.chunkId],
		references: [materialChunks.id]
	}),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({one, many}) => ({
	user: one(users, {
		fields: [quizAttempts.userId],
		references: [users.id]
	}),
	quiz: one(quizzes, {
		fields: [quizAttempts.quizId],
		references: [quizzes.id]
	}),
	quizVersion: one(quizVersions, {
		fields: [quizAttempts.quizVersionId],
		references: [quizVersions.id]
	}),
	attemptAnswers: many(attemptAnswers),
	quizReviewSchedules: many(quizReviewSchedules),
}));

export const attemptAnswersRelations = relations(attemptAnswers, ({one}) => ({
	quizAttempt: one(quizAttempts, {
		fields: [attemptAnswers.attemptId],
		references: [quizAttempts.id]
	}),
	question: one(questions, {
		fields: [attemptAnswers.questionId],
		references: [questions.id]
	}),
	questionOption: one(questionOptions, {
		fields: [attemptAnswers.selectedOptionId],
		references: [questionOptions.id]
	}),
}));

export const quizReviewSchedulesRelations = relations(quizReviewSchedules, ({one}) => ({
	user: one(users, {
		fields: [quizReviewSchedules.userId],
		references: [users.id]
	}),
	quiz: one(quizzes, {
		fields: [quizReviewSchedules.quizId],
		references: [quizzes.id]
	}),
	quizAttempt: one(quizAttempts, {
		fields: [quizReviewSchedules.lastAttemptId],
		references: [quizAttempts.id]
	}),
}));

export const essayRubricsRelations = relations(essayRubrics, ({one, many}) => ({
	user: one(users, {
		fields: [essayRubrics.ownerId],
		references: [users.id]
	}),
	essayEvaluations: many(essayEvaluations),
	essayRubricCriteria: many(essayRubricCriteria),
	essayAssignments: many(essayAssignments),
}));

export const essaySubmissionsRelations = relations(essaySubmissions, ({one, many}) => ({
	essayAssignment: one(essayAssignments, {
		fields: [essaySubmissions.assignmentId],
		references: [essayAssignments.id]
	}),
	user: one(users, {
		fields: [essaySubmissions.userId],
		references: [users.id]
	}),
	essayEvaluation: one(essayEvaluations, {
		fields: [essaySubmissions.finalEvaluationId],
		references: [essayEvaluations.id],
		relationName: "essaySubmissions_finalEvaluationId_essayEvaluations_id"
	}),
	essayEvaluations: many(essayEvaluations, {
		relationName: "essayEvaluations_submissionId_essaySubmissions_id"
	}),
	essayTranscriptions: many(essayTranscriptions),
	essaySubmissionFiles: many(essaySubmissionFiles),
}));

export const essayAssignmentsRelations = relations(essayAssignments, ({one, many}) => ({
	essaySubmissions: many(essaySubmissions),
	user: one(users, {
		fields: [essayAssignments.ownerId],
		references: [users.id]
	}),
	subject: one(subjects, {
		fields: [essayAssignments.subjectId],
		references: [subjects.id]
	}),
	quizVersion: one(quizVersions, {
		fields: [essayAssignments.quizVersionId],
		references: [quizVersions.id]
	}),
	essayRubric: one(essayRubrics, {
		fields: [essayAssignments.rubricId],
		references: [essayRubrics.id]
	}),
}));

export const essayEvaluationsRelations = relations(essayEvaluations, ({one, many}) => ({
	essaySubmissions: many(essaySubmissions, {
		relationName: "essaySubmissions_finalEvaluationId_essayEvaluations_id"
	}),
	essaySubmission: one(essaySubmissions, {
		fields: [essayEvaluations.submissionId],
		references: [essaySubmissions.id],
		relationName: "essayEvaluations_submissionId_essaySubmissions_id"
	}),
	essayRubric: one(essayRubrics, {
		fields: [essayEvaluations.rubricId],
		references: [essayRubrics.id]
	}),
	essayCriterionScores: many(essayCriterionScores),
}));

export const essayCriterionScoresRelations = relations(essayCriterionScores, ({one}) => ({
	essayEvaluation: one(essayEvaluations, {
		fields: [essayCriterionScores.evaluationId],
		references: [essayEvaluations.id]
	}),
	essayRubricCriterion: one(essayRubricCriteria, {
		fields: [essayCriterionScores.criterionId],
		references: [essayRubricCriteria.id]
	}),
}));

export const essayRubricCriteriaRelations = relations(essayRubricCriteria, ({one, many}) => ({
	essayCriterionScores: many(essayCriterionScores),
	essayRubric: one(essayRubrics, {
		fields: [essayRubricCriteria.rubricId],
		references: [essayRubrics.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	user: one(users, {
		fields: [conversations.userId],
		references: [users.id]
	}),
	conversationMessages: many(conversationMessages),
	conversationMaterials: many(conversationMaterials),
}));

export const essayTranscriptionsRelations = relations(essayTranscriptions, ({one}) => ({
	essaySubmission: one(essaySubmissions, {
		fields: [essayTranscriptions.submissionId],
		references: [essaySubmissions.id]
	}),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({one}) => ({
	conversation: one(conversations, {
		fields: [conversationMessages.conversationId],
		references: [conversations.id]
	}),
}));

export const userIdentitiesRelations = relations(userIdentities, ({one}) => ({
	user: one(users, {
		fields: [userIdentities.userId],
		references: [users.id]
	}),
}));

export const aiRunsRelations = relations(aiRuns, ({one}) => ({
	user: one(users, {
		fields: [aiRuns.userId],
		references: [users.id]
	}),
}));

export const backgroundJobsRelations = relations(backgroundJobs, ({one}) => ({
	user: one(users, {
		fields: [backgroundJobs.userId],
		references: [users.id]
	}),
}));

export const userPreferencesRelations = relations(userPreferences, ({one}) => ({
	user: one(users, {
		fields: [userPreferences.userId],
		references: [users.id]
	}),
}));

export const materialTagsRelations = relations(materialTags, ({one}) => ({
	material: one(materials, {
		fields: [materialTags.materialId],
		references: [materials.id]
	}),
	tag: one(tags, {
		fields: [materialTags.tagId],
		references: [tags.id]
	}),
}));

export const quizTagsRelations = relations(quizTags, ({one}) => ({
	quiz: one(quizzes, {
		fields: [quizTags.quizId],
		references: [quizzes.id]
	}),
	tag: one(tags, {
		fields: [quizTags.tagId],
		references: [tags.id]
	}),
}));

export const quizVersionMaterialsRelations = relations(quizVersionMaterials, ({one}) => ({
	quizVersion: one(quizVersions, {
		fields: [quizVersionMaterials.quizVersionId],
		references: [quizVersions.id]
	}),
	material: one(materials, {
		fields: [quizVersionMaterials.materialId],
		references: [materials.id]
	}),
}));

export const conversationMaterialsRelations = relations(conversationMaterials, ({one}) => ({
	conversation: one(conversations, {
		fields: [conversationMaterials.conversationId],
		references: [conversations.id]
	}),
	material: one(materials, {
		fields: [conversationMaterials.materialId],
		references: [materials.id]
	}),
}));

export const essaySubmissionFilesRelations = relations(essaySubmissionFiles, ({one}) => ({
	essaySubmission: one(essaySubmissions, {
		fields: [essaySubmissionFiles.submissionId],
		references: [essaySubmissions.id]
	}),
	fileAsset: one(fileAssets, {
		fields: [essaySubmissionFiles.fileId],
		references: [fileAssets.id]
	}),
}));