import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Bot,
  Send,
  Loader2,
  RefreshCw,
  Cpu,
  Zap,
  Truck,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Minimize2,
  Maximize2,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { SimulationState, ProcessZone, WarehouseInfo, ThemeMode } from '../types/plant';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  simState: SimulationState;
  setSimState?: React.Dispatch<React.SetStateAction<SimulationState>>;
  zones: ProcessZone[];
  warehouses: WarehouseInfo[];
  activeTab?: string;
  theme?: ThemeMode;
}

const PRESET_PROMPTS = [
  {
    title: 'Explain Bottlenecks',
    icon: AlertCircle,
    color: 'text-amber-500',
    prompt: 'Why are there bottlenecks at stations like Laser Welding (Z3) and Cell Stacking (Z2)? What causes the queue build-up and how does thread scaling resolve it?',
  },
  {
    title: 'What do the Numbers Mean?',
    icon: TrendingUp,
    color: 'text-blue-500',
    prompt: 'Can you explain what the 1,183 target packs, 26.57s takt time, 90% OEE, 97% First Pass Yield, and 4-Day warehouse buffer mean in the twin?',
  },
  {
    title: 'Tariff & Energy Strategy',
    icon: Zap,
    color: 'text-emerald-500',
    prompt: 'How can we leverage the Uganda ERA electricity tariff to minimize power costs by scheduling energy-intensive test cyclers off-peak?',
  },
  {
    title: 'Truck & Logistics Flow',
    icon: Truck,
    color: 'text-purple-500',
    prompt: 'Explain the logistics flow between WH-1 Raw Cell Inbound, WH-4 Material Trays, and WH-2 Finished Pack Dispatch. How do the docking stations operate?',
  },
];

export const AiChatModal: React.FC<AiChatModalProps> = ({
  isOpen,
  onClose,
  simState,
  zones,
  warehouses,
  activeTab = 'Plant Layout',
  theme = 'light',
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `👋 **Welcome to the Kiira Battery Plant Digital Twin AI Assistant & Optimizer!**\n\nI can help you understand the engineering dynamics of our **10 GWh Gigafactory**:
- 🔍 **Station Bottlenecks & Machine Threads** (Z1 to Z8 & BESS integration)
- 📊 **Target Metrics Explained** (1,183 packs/shift, 26.57s takt, 4-day buffer)
- ⚡ **ERA Tariff Optimization** ($0.055/kWh off-peak scheduling)
- 🚚 **Supply Chain & Dock Logistics** (WH-1, WH-2, WH-3, and WH-4)\n\nAsk me anything or pick a quick question below!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isDark = theme === 'dark';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          text: m.text,
        }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history,
          simState,
          activeTab,
        }),
      });

      const data = await res.json();

      if (data.success && data.text) {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (err: any) {
      // Local fallback explanation
      const fallbackReply: ChatMessage = {
        id: `bot-fallback-${Date.now()}`,
        role: 'assistant',
        text: `### 🤖 Operational Insight: ${textToSend.slice(0, 40)}...\n\n- **Target & Takt**: The line requires a **26.57s takt time** to hit **1,183 finished packs per 10-hour shift**.
- **Station Bottlenecks**: Single machines with cycle times greater than 26.57s (such as 120s Stacking or 25s Laser Welding) are scaled using **parallel threads** (e.g. 5 stackers, 2 welders) to keep the effective thread takt under 26.57s.
- **4-Day Buffer**: WH-2 holds up to 10,000 packs to decouple cell assembly from freight dispatch and withstand regional logistics variances.\n\n*(Connect your Gemini API Key in Settings for live dynamic model synthesis)*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, fallbackReply]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 md:p-6 transition-all duration-300">
      <div
        className={`relative flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-[#0E131F] border-blue-500/30 text-gray-100 shadow-[0_12px_48px_rgba(0,0,0,0.8)]'
            : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
        } ${isMaximized ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-4xl h-[88vh] max-h-[850px]'}`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isDark ? 'bg-[#141A29]/90 border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base md:text-lg tracking-tight">
                  Digital Twin AI Operations Copilot
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Explaining plant metrics, station bottlenecks, supply chains & energy optimization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className={`p-2 rounded-lg transition ${
                isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-200 text-slate-600'
              }`}
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition ${
                isDark ? 'hover:bg-red-500/20 hover:text-red-400 text-gray-400' : 'hover:bg-red-100 hover:text-red-600 text-slate-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preset Quick Strategy Prompts */}
        <div
          className={`px-4 py-2 border-b grid grid-cols-2 md:grid-cols-4 gap-2 text-left ${
            isDark ? 'bg-[#0B0F19] border-white/5' : 'bg-slate-100/70 border-slate-200'
          }`}
        >
          {PRESET_PROMPTS.map((p, idx) => {
            const Icon = p.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSend(p.prompt)}
                disabled={isLoading}
                className={`p-2.5 rounded-xl border text-xs text-left transition flex items-start gap-2 ${
                  isDark
                    ? 'bg-[#131926] hover:bg-[#1A2234] border-white/10 text-gray-200 hover:border-blue-500/50'
                    : 'bg-white hover:bg-blue-50/70 border-slate-200 text-slate-800 hover:border-blue-300 shadow-xs'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${p.color}`} />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.title}</div>
                  <div className={`text-[10px] truncate ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Click to ask
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 font-sans text-sm">
          {messages.map(m => {
            const isBot = m.role === 'assistant';
            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isBot ? 'items-start' : 'items-end justify-end'}`}
              >
                {isBot && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                    isBot
                      ? isDark
                        ? 'bg-[#151D2F] border border-white/10 text-gray-200'
                        : 'bg-slate-100/90 border border-slate-200 text-slate-900'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20'
                  }`}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none space-y-2 leading-relaxed whitespace-pre-wrap">
                    {m.text}
                  </div>
                  <div
                    className={`text-[10px] mt-1.5 text-right font-mono ${
                      isBot
                        ? isDark
                          ? 'text-gray-500'
                          : 'text-slate-400'
                        : 'text-blue-200'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div
                className={`rounded-2xl px-4 py-3 border flex items-center gap-3 ${
                  isDark ? 'bg-[#151D2F] border-white/10 text-gray-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="text-xs">Analyzing digital twin telemetry and calculating strategy...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div
          className={`p-3 md:p-4 border-t ${
            isDark ? 'bg-[#141A29]/90 border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about station bottlenecks, takt time, tariff schedules, or docking logistics..."
              disabled={isLoading}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                isDark
                  ? 'bg-[#0B0F19] border-white/10 text-white placeholder-gray-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-xs'
              }`}
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-md shadow-blue-500/20"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <div className="flex justify-between items-center mt-2 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
            <span>Plant: Kiira Nakasongola 10 GWh</span>
            <span>Target: 1,183 Packs/Shift • Takt: 26.57s</span>
          </div>
        </div>
      </div>
    </div>
  );
};
