export function HighlightedText({ text, highlights }: { text: string; highlights: any[] }) {
  if (!text) return <p className="mt-3 text-sm text-muted-foreground">No text provided.</p>;
  const sorted = [...(highlights || [])].sort((a, b) => a.start - b.start);
  const parts: Array<{ text: string; highlight: boolean; label?: string }> = [];
  let last = 0;
  for (const h of sorted) {
    if (h.start > last) {
      parts.push({ text: text.slice(last, h.start), highlight: false });
    }
    parts.push({ text: text.slice(h.start, h.end), highlight: true, label: h.label });
    last = h.end;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), highlight: false });
  }

  return (
    <p className="mt-3 text-sm leading-relaxed">
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="rounded bg-amber-100 px-1 text-amber-900">{p.text}</mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </p>
  );
}
