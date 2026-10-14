function safeHref(value) {
  if (/^https?:\/\//i.test(value) || (value.startsWith("/") && !value.startsWith("//"))) return value;
  return null;
}

function renderInline(text) {
  const tokenPattern = /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g;
  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = tokenPattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[2]) {
      const href = safeHref(match[3]);
      nodes.push(href ? <a key={key++} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className="font-semibold text-primary underline">{match[2]}</a> : match[2]);
    } else if (match[4] || match[5]) {
      nodes.push(<strong key={key++}>{match[4] || match[5]}</strong>);
    } else {
      nodes.push(<em key={key++}>{match[6] || match[7]}</em>);
    }
    lastIndex = tokenPattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export default function ChatbotMessageContent({ content }) {
  const lines = String(content || "").split(/\r?\n/);
  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
        const bulleted = line.match(/^\s*[-*]\s+(.+)$/);
        if (numbered) return <div key={index} className="flex gap-2"><span>{line.match(/^\s*(\d+)[.)]/)[1]}.</span><span>{renderInline(numbered[1])}</span></div>;
        if (bulleted) return <div key={index} className="flex gap-2"><span>•</span><span>{renderInline(bulleted[1])}</span></div>;
        return <div key={index} className={line ? "" : "h-2"}>{renderInline(line)}</div>;
      })}
    </div>
  );
}
