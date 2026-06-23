export function resolveToolCallIcon(toolName: string): string {
  const icons: Record<string, string> = {
    write: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
    bash: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    shell: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    web_search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    webSearch: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    read: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    memory: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  };
  return icons[toolName] || "M12 6V12m0 0v6m0-6h6m-6 0H6";
}

/** Extract a short, human-readable basename from a file path */
function basename(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || p;
}

/** Truncate a string, adding ellipsis if needed */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

/**
 * Build a smart, contextual label from tool name + args JSON.
 * Examples: "Read main.go", "Write config.yaml", "Edit tools.go",
 *           "Run ls -la", "Search web: react hooks", "Save memory"
 */
export function resolveToolCallLabel(toolName: string, argsJson?: string): string {
  const fallbackLabels: Record<string, string> = {
    write: "Write file",
    edit: "Edit file",
    bash: "Run command",
    shell: "Run command",
    web_search: "Web search",
    webSearch: "Web search",
    read: "Read file",
    memory: "Memory",
  };

  if (!argsJson) {
    return fallbackLabels[toolName] || "Use tool";
  }

  try {
    const args = JSON.parse(argsJson);

    switch (toolName) {
      case "write": {
        const p = args.path || args.filePath || "";
        return p ? `Write ${basename(p)}` : "Write file";
      }
      case "edit": {
        const p = args.filePath || args.path || "";
        return p ? `Edit ${basename(p)}` : "Edit file";
      }
      case "bash":
      case "shell": {
        const cmd = args.command || "";
        return cmd ? `Run ${truncate(cmd, 40)}` : "Run command";
      }
      case "web_search":
      case "webSearch": {
        const q = args.query || "";
        return q ? `Search ${truncate(q, 35)}` : "Web search";
      }
      case "read": {
        const p = args.path || args.filePath || "";
        return p ? `Read ${basename(p)}` : "Read file";
      }
      case "memory": {
        const action = args.action || "";
        const target = args.target || "";
        if (action && target) {
          const verb = action.charAt(0).toUpperCase() + action.slice(1);
          return `${verb} ${target}`;
        }
        return "Memory";
      }
      default: {
        return fallbackLabels[toolName] || "Use tool";
      }
    }
  } catch {
    return fallbackLabels[toolName] || "Use tool";
  }
}
