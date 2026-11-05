import { ResponseSchema, SchemaType } from "@google/generative-ai";
import { z } from "zod";

/**
 * Converts a Zod schema to Gemini's responseSchema, so the format requested from
 * the model and the format validated afterwards can't drift apart.
 * The SDK has no array length limits, so Zod enforces those after the call.
 */
export const zodToGeminiSchema = (schema: z.ZodTypeAny): ResponseSchema => {
  const withDescription = (converted: ResponseSchema): ResponseSchema =>
    schema.description ? { ...converted, description: schema.description } : converted;

  if (schema instanceof z.ZodDefault) return withDescription(zodToGeminiSchema(schema.removeDefault() as z.ZodTypeAny));
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return withDescription(zodToGeminiSchema(schema.unwrap() as z.ZodTypeAny));
  if (schema instanceof z.ZodString) return withDescription({ type: SchemaType.STRING });
  if (schema instanceof z.ZodNumber) return withDescription({ type: SchemaType.NUMBER });
  if (schema instanceof z.ZodBoolean) return withDescription({ type: SchemaType.BOOLEAN });
  if (schema instanceof z.ZodEnum) return withDescription({ type: SchemaType.STRING, format: "enum", enum: schema.options.map(String) });
  if (schema instanceof z.ZodArray) return withDescription({ type: SchemaType.ARRAY, items: zodToGeminiSchema(schema.element as z.ZodTypeAny) });
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    return withDescription({
      type: SchemaType.OBJECT,
      properties: Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, zodToGeminiSchema(value)])),
      required: Object.keys(shape),
    });
  }
  throw new Error(`Unsupported Zod type for Gemini schema: ${schema.constructor.name}`);
};
