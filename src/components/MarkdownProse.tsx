import React from 'react';

interface MarkdownProseProps {
  content: string;
  className?: string;
}

function formatInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={match.index} className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={match.index}
          className="rounded border border-[#E2E8F0] bg-[#FFFFFF] px-1.5 py-0.5 font-mono text-[0.875em] text-[#2563EB] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#60A5FA]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens;
}

export function MarkdownProse({ content, className = '' }: MarkdownProseProps) {
  const blocks = content
    .trim()
    .split(/\n{2,}/)
    .filter((b) => b.trim().length > 0);

  return (
    <div
      className={`space-y-3 text-[15px] leading-[1.65] text-[#0F172A] dark:text-[#F8FAFC] ${className}`}
    >
      {blocks.map((block, idx) => {
        const lines = block.split('\n').map((l) => l.trimEnd());
        const isBulletList = lines.every((l) => /^[-*•]\s+/.test(l.trim()));
        const isOrderedList = lines.every((l) => /^\d+\.\s+/.test(l.trim()));

        if (isBulletList) {
          return (
            <ul key={idx} className="list-disc space-y-1.5 pl-5">
              {lines.map((line, lineIdx) => (
                <li key={lineIdx}>{formatInline(line.trim().replace(/^[-*•]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }

        if (isOrderedList) {
          return (
            <ol key={idx} className="list-decimal space-y-1.5 pl-5">
              {lines.map((line, lineIdx) => (
                <li key={lineIdx}>{formatInline(line.trim().replace(/^\d+\.\s+/, ''))}</li>
              ))}
            </ol>
          );
        }

        if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
          const headingText = lines[0].replace(/^#{1,3}\s+/, '');
          return (
            <h4
              key={idx}
              className="font-display text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC]"
            >
              {formatInline(headingText)}
            </h4>
          );
        }

        return (
          <p key={idx} className="whitespace-pre-wrap">
            {lines.map((line, lineIdx) => (
              <React.Fragment key={lineIdx}>
                {formatInline(line)}
                {lineIdx < lines.length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
