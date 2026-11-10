import { extractText, getDocumentProxy } from "unpdf";

/**
 * Reads the PDF's own text layer, giving a source independent of the model to check quotes against.
 * Returns an empty string when there is none, as with scanned PDFs, because Gemini can still read those.
 */
export const extractPdfText = async (pdfBuffer: Buffer): Promise<string> => {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (error) {
    console.warn(`[PDF] Text extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    return "";
  }
};
