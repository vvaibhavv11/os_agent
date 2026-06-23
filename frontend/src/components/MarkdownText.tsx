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

function attrEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isWordChar(ch: string): boolean {
  return /[a-zA-Z0-9_]/.test(ch);
}

function getKeywords(lang: string): Set<string> {
  const common = new Set([
    "if", "else", "for", "while", "do", "switch", "case", "break",
    "continue", "return", "try", "catch", "finally", "throw", "new",
    "delete", "typeof", "instanceof", "void", "this", "super", "class",
    "extends", "import", "export", "from", "default", "as", "const",
    "let", "var", "function", "async", "await", "yield", "in", "of",
    "true", "false", "null", "undefined", "NaN",
  ]);
  const langSpecific: Record<string, string[]> = {
    python: ["def", "elif", "lambda", "with", "pass", "raise", "import", "from", "as", "class", "return", "if", "elif", "else", "for", "while", "try", "except", "finally", "yield", "in", "not", "and", "or", "True", "False", "None"],
    go: ["func", "package", "import", "type", "struct", "interface", "map", "chan", "go", "defer", "select", "range", "var", "const", "nil", "true", "false", "if", "else", "for", "switch", "case", "default", "break", "continue", "return", "fallthrough"],
  };
  if (langSpecific[lang]) {
    return new Set(langSpecific[lang]);
  }
  return common;
}

function isCommentStart(lang: string, line: string, i: number): number {
  if ((lang === "go" || lang === "js" || lang === "ts" || lang === "css") && line[i] === "/" && line[i + 1] === "/") return 2;
  if (lang === "python" || lang === "bash" || lang === "yaml" || lang === "shell") {
    if (line[i] === "#") return 1;
  }
  return 0;
}

function highlightSingleLine(code: string, lang: string): string {
  const keywords = getKeywords(lang);
  const out: string[] = [];
  let i = 0;

  while (i < code.length) {
    // Single-line comment
    const commentLen = isCommentStart(lang, code, i);
    if (commentLen > 0) {
      const rest = code.slice(i);
      out.push(`<span class="text-gray-500 italic">${escapeHtml(rest)}</span>`);
      break;
    }

    // Double-quoted string
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') {
        if (code[j] === "\\") j++;
        j++;
      }
      out.push(`<span class="text-green-400">${escapeHtml(code.slice(i, j + 1))}</span>`);
      i = j + 1;
      continue;
    }

    // Single-quoted string
    if (code[i] === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== "'") {
        if (code[j] === "\\") j++;
        j++;
      }
      out.push(`<span class="text-green-400">${escapeHtml(code.slice(i, j + 1))}</span>`);
      i = j + 1;
      continue;
    }

    // Template literal (backtick)
    if (code[i] === "`") {
      let j = i + 1;
      while (j < code.length && code[j] !== "`") {
        if (code[j] === "\\") j++;
        j++;
      }
      out.push(`<span class="text-green-400">${escapeHtml(code.slice(i, j + 1))}</span>`);
      i = j + 1;
      continue;
    }

    // Number
    if (/[0-9]/.test(code[i]) && (i === 0 || !isWordChar(code[i - 1]))) {
      let j = i;
      while (j < code.length && /[0-9.]/.test(code[j])) j++;
      out.push(`<span class="text-yellow-400">${escapeHtml(code.slice(i, j))}</span>`);
      i = j;
      continue;
    }

    // Word (keyword, function)
    if (isWordChar(code[i]) && !/[0-9]/.test(code[i])) {
      let j = i;
      while (j < code.length && isWordChar(code[j])) j++;
      const word = code.slice(i, j);
      const escaped = escapeHtml(word);

      // Skip remaining whitespace to check for parenthesis (function call)
      let k = j;
      while (k < code.length && code[k] === " ") k++;
      if (keywords.has(word)) {
        out.push(`<span class="text-purple-400">${escaped}</span>`);
      } else if (code[k] === "(") {
        out.push(`<span class="text-blue-400">${escaped}</span>`);
      } else {
        out.push(escaped);
      }
      i = j;
      continue;
    }

    // Everything else
    out.push(escapeHtml(code[i]));
    i++;
  }

  return out.join("");
}

