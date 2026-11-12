import { createHash } from "crypto";
import { GoogleGenerativeAI, GenerativeModel, Part } from "@google/generative-ai";
import { z } from "zod";
import { AppError } from "../middleware/errorHandler";
import { InvalidStructuredOutputError, requestStructuredOutput } from "../utils/structuredOutput";
import { withRetry } from "../utils/retry";
import { zodToGeminiSchema } from "../utils/zodToGeminiSchema";

export const FLASH_MODEL = "gemini-2.5-flash";
export const EMBEDDING_MODEL = "gemini-embedding-001";
const TEMPERATURE = 0.1;

let flashModel: GenerativeModel;
let embeddingModel: GenerativeModel;

/** Stores model responses by request, so the eval suite can replay them without calling Gemini. */
export interface ResponseCache {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

let responseCache: ResponseCache | null = null;

export const setResponseCache = (cache: ResponseCache | null): void => { responseCache = cache; };

// The key covers the model, settings, schema and full prompt, so changing any of them is a cache miss.
const requestKey = (request: unknown): string => createHash("sha256").update(JSON.stringify(request)).digest("hex");

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const getStatus = (error: unknown): number | undefined => (error as { status?: number }).status;

export const isRetryableGeminiError = (error: unknown): boolean => {
  if (error instanceof InvalidStructuredOutputError) return true;
  const status = getStatus(error);
  if (status !== undefined) return RETRYABLE_STATUSES.has(status);
  // The SDK reports network failures as a plain error with no status.
  return error instanceof Error && error.message.includes("Error fetching from");
};

export const toAppError = (error: unknown): AppError => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Gemini] Request failed: ${message}`);
  if (getStatus(error) === 429) return new AppError("The AI service is busy. Please try again shortly.", 503);
  if (error instanceof InvalidStructuredOutputError) return new AppError("The AI service returned an unusable response. Please try again.", 502);
  return new AppError("The AI service request failed. Please try again.", 502);
};

export const initGemini = (): void => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");
  const genAI = new GoogleGenerativeAI(apiKey);
  flashModel = genAI.getGenerativeModel({ model: FLASH_MODEL });
  embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  console.log("✅ Gemini AI initialized");
};

/** Asks Gemini for output matching the Zod schema, retrying failed requests and invalid output. */
export const generateStructured = async <S extends z.ZodTypeAny>(schema: S, parts: Part[]): Promise<z.output<S>> => {
  const responseSchema = zodToGeminiSchema(schema);
  const key = requestKey({ model: FLASH_MODEL, temperature: TEMPERATURE, responseSchema, parts });
  const generate = async () => {
    const cached = responseCache?.get(key);
    if (typeof cached === "string") return cached;
    if (!flashModel) throw new Error("Gemini not initialized");
    const result = await flashModel.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: TEMPERATURE, responseMimeType: "application/json", responseSchema },
    });
    const text = result.response.text();
    responseCache?.set(key, text);
    return text;
  };
  try {
    return await requestStructuredOutput(generate, schema, { isRetryable: isRetryableGeminiError });
  } catch (error) {
    throw toAppError(error);
  }
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const key = requestKey({ model: EMBEDDING_MODEL, text });
  const cached = responseCache?.get(key);
  if (Array.isArray(cached)) return cached as number[];
  if (!embeddingModel) throw new Error("Gemini not initialized");
  try {
    const result = await withRetry(() => embeddingModel.embedContent(text), { isRetryable: isRetryableGeminiError });
    responseCache?.set(key, result.embedding.values);
    return result.embedding.values;
  } catch (error) {
    throw toAppError(error);
  }
};
