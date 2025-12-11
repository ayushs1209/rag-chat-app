import React, { useRef, useEffect, useState } from 'react';
import { Send, User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  // Determine if we should show the loading dots.
  // We show dots if isLoading is true, BUT we hide them if the last message is a streaming assistant response (has content).
  // This prevents showing both the streaming text and the loading dots simultaneously.
  const lastMessage = messages[messages.length - 1];
  const isStreamingResponse = lastMessage?.role === 'assistant' && lastMessage?.content.length > 0;
  const showLoadingDots = isLoading && !isStreamingResponse;

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => {
          // Hide empty messages (placeholders) to avoid the "upper placeholder" visual artifact
          if (!msg.content.trim()) return null;

          return (
            <div
              key={index}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`
                flex max-w-[85%] md:max-w-[75%] px-5 py-3 text-sm leading-relaxed shadow-sm
                ${msg.role === 'user' 
                  ? 'bg-white text-black rounded-2xl rounded-tr-sm' 
                  : 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-tl-sm border border-zinc-700'
                }
              `}>
                <div className="flex gap-3">
                  <div className="prose prose-sm max-w-none prose-invert">
                     <div className={msg.role === 'user' ? 'text-black' : 'text-zinc-200'}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {showLoadingDots && (
          <div className="flex justify-start w-full">
            <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="w-full pl-5 pr-12 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all placeholder-zinc-600 text-white text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`
              absolute right-2 p-2 rounded-lg transition-all duration-200
              ${input.trim() && !isLoading
                ? 'bg-white text-black hover:bg-zinc-200' 
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }
            `}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};