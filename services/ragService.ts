import { getEmbedding, getCompletion, getCompletionStream } from './geminiService';
import * as pdfjsLib from 'pdfjs-dist';

// Define structure for document chunks
export interface DocChunk {
  id: string;
  text: string;
  embedding?: number[];
  pageNumber: number;
}

export interface ProcessedDocument {
  chunks: DocChunk[];
  fullText: string;
}

// Initialize PDF.js worker
// We use jsdelivr to ensure we get the correct module worker file for version 5.4.449
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs`;

/**
 * Reads a file as ArrayBuffer
 */
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Extracts text from a PDF file
 */
const extractTextFromPdf = async (file: File, onProgress: (status: string) => void): Promise<{ text: string; page: number }[]> => {
  onProgress('Loading PDF...');
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const pages: { text: string; page: number }[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress(`Parsing page ${i} of ${pdf.numPages}...`);
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => item.str).join(' ');
    pages.push({ text, page: i });
  }
  
  return pages;
};

/**
 * Splits text into chunks
 * INCREASED chunk size for Gemini 2.5 Flash which handles large context well.
 * Larger chunks = better context for RAG = better answers.
 */
const chunkText = (pages: { text: string; page: number }[], chunkSize = 4000, overlap = 500): DocChunk[] => {
  const chunks: DocChunk[] = [];
  
  pages.forEach(({ text, page }) => {
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunkText = text.slice(start, end);
      
      chunks.push({
        id: `${page}-${start}`,
        text: chunkText,
        pageNumber: page,
      });
      
      // Move forward by chunk size minus overlap
      start += (chunkSize - overlap);
      
      if (start >= text.length) break;
    }
  });
  
  return chunks;
};

/**
 * Calculates cosine similarity between two vectors
 */
const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Main function to process PDF: Extract -> Chunk -> Embed
 */
export const processPdf = async (file: File, onProgress: (status: string) => void): Promise<ProcessedDocument> => {
  // 1. Extract Text
  const pages = await extractTextFromPdf(file, onProgress);
  const fullText = pages.map(p => p.text).join('\n\n');
  
  // 2. Chunk Text
  onProgress('Splitting text into chunks...');
  const chunks = chunkText(pages);
  
  // 3. Embed Chunks
  // We only embed chunks for RAG. 
  // For summarization, we'll use the fullText directly (Context Stuffing).
  onProgress(`Generating embeddings for ${chunks.length} chunks...`);
  
  const batchSize = 5;
  for (let i = 0; i < chunks.length; i += batchSize) {
     const batch = chunks.slice(i, i + batchSize);
     onProgress(`Embedding chunks ${i + 1} to ${Math.min(i + batchSize, chunks.length)} of ${chunks.length}...`);
     
     await Promise.all(batch.map(async (chunk) => {
       try {
         chunk.embedding = await getEmbedding(chunk.text);
       } catch (e) {
         console.warn(`Failed to embed chunk ${chunk.id}`, e);
       }
     }));
  }
  
  const validChunks = chunks.filter(c => c.embedding !== undefined);
  return { chunks: validChunks, fullText };
};

/**
 * Generates an answer using RAG or Full Context Stuffing
 * Now returns an AsyncGenerator for streaming
 */
export const generateAnswer = async function* (question: string, docData: ProcessedDocument): AsyncGenerator<string> {
  const { chunks, fullText } = docData;
  
  // Detect if user wants a summary
  const isSummaryRequest = /summar|overview|tl;dr|digest|describe the document/i.test(question);
  
  // Strategy 1: Context Stuffing (Best for Summaries)
  if (isSummaryRequest) {
    console.log("Using Full Context Summarization strategy");
    const MAX_CHARS = 3000000; // Safe limit below 1M tokens
    const textToSend = fullText.length > MAX_CHARS ? fullText.slice(0, MAX_CHARS) + "...[truncated]" : fullText;
    
    const prompt = `
      You are an expert document assistant.
      The user wants a summary or overview of the following document.
      Provide a comprehensive, detailed, and well-structured summary.
      Explain the key points in depth.
      
      Document Content:
      ${textToSend}
      
      User Request: ${question}
    `;
    
    const stream = getCompletionStream(prompt);
    for await (const chunk of stream) {
      yield chunk;
    }
    yield "\n\n**Source:** Full Document Analysis";
    return;
  }

  // Strategy 2: RAG (Best for specific questions)
  console.log("Using RAG strategy");
  const questionEmbedding = await getEmbedding(question);
  
  const scoredChunks = chunks.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(questionEmbedding, chunk.embedding!)
  }));
  
  // Retrieve top 8 chunks for context
  const topChunks = scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
    
  const context = topChunks.map(c => c.text).join('\n\n---\n\n');
  const prompt = `
    You are a helpful assistant answering questions about a document.
    Use the following context snippets from the document to answer the question.
    
    Instructions:
    1. Provide a  well-explained** answer. Do not be too brief.
    2. Explain the concepts thoroughly based on the text.
    3. If the answer is not in the context, say "I cannot find the answer in the document."
    
    Context:
    ${context}
    
    Question:
    ${question}
    
    Answer:
  `;
  
  const stream = getCompletionStream(prompt);
  for await (const chunk of stream) {
    yield chunk;
  }

  // Calculate and append unique page numbers
  const uniquePages = Array.from(new Set(topChunks.map(c => c.pageNumber))).sort((a, b) => a - b);
  
  if (uniquePages.length > 0) {
    yield `\n\n**Sources:** Page${uniquePages.length > 1 ? 's' : ''} ${uniquePages.join(', ')}`;
  }
};