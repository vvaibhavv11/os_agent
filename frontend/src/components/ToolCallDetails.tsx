interface ToolCallDetailsProps {
  name: string;
  args: string;
  result?: string;
  error?: boolean;
}

function formatArgs(name: string, args: string): string {
  try {
    const parsed = JSON.parse(args);

    // For bash/shell, show just the command string
    if (name === "bash" || name === "shell") {
      return parsed.command || args;
    }

    // For write, show path
    if (name === "write") {
      const lines: string[] = [];
      if (parsed.path) lines.push(`path: ${parsed.path}`);
      if (parsed.content) {
        const preview = parsed.content.length > 500
          ? parsed.content.slice(0, 500) + "\n... (truncated)"
          : parsed.content;
        lines.push(`content:\n${preview}`);
      }
      return lines.join("\n");
    }

    // For edit, show file path and edits cleanly
    if (name === "edit") {
      const lines: string[] = [];
      if (parsed.filePath) lines.push(`file: ${parsed.filePath}`);
      if (parsed.edits && Array.isArray(parsed.edits)) {
        for (let i = 0; i < parsed.edits.length; i++) {
          const e = parsed.edits[i];
          lines.push(`\nedit ${i + 1}:`);
          if (e.oldText) lines.push(`- ${e.oldText}`);
          if (e.newText) lines.push(`+ ${e.newText}`);
        }
      }
      return lines.join("\n");
    }

    // For webSearch, show the query
    if (name === "webSearch" || name === "web_search") {
      return parsed.query || args;
    }

    // For read, show path
    if (name === "read") {
      return parsed.path || parsed.filePath || args;
    }

    // For memory, show action details
    if (name === "memory") {
      const lines: string[] = [];
      if (parsed.action) lines.push(`action: ${parsed.action}`);
      if (parsed.target) lines.push(`target: ${parsed.target}`);
      if (parsed.content) lines.push(`content: ${parsed.content}`);
      if (parsed.old_text) lines.push(`old_text: ${parsed.old_text}`);
      return lines.join("\n");
    }

    return JSON.stringify(parsed, null, 2);
  } catch {
    return args;
  }
}

function getArgLabel(name: string): string {
  switch (name) {
    case "bash":
    case "shell":
      return "Command";
    case "webSearch":
    case "web_search":
      return "Query";
    case "write":
    case "edit":
      return "Details";
    case "read":
      return "Path";
    case "memory":
      return "Details";
    default:
      return "Arguments";
  }
}

export default function ToolCallDetails({ name, args, result, error }: ToolCallDetailsProps) {
  const isBashLike = name === "bash" || name === "shell";

  return (
    <div className="p-2.5 bg-chat-bg/80 space-y-2">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-chat-text-muted/60 font-medium mb-1">
          {getArgLabel(name)}
        </div>
        <div className="bg-chat-surface/60 rounded-md p-2 overflow-x-auto">
          <pre className={`font-mono text-[11px] whitespace-pre-wrap leading-relaxed ${isBashLike ? "text-[#b8bb26]" : "text-chat-text/80"}`}>
            {formatArgs(name, args)}
          </pre>
        </div>
      </div>
      {result && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-chat-text-muted/60 font-medium mb-1">
            {error ? "Error" : "Output"}
          </div>
          <div className="bg-chat-surface/60 rounded-md p-2 overflow-x-auto max-h-48 overflow-y-auto">
            <pre className={`font-mono text-[11px] whitespace-pre-wrap leading-relaxed ${error ? "text-[#fb4934]" : "text-chat-text-muted/80"}`}>
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
