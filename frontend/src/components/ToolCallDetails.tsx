interface ToolCallDetailsProps {
  name: string;
  args: string;
  result?: string;
  error?: boolean;
}

function formatArgs(name: string, args: string): string {
  const isBashLike = name === "bash" || name === "shell";
  if (isBashLike) return args;

  try {
    const parsed = JSON.parse(args);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return args;
  }
}

export default function ToolCallDetails({ name, args, result, error }: ToolCallDetailsProps) {
  const isBashLike = name === "bash" || name === "shell";

  return (
    <div className="p-3 bg-chat-bg/80 space-y-2">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-chat-text-muted font-medium mb-1">
          {isBashLike ? "Command" : "Arguments"}
        </div>
        <div className="bg-chat-surface rounded-lg p-2.5 overflow-x-auto">
          <pre className={`font-mono text-xs whitespace-pre-wrap ${isBashLike ? "text-[#b8bb26]" : "text-chat-text"}`}>
            {formatArgs(name, args)}
          </pre>
        </div>
      </div>
      {result && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-chat-text-muted font-medium mb-1">
            {error ? "Error" : "Result"}
          </div>
          <div className="bg-chat-surface rounded-lg p-2.5 overflow-x-auto">
            <pre className={`font-mono text-xs whitespace-pre-wrap ${error ? "text-[#fb4934]" : "text-chat-text-muted"}`}>
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
