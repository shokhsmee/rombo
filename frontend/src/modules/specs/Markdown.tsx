import { Fragment, type ReactNode } from "react";

/** Just enough markdown for OpenSpec files: headings, lists, tables, code blocks, quotes, `code` and **bold**.
 *  No HTML is ever injected: everything is rendered as React text. */
export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      out.push(<pre key={i} className="overflow-x-auto rounded-lg bg-sunk px-3 py-2 font-mono text-xs">{body.join("\n")}</pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls = ["t-title mt-2", "t-h2 mt-4 border-b border-line pb-1", "mt-4 text-base font-semibold", "mt-2 text-sm font-semibold text-accent-ink"][level - 1];
      out.push(<div key={i} className={cls}>{inline(h[2])}</div>);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out.push(<ul key={i} className="ml-5 list-disc space-y-0.5">{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>);
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i++].split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
      }
      out.push(
        <div key={i} className="overflow-x-auto">
          <table className="text-left text-xs">
            <tbody>
              {rows.map((r, k) => (
                <tr key={k} className={k === 0 ? "font-semibold" : "border-t border-line"}>
                  {r.map((c, j) => <td key={j} className="px-2 py-1 align-top">{inline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (line.startsWith(">")) {
      out.push(<blockquote key={i} className="border-l-2 border-line-strong pl-3 text-muted">{inline(line.replace(/^>\s?/, ""))}</blockquote>);
      i++;
      continue;
    }
    if (!line.trim() || line.startsWith("<")) {  // blank, or raw HTML (logo <picture>): skip
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|```|\s*[-*]\s|\||>|<)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={i}>{inline(para.join(" "))}</p>);
  }
  return <div className="grid gap-2 text-sm leading-relaxed">{out}</div>;
}

function inline(text: string): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, k) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
      return <code key={k} className="rounded bg-sunk px-1 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 3) return <b key={k}>{part.slice(2, -2)}</b>;
    return <Fragment key={k}>{part}</Fragment>;
  });
}
