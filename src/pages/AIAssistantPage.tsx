/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Wrench,
  User,
  Clock,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  toolsCalled?: string[];
  timestamp: string;
}

export function AIAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ hasApiKey: boolean; model: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getAiStatus().then(setAiStatus).catch(console.error);

    // Initial greeting
    setMessages([
      {
        id: '1',
        sender: 'assistant',
        text: `Welcome, ${user?.name || user?.email}. I am the HCM Lite Executive Assistant powered by Gemini. I can inspect company attendance, verify leave quotas, search employee records, and answer policy questions with strict role-based authorization.\n\nTry asking me a question below or pick one of the suggested prompts!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askAiAssistant(prompt);
      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: res.text,
        toolsCalled: res.toolsCalled,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: `Error: ${err.message || 'Failed to communicate with AI Assistant.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    'Who is on leave today?',
    "Summarize today's attendance roster",
    'How many employees are late today?',
    'What is my remaining leave balance?',
    'What is the company policy on grace periods and half-days?',
    "What is my colleague's salary?" // Security refusal test
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Bot size={20} className="text-[#D6B46A]" />
            <span>AI HR Executive Assistant</span>
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>Model: gemini-3.8-flash</span>
            <span>·</span>
            <span>Strict Authenticated Function Calling</span>
            <span>·</span>
            <span>Scope: {user?.role}</span>
          </div>
        </div>

        {/* API Key Status Badge */}
        <div>
          {aiStatus?.hasApiKey ? (
            <span className="text-xs text-emerald-500 font-medium flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle2 size={13} />
              <span>Gemini Connected</span>
            </span>
          ) : (
            <span className="text-xs text-amber-500 font-medium flex items-center gap-1.5 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <KeyRound size={13} />
              <span>Key Pending (.env)</span>
            </span>
          )}
        </div>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 text-xs">
        <span className="text-slate-400 font-medium shrink-0">Suggestions:</span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="px-3 py-1 rounded-full bg-white dark:bg-[#131D31] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 whitespace-nowrap text-xs transition-colors shrink-0"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Messages Stream Container */}
      <div className="flex-1 bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm p-4 overflow-y-auto space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.sender === 'user'
                  ? 'bg-slate-800 text-white font-bold text-xs'
                  : 'bg-gradient-to-br from-[#D6B46A] to-[#997732] text-[#0B1120]'
              }`}
            >
              {msg.sender === 'user' ? <User size={15} /> : <Sparkles size={15} />}
            </div>

            {/* Message Bubble */}
            <div
              className={`max-w-2xl rounded-2xl p-4 text-xs space-y-2 ${
                msg.sender === 'user'
                  ? 'bg-slate-900 text-white ml-auto'
                  : 'bg-slate-50 dark:bg-[#131D31] border border-slate-200/60 dark:border-white/5 text-slate-800 dark:text-slate-100'
              }`}
            >
              {/* Tool Execution Tags */}
              {msg.toolsCalled && msg.toolsCalled.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-white/5 text-[11px] text-[#D6B46A]">
                  <Wrench size={12} />
                  <span>Executed Backend Tool(s):</span>
                  {msg.toolsCalled.map((tool, i) => (
                    <span key={i} className="font-mono bg-[#D6B46A]/10 px-1.5 py-0.5 rounded text-[10px]">
                      {tool}
                    </span>
                  ))}
                </div>
              )}

              <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                {msg.sender === 'assistant' && (
                  <span className="text-[10px] text-[#D6B46A] font-medium">AI-Generated</span>
                )}
                <span className="ml-auto">{msg.timestamp}</span>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#D6B46A] to-[#997732] flex items-center justify-center text-[#0B1120] shrink-0">
              <Sparkles size={15} className="animate-spin" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#131D31] text-xs text-slate-400 space-y-1">
              <div>Querying database with verified tools...</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-3 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question about employees, attendance, policy, or your leave balances..."
          disabled={loading}
          className="flex-1 px-4 py-3 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-3 bg-gradient-to-r from-[#D6B46A] to-[#B39045] hover:from-[#E5C57E] hover:to-[#C5A059] text-[#0B1120] font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <Send size={14} />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
