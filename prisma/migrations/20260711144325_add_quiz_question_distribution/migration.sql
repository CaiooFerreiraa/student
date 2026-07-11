-- DropIndex
DROP INDEX "material_chunks_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "quiz_versions" ADD COLUMN     "questionDistribution" JSONB;
