import React, { useState, useRef, useEffect } from 'react';
import { GLAccount, ChatMessage } from '../types';
import { getChatResponse } from '../services/geminiService';
import { runSemanticSearch } from '../services/searchService';
import { Send, Bot, User } from 'lucide-react';

interface ChatInterfaceProps {
  glAccounts: GLAccount[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ glAccounts }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const newMessages: ChatMessage[] = [...messages, { sender: 'user', text: userInput }];
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);

    try {
      const semanticResult = runSemanticSearch(userInput, glAccounts);
      if (semanticResult.handled) {
        setMessages([...newMessages, { sender: 'ai', text: semanticResult.response }]);
        return;
      }

      const aiResponse = await getChatResponse(userInput, glAccounts);
      setMessages([...newMessages, { sender: 'ai', text: aiResponse }]);
    } catch (error) {
      setMessages([...newMessages, { sender: 'ai', text: 'An error occurred. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto my-8 rounded-3xl border border-white/10 bg-slate-900/70 shadow-[0_40px_120px_-60px_rgba(14,165,233,0.5)] backdrop-blur">
      <div className="border-b border-white/10 p-5">
        <h2 className="text-xl font-semibold text-white">AI Financial Assistant</h2>
        <p className="text-sm text-slate-300/80">Ask questions about your GL account data.</p>
      </div>
      <div ref={chatContainerRef} className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'ai' && <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40"><Bot size={20} /></div>}
            <div className={`max-w-md rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-cyan-500 text-slate-900' : 'bg-slate-800/80 text-slate-100 border border-white/5'}`}>
              <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
            </div>
             {msg.sender === 'user' && <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-cyan-200 border border-white/10"><User size={20} /></div>}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
             <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40"><Bot size={20} /></div>
            <div className="rounded-2xl bg-slate-800/80 px-4 py-3">
                <div className="flex items-center space-x-1">
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce"></span>
                </div>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-white/10 bg-slate-900/60 p-4">
        <div className="relative">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., How many accounts are in mismatch status?"
            className="w-full rounded-full border border-white/10 bg-white/5 py-3 pl-5 pr-14 text-sm text-white placeholder:text-slate-400 focus:border-cyan-400/70 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 disabled:opacity-60"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !userInput.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-cyan-500 p-2 text-slate-900 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
