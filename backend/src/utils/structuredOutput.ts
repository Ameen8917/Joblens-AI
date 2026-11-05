import { z } from "zod";
import { withRetry, RetryOptions } from "./retry";

/** Model output in the wrong format. Messages never include the output itself, which can contain resume data. */
export class InvalidStructuredOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStructuredOutputError";
  }
}

/** Removes nulls so Zod defaults apply to fields the model left empty. */
export const stripNulls = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.filter((item) => item !== null).map(stripNulls);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== null).map(([key, item]) => [key, stripNulls(item)])
    );
  }
  return value;
};

export const parseStructuredOutput = <S extends z.ZodTypeAny>(text: string, schema: S): z.output<S> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InvalidStructuredOutputError("Response was not valid JSON");
  }
  const result = schema.safeParse(stripNulls(json));
  if (!result.success) {
    const issues = result.error.issues.map((e) => `${e.path.join(".") || "(root)"}: ${e.message}`).join("; ");
    throw new InvalidStructuredOutputError(`Response didn't match the schema: ${issues}`);
  }
  return result.data;
};

/** Generates and validates as one retryable unit, so bad output gets another attempt as well as failed requests. */
export const requestStructuredOutput = <S extends z.ZodTypeAny>(
  generate: () => Promise<string>,
  schema: S,
  options?: RetryOptions
): Promise<z.output<S>> => withRetry(async () => parseStructuredOutput(await generate(), schema), options);
