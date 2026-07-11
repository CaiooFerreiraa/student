UPDATE "material_chunks" AS c
SET "embedding" = source."embedding"::vector
FROM unnest($1::uuid[], $2::text[]) AS source("id", "embedding")
WHERE c."id" = source."id"
RETURNING c."id";
