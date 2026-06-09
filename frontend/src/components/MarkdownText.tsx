interface Props {
  text: string;
  className?: string;
  linkColor?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-indigo-900/30 text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono'>$1</code>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-400 underline underline-offset-2 decoration-indigo-400/30 hover:decoration-indigo-400 transition-all">$1</a>'
    );
}

function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCode) {
        out.push(
          `<div class="my-3 rounded-xl overflow-hidden border border-chat-border/40 bg-slate-900/60">` +
          (codeLang ? `<div class="flex items-center gap-2 px-4 py-1.5 border-b border-chat-border/30 bg-slate-800/40"><span class="text-[10px] uppercase tracking-wider text-chat-text-muted font-medium">${escapeHtml(codeLang)}</span></div>` : "") +
          `<pre class="p-4 overflow-x-auto text-xs leading-relaxed"><code class="font-mono text-slate-300">${codeBuf.map(escapeHtml).join("\n")}</code></pre></div>`
        );
        codeBuf = [];
        codeLang = "";
        inCode = false;
      } else {
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    if (line.trim() === "") {
      out.push("<br/>");
      continue;
    }

    if (line.startsWith("### ")) {
      out.push(`<h3 class="text-base font-semibold mt-4 mb-1.5 text-chat-text">${renderInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(`<h2 class="text-lg font-semibold mt-4 mb-1.5 text-chat-text">${renderInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(`<h1 class="text-xl font-bold mt-4 mb-1.5 text-chat-text">${renderInline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      out.push(`<li class="ml-5 text-chat-text/90 leading-relaxed">${renderInline(line.slice(2))}</li>`);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      out.push(`<li class="ml-5 list-decimal text-chat-text/90 leading-relaxed">${renderInline(line.replace(/^\d+\.\s/, ""))}</li>`);
      continue;
    }

    out.push(`<p class="my-1.5 text-chat-text/90 leading-relaxed">${renderInline(line)}</p>`);
  }

  if (inCode) {
    out.push(
      `<div class="my-3 rounded-xl overflow-hidden border border-chat-border/40 bg-slate-900/60">` +
      `<pre class="p-4 overflow-x-auto text-xs leading-relaxed"><code class="font-mono text-slate-300">${codeBuf.map(escapeHtml).join("\n")}</code></pre></div>`
    );
  }

  return out.join("\n");
}

export default function MarkdownText({ text, className = "" }: Props) {
  const html = renderMarkdown(text);
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "A") {
          e.preventDefault();
          const href = target.getAttribute("href");
          if (href) window.open(href, "_blank");
        }
      }}
    />
  );
}