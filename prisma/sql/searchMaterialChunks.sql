SELECT
  m."id" AS "materialId",
  m."title" AS "materialTitle",
  c."content",
  c."pageStart",
  c."pageEnd",
  1 - (c."embedding" <=> $2::text::vector) AS "similarity"
FROM "material_chunks" AS c
INNER JOIN "materials" AS m ON m."id" = c."materialId"
WHERE m."ownerId" = $1::uuid
  AND m."deletedAt" IS NULL
  AND m."processingStatus" = 'READY'
  AND c."embedding" IS NOT NULL
ORDER BY c."embedding" <=> $2::text::vector
LIMIT $3;
