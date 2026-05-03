import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

let genAI: GoogleGenerativeAI;
let flashModel: GenerativeModel;
let embeddingModel: GenerativeModel;

// services/gemini.service.ts

export const initGemini = (): void => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");

  genAI = new GoogleGenerativeAI(apiKey);

  flashModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",           
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    },
  });

  embeddingModel = genAI.getGenerativeModel({
    model: "gemini-embedding-001",        
  });

  console.log("✅ Gemini AI initialized");
};

export const getFlashModel = (): GenerativeModel => {
  if (!flashModel) throw new Error("Gemini not initialized");
  return flashModel;
};

export const generateJSON = async <T>(prompt: string): Promise<T> => {
  const model = getFlashModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  try {
    return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()) as T;
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 300)}`);
  }
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!embeddingModel) throw new Error("Gemini not initialized");
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
};

// services/gemini.service.ts

export const generateJSONFromPDF = async <T>(
  pdfBuffer: Buffer,
  prompt: string
): Promise<T> => {
  const base64PDF = pdfBuffer.toString("base64");

  const result = await flashModel.generateContent([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: base64PDF,
      },
    },
    { text: prompt },
  ]);

  const text = result.response.text();
  
  // Strip markdown code fences if present
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();
  
  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new Error(`Failed to parse Gemini PDF response as JSON: ${text.slice(0, 200)}`);
  }
};