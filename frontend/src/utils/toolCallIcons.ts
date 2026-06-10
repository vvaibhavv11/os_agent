export function resolveToolCallIcon(toolName: string): string {
  const icons: Record<string, string> = {
    write: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
    bash: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    shell: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    web_search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    read: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  };
  return icons[toolName] || "M12 6V12m0 0v6m0-6h6m-6 0H6";
}

export function resolveToolCallLabel(toolName: string): string {
  const labels: Record<string, string> = {
    write: "Write file",
    edit: "Edit file",
    bash: "Run command",
    shell: "Run command",
    web_search: "Web search",
    read: "Read file",
  };
  return labels[toolName] || "Use tool";
}
