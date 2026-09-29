import React from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
  isDark?: boolean;
}

/**
 * Custom High-Fidelity Markdown View for AI Twin Explanations & Optimizer Reports.
 * Converts markdown formatting (bold, italics, headers, lists, code, quotes) into
 * clean styled React nodes without leaving unrendered raw asterisks or backticks.
 */
export const MarkdownView: React.FC<MarkdownViewProps> = ({
  content,
  className = '',
  isDark = true,
}) => {
  if (!content) return null;

  // Split into lines for block-level parsing
  const lines = content.split('\n');

  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code Block Check
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        renderedElements.push(
          <div
            key={`code-block-${i}`}
            className={`my-3 p-3 rounded-lg font-mono text-xs overflow-x-auto border ${
              isDark ? 'bg-[#0B0D14] border-[#2D3139] text-blue-300' : 'bg-slate-900 border-slate-700 text-blue-200'
            }`}
          >
            {codeBlockLang && (
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1 font-bold">
                {codeBlockLang}
              </span>
            )}
            <pre className="whitespace-pre">{codeBlockBuffer.join('\n')}</pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockBuffer = [];
        codeBlockLang = '';
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = trimmed.replace('```', '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(rawLine);
      continue;
    }

    // Empty line / paragraph break
    if (!trimmed) {
      renderedElements.push(<div key={`blank-${i}`} className="h-2" />);
      continue;
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      renderedElements.push(
        <hr
          key={`hr-${i}`}
          className={`my-3 border-t ${isDark ? 'border-[#2D3139]' : 'border-slate-200'}`}
        />
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      renderedElements.push(
        <h1
          key={`h1-${i}`}
          className={`text-base font-extrabold uppercase tracking-wide mt-4 mb-2 flex items-center gap-2 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          <span className="w-1.5 h-4 rounded bg-blue-500 shrink-0" />
          <span>{renderInlineFormatting(trimmed.substring(2), isDark)}</span>
        </h1>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      renderedElements.push(
        <h2
          key={`h2-${i}`}
          className={`text-sm font-bold uppercase tracking-wider mt-3.5 mb-1.5 flex items-center gap-2 ${
            isDark ? 'text-blue-400' : 'text-blue-600'
          }`}
        >
          <span className="w-1 h-3 rounded bg-blue-400 shrink-0" />
          <span>{renderInlineFormatting(trimmed.substring(3), isDark)}</span>
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      renderedElements.push(
        <h3
          key={`h3-${i}`}
          className={`text-xs font-bold uppercase tracking-wider mt-2.5 mb-1 flex items-center gap-1.5 ${
            isDark ? 'text-emerald-400' : 'text-emerald-700'
          }`}
        >
          <span className="text-emerald-500 font-black">•</span>
          <span>{renderInlineFormatting(trimmed.substring(4), isDark)}</span>
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      renderedElements.push(
        <h4
          key={`h4-${i}`}
          className={`text-xs font-bold mt-2 mb-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}
        >
          {renderInlineFormatting(trimmed.substring(5), isDark)}
        </h4>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      renderedElements.push(
        <div
          key={`quote-${i}`}
          className={`my-2 p-2.5 border-l-4 rounded-r-lg text-xs italic ${
            isDark
              ? 'border-blue-500 bg-blue-950/20 text-gray-300'
              : 'border-blue-500 bg-blue-50/80 text-slate-700'
          }`}
        >
          {renderInlineFormatting(trimmed.substring(2), isDark)}
        </div>
      );
      continue;
    }

    // Unordered Lists (- , * , • )
    if (/^[-*•]\s+/.test(trimmed)) {
      const listText = trimmed.replace(/^[-*•]\s+/, '');
      renderedElements.push(
        <div key={`li-${i}`} className="flex items-start gap-2 my-1 text-xs leading-relaxed pl-1">
          <span className="text-blue-500 mt-0.5 shrink-0 select-none">•</span>
          <div className="flex-1">{renderInlineFormatting(listText, isDark)}</div>
        </div>
      );
      continue;
    }

    // Ordered Lists (1. , 2. , etc.)
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const num = orderedMatch[1];
      const listText = orderedMatch[2];
      renderedElements.push(
        <div key={`oli-${i}`} className="flex items-start gap-2 my-1.5 text-xs leading-relaxed pl-1">
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold font-mono shrink-0 select-none ${
            isDark ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-100 text-blue-700 border border-blue-200'
          }`}>
            {num}
          </span>
          <div className="flex-1 font-medium">{renderInlineFormatting(listText, isDark)}</div>
        </div>
      );
      continue;
    }

    // Standard Paragraph / Text Line
    renderedElements.push(
      <p key={`p-${i}`} className="my-1 text-xs leading-relaxed">
        {renderInlineFormatting(trimmed, isDark)}
      </p>
    );
  }

  return (
    <div className={`space-y-0.5 text-xs leading-relaxed ${className}`}>
      {renderedElements}
    </div>
  );
};

/**
 * Tokenizes and renders inline markdown elements:
 * - **bold** or __bold__ -> <strong>
 * - *italic* or _italic_ -> <em>
 * - `code` -> <code>
 */
function renderInlineFormatting(text: string, isDark: boolean): React.ReactNode {
  if (!text) return text;

  // Regex to match markdown tokens in priority order:
  // 1. `code`
  // 2. ***bold italic***
  // 3. **bold** or __bold__
  // 4. *italic* or _italic_
  const tokenRegex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;

  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline Code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const codeText = part.slice(1, -1);
      return (
        <code
          key={index}
          className={`font-mono text-[11px] px-1.5 py-0.5 rounded border mx-0.5 ${
            isDark
              ? 'bg-[#1A1D24] text-amber-300 border-[#2D3139]'
              : 'bg-slate-100 text-amber-800 border-slate-200'
          }`}
        >
          {codeText}
        </code>
      );
    }

    // Bold + Italic: ***text***
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      const inner = part.slice(3, -3);
      return (
        <strong key={index} className={`font-bold italic ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {inner}
        </strong>
      );
    }

    // Bold: **text** or __text__
    if ((part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)) {
      const inner = part.slice(2, -2);
      return (
        <strong key={index} className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {inner}
        </strong>
      );
    }

    // Italic: *text* or _text_
    if ((part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length >= 2)) {
      const inner = part.slice(1, -1);
      return (
        <em key={index} className={`italic ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
          {inner}
        </em>
      );
    }

    return part;
  });
}