function highlightCode(code: string, lang: string): string {
  const lines = code.split("\n");
  return lines.map((line) => highlightSingleLine(line, lang)).join("\n");
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

function isTableSeparator(line: string): boolean {
  return /^\|?[\s\-:|]+\|[\s\-:|]*$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((c) => c.trim());
}

function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let codeLang = "";
  let lastWasEmpty = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      lastWasEmpty = false;
      if (inCode) {
        const codeText = codeBuf.join("\n");
        const highlighted = highlightCode(codeText, codeLang);
        const encodedCopy = encodeURIComponent(codeText);
        out.push(
          `<div class="my-3 rounded-xl overflow-hidden border border-chat-border/40 bg-slate-900/60">` +
          `<div class="flex items-center justify-between px-4 py-1.5 border-b border-chat-border/30 bg-slate-800/40">` +
          (codeLang ? `<span class="text-[10px] uppercase tracking-wider text-chat-text-muted font-medium">${escapeHtml(codeLang)}</span>` : `<span></span>`) +
          `<button data-copy="${attrEscape(encodedCopy)}" class="text-[10px] text-chat-text-muted hover:text-chat-text transition-colors">Copy</button>` +
          `</div>` +
          `<pre class="p-4 overflow-x-auto text-xs leading-relaxed"><code class="font-mono">${highlighted}</code></pre></div>`
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

    // Empty line — collapse consecutive empties into one spacer
    if (line.trim() === "") {
      if (!lastWasEmpty) {
        out.push(`<div class="h-2"></div>`);
      }
      lastWasEmpty = true;
      continue;
    }
    lastWasEmpty = false;

    // Table: detect a block of pipe-delimited lines
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableRows: string[][] = [];
      let hasHeader = false;
      let j = i;
      // Collect all contiguous table lines
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        if (isTableSeparator(lines[j])) {
          hasHeader = true;
          j++;
          continue;
        }
        tableRows.push(parseTableRow(lines[j]));
        j++;
      }
      if (tableRows.length > 0) {
        let tableHtml = `<div class="my-3 overflow-x-auto rounded-lg border border-chat-border/40"><table class="md-table">`;
        const startRow = hasHeader ? 1 : 0;
        if (hasHeader && tableRows.length > 0) {
          tableHtml += `<thead><tr>`;
          for (const cell of tableRows[0]) {
            tableHtml += `<th>${renderInline(cell)}</th>`;
          }
          tableHtml += `</tr></thead>`;
        }
        tableHtml += `<tbody>`;
        for (let r = startRow; r < tableRows.length; r++) {
          tableHtml += `<tr>`;
          for (const cell of tableRows[r]) {
            tableHtml += `<td>${renderInline(cell)}</td>`;
          }
          tableHtml += `</tr>`;
        }
        tableHtml += `</tbody></table></div>`;
        out.push(tableHtml);
        i = j - 1; // advance past the table block
        continue;
      }
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

    out.push(`<p class="my-1 text-chat-text/90 leading-relaxed">${renderInline(line)}</p>`);
  }

  if (inCode) {
    const codeText = codeBuf.join("\n");
    const highlighted = highlightCode(codeText, codeLang);
    const encodedCopy = encodeURIComponent(codeText);
    out.push(
      `<div class="my-3 rounded-xl overflow-hidden border border-chat-border/40 bg-slate-900/60">` +
      `<div class="flex items-center justify-between px-4 py-1.5 border-b border-chat-border/30 bg-slate-800/40">` +
      (codeLang ? `<span class="text-[10px] uppercase tracking-wider text-chat-text-muted font-medium">${escapeHtml(codeLang)}</span>` : `<span></span>`) +
      `<button data-copy="${attrEscape(encodedCopy)}" class="text-[10px] text-chat-text-muted hover:text-chat-text transition-colors">Copy</button>` +
      `</div>` +
      `<pre class="p-4 overflow-x-auto text-xs leading-relaxed"><code class="font-mono">${highlighted}</code></pre></div>`
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
        if (target.dataset.copy !== undefined) {
          const text = decodeURIComponent(target.dataset.copy);
          navigator.clipboard.writeText(text);
          target.textContent = "Copied!";
          setTimeout(() => {
            target.textContent = "Copy";
          }, 2000);
        }
      }}
    />
  );
}
