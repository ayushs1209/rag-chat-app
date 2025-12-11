import React, { useState, useRef, useEffect } from 'react';
import { Layout } from './components/Layout';
import { FileUpload } from './components/FileUpload';
import { ChatInterface } from './components/ChatInterface';
import { processPdf, generateAnswer, type DocChunk, type ProcessedDocument } from './services/ragService';
import { BrainCircuit, BookOpen, Code, FileText, Plus, MessageSquare, Trash2 } from 'lucide-react';

interface ChatSession {
  id: string;
  name: string;
  date: Date;
  file: File;
  processedDoc: ProcessedDocument;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedDoc, setProcessedDoc] = useState<ProcessedDocument | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Chat History Simulation
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const createNewChat = () => {
    setFile(null);
    setProcessedDoc(null);
    setMessages([]);
    setActiveChatId(null);
    setProcessingStatus('');
  };

  const loadChat = (chat: ChatSession) => {
    if (isGenerating) return; // Prevent switching while generating
    setActiveChatId(chat.id);
    setFile(chat.file);
    setProcessedDoc(chat.processedDoc);
    setMessages(chat.messages);
    setProcessingStatus('Ready');
  };

  const updateCurrentChatMessages = (newMessages: { role: 'user' | 'assistant'; content: string }[]) => {
    if (!activeChatId) return;
    
    setChats(prevChats => prevChats.map(chat => 
      chat.id === activeChatId 
        ? { ...chat, messages: newMessages }
        : chat
    ));
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setProcessingStatus('Reading PDF...');
    setMessages([]);

    try {
      // Client-side RAG processing
      const docData = await processPdf(selectedFile, (status) => {
        setProcessingStatus(status);
      });
      setProcessedDoc(docData);
      setProcessingStatus('Ready');
      
      const initialMessage = { role: 'assistant' as const, content: `I've analyzed **${selectedFile.name}**. What would you like to know?` };
      setMessages([initialMessage]);
      
      // Create a new chat session entry
      const newChatId = Date.now().toString();
      const newChat: ChatSession = {
        id: newChatId,
        name: selectedFile.name.substring(0, 20) + (selectedFile.name.length > 20 ? '...' : ''),
        date: new Date(),
        file: selectedFile,
        processedDoc: docData,
        messages: [initialMessage]
      };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(newChatId);

    } catch (error) {
      console.error(error);
      setProcessingStatus('Error');
      setMessages([{ role: 'assistant', content: 'Unable to process the file. Please try again.' }]);
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !processedDoc || isGenerating) return;

    // 1. Add user message
    const userMsg = { role: 'user' as const, content: message };
    const messagesWithUser = [...messages, userMsg];
    
    setMessages(messagesWithUser);
    updateCurrentChatMessages(messagesWithUser);
    
    setIsGenerating(true);

    try {
      // 2. Add placeholder for assistant response
      const placeholderMsg = { role: 'assistant' as const, content: '' };
      setMessages(prev => [...prev, placeholderMsg]);

      // Get the response stream
      const stream = generateAnswer(message, processedDoc);
      
      let fullResponse = "";
      
      for await (const chunk of stream) {
        fullResponse += chunk;
        
        // Update the last message with the accumulated text
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          // Ensure we are updating the assistant's message we just added
          if (lastMsg.role === 'assistant') {
            updated[updated.length - 1] = { ...lastMsg, content: fullResponse };
          }
          return updated;
        });
      }

      // 3. Update history with full response
      const finalMessages = [...messagesWithUser, { role: 'assistant' as const, content: fullResponse }];
      updateCurrentChatMessages(finalMessages);

    } catch (error) {
      console.error(error);
      const errorMsg = { role: 'assistant' as const, content: 'Error connecting to Gemini. Please check your network or API key.' };
      const messagesWithError = [...messagesWithUser, errorMsg];
      setMessages(messagesWithError);
      updateCurrentChatMessages(messagesWithError);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChatId === chatId) {
      createNewChat();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      {/* Dark Sidebar */}
      <aside className="w-[280px] bg-black border-r border-zinc-800 flex flex-col z-20">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-black">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">Ragify</span>
          </div>

          <button 
            onClick={createNewChat}
            className="w-full bg-white text-black hover:bg-zinc-200 transition-colors py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-3 scrollbar-hide">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-3 mb-3 mt-2">
            Recent Chats
          </h3>
          <div className="space-y-1">
            {chats.length === 0 ? (
              <div className="text-zinc-600 text-sm px-3 py-2 italic">No history yet</div>
            ) : (
              chats.map(chat => (
                <div key={chat.id} className="relative group">
                  <button
                    onClick={() => loadChat(chat)}
                    disabled={isGenerating}
                    className={`w-full text-left px-3 py-3 rounded-lg text-sm flex items-center gap-3 transition-colors ${
                      activeChatId === chat.id 
                        ? 'bg-zinc-900 text-white' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                    } ${isGenerating ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span className="truncate pr-6">{chat.name}</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        {/* <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold">
              US
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">User</p>
              <p className="text-xs text-zinc-500 truncate">Free Plan</p>
            </div>
          </div>
        </div> */}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative bg-zinc-900">
        <Layout>
            {!file ? (
              <div className="h-full flex flex-col items-center justify-center p-6 bg-zinc-900">
                <div className="max-w-md w-full">
                  <div className="text-center mb-8">
                     <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
                     <p className="text-zinc-500">Upload a document to start a new analysis session.</p>
                  </div>
                  <FileUpload onFileSelect={handleFileSelect} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Chat Header */}
                <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900 z-10">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-white" />
                    <div>
                      <h2 className="font-medium text-white text-sm">{file.name}</h2>
                      <p className="text-xs text-zinc-500">
                        {isProcessing ? processingStatus : 'Active Session'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={createNewChat}
                    className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    title="Close File"
                  >
                    <Plus className="w-4 h-4 rotate-45" />
                  </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-hidden relative bg-zinc-900">
                   {isProcessing ? (
                     <div className="absolute inset-0 bg-zinc-900/90 z-20 flex flex-col items-center justify-center">
                        <div className="w-10 h-10 border-2 border-zinc-800 border-t-white rounded-full animate-spin mb-4"></div>
                        <p className="text-white font-medium animate-pulse">{processingStatus}</p>
                     </div>
                   ) : null}
                   <ChatInterface 
                      messages={messages} 
                      onSendMessage={handleSendMessage} 
                      isLoading={isGenerating} 
                   />
                </div>
              </div>
            )}
        </Layout>
      </main>
    </div>
  );
};

export default App;