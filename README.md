# Gemini PDF RAG Chat

A client-side Retrieval-Augmented Generation (RAG) demo for chatting with PDF documents using the Gemini API. This repo includes a React frontend (Vite) that extracts text from PDFs, chunks and embeds content, and answers user questions via either full-document summarization or RAG retrieval.

Getting started (frontend)

1. Install dependencies:
   ```sh
   npm install
   ```
2. Provide your Gemini API key in the project root `.env` using the `VITE_API_KEY` variable (see [.env](.env)).
3. Run dev server:
   ```sh
   npm run dev
   ```
4. Run the app on localhost at port 3000 and upload a PDF using the UI
