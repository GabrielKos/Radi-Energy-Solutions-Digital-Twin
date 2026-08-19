import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isDark?: boolean;
}

/**
 * Clean, lightweight markdown renderer supporting:
 * - Headers (###, ##, #)
 * - Bold (**text**)
 * - Italic (*text* or _text_)
 * - Bullet lists (- or *)
 * - Numbered lists (1. )
 * - Code blocks (```lang ... ```) and inline code (`code`)
 * - Blockquotes (> quote)
 * - Horizontal rules (---)
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', isDark = false }) => {
  if (!content) return null;

  // Split text by lines
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeLanguage = '';

  const formatInlineText = (text: string): React.ReactNode[] => {
    // Tokenize inline markdown: `code`, **bold**, *italic*, _italic_
    const tokens: React.ReactNode[] = [];
    // Regex matching code `...`, bold **...**, italic *...* or _..._
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
    const parts = text.split(regex);

    parts.forEach((part, idx) => {
      if (!part) return;

      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        tokens.push(
          <code
            key={idx}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium ${
              isDark ? 'bg-blue-950/60 text-blue-300 border border-blue-800/40' : 'bg-blue-50 text-blue-800 border border-blue-200/70'
            }`}
          >
            {part.slice(1, -1)}
          </code>
        );
      } else if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        tokens.push(
          <strong key={idx} className={`font-bold ${isDark ? 'text-white' : 'text-slate-950'}`}>
            {formatInlineText(part.slice(2, -2))}
          </strong>
        );
      } else if ((part.startsWith('*') && part.endsWith('*') && part.length >= 2) || (part.startsWith('_') && part.endsWith('_') && part.length >= 2)) {
        tokens.push(
          <em key={idx} className="italic">
            {part.slice(1, -1)}
          </em>
        );
      } else {
        tokens.push(part);
      }
    });

    return tokens;
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        elements.push(
          <div
            key={`code-${lineIdx}`}
            className={`my-2 p-3 rounded-lg font-mono text-xs overflow-x-auto border ${
              isDark ? 'bg-[#0B0F19] text-blue-200 border-white/10' : 'bg-slate-900 text-blue-100 border-slate-800'
            }`}
          >
            <pre>{codeBlockContent.join('\n')}</pre>
          </div>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(<hr key={`hr-${lineIdx}`} className={`my-3 border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`} />);
      return;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${lineIdx}`} className={`text-sm md:text-base font-bold mt-3 mb-1.5 flex items-center gap-1.5 ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
          {formatInlineText(trimmed.slice(4))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${lineIdx}`} className={`text-base md:text-lg font-bold mt-4 mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {formatInlineText(trimmed.slice(3))}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${lineIdx}`} className={`text-lg md:text-xl font-bold mt-4 mb-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {formatInlineText(trimmed.slice(2))}
        </h1>
      );
      return;
    }

    // Bullet lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={`bullet-${lineIdx}`} className="flex items-start gap-2 ml-1 my-1">
          <span className="text-blue-500 font-bold text-sm select-none shrink-0 leading-tight mt-0.5">•</span>
          <div className="flex-1 leading-relaxed">{formatInlineText(trimmed.slice(2))}</div>
        </div>
      );
      return;
    }

    // Numbered lists (e.g. 1. , 2. )
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      elements.push(
        <div key={`num-${lineIdx}`} className="flex items-start gap-2 ml-1 my-1">
          <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
            isDark ? 'bg-blue-950 text-blue-400 border border-blue-900/50' : 'bg-blue-100 text-blue-700'
          }`}>
            {numberedMatch[1]}
          </span>
          <div className="flex-1 leading-relaxed">{formatInlineText(numberedMatch[2])}</div>
        </div>
      );
      return;
    }

    // Blockquotes
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${lineIdx}`}
          className={`pl-3 my-2 border-l-2 italic text-xs md:text-sm ${
            isDark ? 'border-blue-500/60 bg-blue-950/20 text-gray-300' : 'border-blue-500 bg-blue-50/50 text-slate-700'
          }`}
        >
          {formatInlineText(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    // Empty lines
    if (!trimmed) {
      elements.push(<div key={`empty-${lineIdx}`} className="h-1.5" />);
      return;
    }

    // Standard paragraph
    elements.push(
      <p key={`p-${lineIdx}`} className="my-1 leading-relaxed">
        {formatInlineText(line)}
      </p>
    );
  });

  return <div className={`space-y-0.5 ${className}`}>{elements}</div>;
};
