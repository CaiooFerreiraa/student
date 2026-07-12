import "server-only";
import { z } from "zod";

const databaseSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgres"),
});

const blobSchema = z.object({
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  VERCEL_BLOB_CALLBACK_URL: z.string().url().optional(),
});

const aiSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_CHAT_MODEL: z.string().min(1).default("gpt-5.4-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
});

export const databaseEnv = databaseSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
});

export function getBlobEnv(): z.infer<typeof blobSchema> {
  return blobSchema.parse({
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    VERCEL_BLOB_CALLBACK_URL: process.env.VERCEL_BLOB_CALLBACK_URL || undefined,
  });
}

export function getAiEnv(): z.infer<typeof aiSchema> {
  return aiSchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL,
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
  });
}

export function hasBlobConfiguration(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function hasAiConfiguration(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
