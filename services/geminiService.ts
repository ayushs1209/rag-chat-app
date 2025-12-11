import { GoogleGenAI } from "@google/genai";

// safely retrieve API Key from various environments (Vite, Next.js, or standard Node)
const getApiKey = (): string => {
  // 1. Check for Vite environment variable (standard for this local setup)
  // We cast to any to avoid TypeScript errors if types aren't set up
  if (
    typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_API_KEY
  ) {
    return (import.meta as any).env.VITE_API_KEY;
  }

  // 2. Check for standard process.env (Node/Webpack)
  // We check typeof process to avoid "ReferenceError: process is not defined" in pure browsers
  if (typeof process !== "undefined" && process.env?.API_KEY) {
    return process.env.API_KEY;
  }

  // 3. Fallback/Manual (You can paste your key here temporarily for testing, though .env is better)
  // return "AIzaSy...";

  return "";
};

const apiKey = getApiKey();
if (!apiKey) {
  console.error(
    "Gemini API Key is missing. Please set VITE_API_KEY in your .env file."
  );
}

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: apiKey });

/**
 * Get embedding for a text string using 'text-embedding-004'
 */
export const getEmbedding = async (text: string): Promise<number[]> => {
  // Clean text to avoid issues
  const cleanText = text.replace(/\n/g, " ");

  try {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: cleanText,
    });

    if (!response.embeddings || response.embeddings.length === 0) {
      throw new Error("No embedding returned");
    }

    return response.embeddings[0].values;
  } catch (error) {
    console.error("Embedding error:", error);
    throw error;
  }
};

/**
 * Generate text completion using 'gemini-2.5-flash'
 */
export const getCompletion = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      // model: 'gemini-2.5-flash',
      // model: "gemini-2.5-flash-exp",
      model: "gemma-3-27b-it",
      contents: prompt,
    });

    return response.text || "Sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Generation error:", error);
    return "Error generating response from Gemini.";
  }
};

/**
 * Generate streaming text completion using 'gemini-2.5-flash'
 */
export const getCompletionStream = async function* (
  prompt: string
): AsyncGenerator<string> {
  try {
    const response = await ai.models.generateContentStream({
      model: "gemma-3-27b-it",
      // model: "gemini-2.5-flash-exp",
      contents: prompt,
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Stream generation error details:", error);
    yield "Error generating response. Check browser console for details.";
  }
};
