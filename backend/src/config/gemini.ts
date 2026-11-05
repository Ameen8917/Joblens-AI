import { GoogleGenerativeAI, GenerativeModel, Part } from "@google/generative-ai";
import { z } from "zod";
import { AppError } from "../middleware/errorHandler";
import { InvalidStructuredOutputError, requestStructuredOutput } from "../utils/structuredOutput";
import { withRetry } from "../utils/retry";
import { zodToGeminiSchema } from "../utils/zodToGeminiSchema";

let flashModel: GenerativeModel;
let embeddingModel: GenerativeModel;

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
  flashModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  console.log("✅ Gemini AI initialized");
};

/** Asks Gemini for output matching the Zod schema, retrying failed requests and invalid output. */
export const generateStructured = async <S extends z.ZodTypeAny>(schema: S, parts: Part[]): Promise<z.output<S>> => {
  if (!flashModel) throw new Error("Gemini not initialized");
  const generate = async () => {
    const result = await flashModel.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: zodToGeminiSchema(schema) },
    });
    return result.response.text();
  };
  try {
    return await requestStructuredOutput(generate, schema, { isRetryable: isRetryableGeminiError });
  } catch (error) {
    throw toAppError(error);
  }
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!embeddingModel) throw new Error("Gemini not initialized");
  try {
    const result = await withRetry(() => embeddingModel.embedContent(text), { isRetryable: isRetryableGeminiError });
    return result.embedding.values;
  } catch (error) {
    throw toAppError(error);
  }
};
