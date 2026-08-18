import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, X, KeyRound, User, Mail } from 'lucide-react';
import { ThemeMode } from '../types/plant';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { name: string; email: string }) => void;
  title?: string;
  description?: string;
  theme?: ThemeMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Engineer Authentication Required',
  description = 'Please enter your engineering credentials to unlock and modify digital twin layout & parameters.',
  theme = 'light',
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide your engineer name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid engineering work email.');
      return;
    }

    // Exact secret verification without any UI hints
    if (password !== 'RADI2030') {
      setError('Invalid authorization password. Access denied.');
      return;
    }

    // Store session info
    try {
      localStorage.setItem(
        'radi_digital_twin_auth',
        JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          authenticatedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore localStorage failure in iframe sandbox
    }

    onSuccess({ name: name.trim(), email: email.trim() });
    setName('');
    setEmail('');
    setPassword('');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl relative transition-all ${
          isDark
            ? 'bg-[#111624] border-blue-500/30 text-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.8)]'
            : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
        }`}
      >
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition ${
            isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-100 text-slate-500'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{title}</h3>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Restricted Modification Security Protocol
            </p>
          </div>
        </div>

        <p className={`text-xs mb-5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
          {description}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div>
            <label className={`block font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              Engineer Full Name
            </label>
            <div className="relative">
              <User className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Dr. Alex Mukasa"
                className={`w-full pl-9 pr-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  isDark
                    ? 'bg-[#0B0F19] border-white/10 text-white placeholder-gray-600'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`block font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              Corporate Email Address
            </label>
            <div className="relative">
              <Mail className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. a.mukasa@kiiramotors.com"
                className={`w-full pl-9 pr-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  isDark
                    ? 'bg-[#0B0F19] border-white/10 text-white placeholder-gray-600'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`block font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              Authorization Password
            </label>
            <div className="relative">
              <KeyRound className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full pl-9 pr-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  isDark
                    ? 'bg-[#0B0F19] border-white/10 text-white placeholder-gray-600'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl border font-medium transition ${
                isDark
                  ? 'border-white/10 hover:bg-white/5 text-gray-300'
                  : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verify & Unlock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
