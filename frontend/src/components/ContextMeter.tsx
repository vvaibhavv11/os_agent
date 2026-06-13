import { useState, useRef, useEffect } from "react";
import { useChatStore, type TokenUsage } from "../stores/chatStore";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toString();
}

function getUsageColor(percentage: number): string {
  if (percentage > 90) return "#ef4444";    // red-500
  if (percentage >= 70) return "#f59e0b";   // amber-500
  return "#818cf8";                         // indigo-400
}

function getUsageLabel(percentage: number): string {
  if (percentage > 90) return "Critical";
  if (percentage >= 70) return "High";
  if (percentage >= 40) return "Moderate";
  return "Low";
}

// SVG ring constants
const SIZE = 18;
const CENTER = SIZE / 2;
const RADIUS = 7;
const STROKE = 2.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Component ───────────────────────────────────────────────────────────────

export default function ContextMeter() {
  const tokenUsage = useChatStore((s) => s.tokenUsage);
  const [showTooltip, setShowTooltip] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close tooltip on click outside
  useEffect(() => {
    if (!showTooltip) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTooltip]);

  if (!tokenUsage || tokenUsage.totalTokens === 0) return null;

  // Estimate context window usage. Most models have 128k context windows.
  // We use the inputTokens as "used" since that represents the conversation context sent.
  const contextMax = 128_000; // conservative default
  const contextUsed = tokenUsage.inputTokens;
  const percentage = Math.min((contextUsed / contextMax) * 100, 100);
  const dashOffset = CIRCUMFERENCE - (percentage / 100) * CIRCUMFERENCE;
  const color = getUsageColor(percentage);

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      {/* Ring button */}
      <button
        onClick={() => setShowTooltip((v) => !v)}
        className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-chat-surface/40 transition-colors group"
        title="Token usage"
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-chat-border/30"
          />
          {/* Progress */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <span className="text-[10px] text-chat-text-muted group-hover:text-chat-text transition-colors">
          {formatTokenCount(tokenUsage.totalTokens)}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-chat-bg/95 backdrop-blur-xl border border-chat-border/50 rounded-xl shadow-2xl shadow-black/40 p-3 animate-slide-up-fade z-50">
          {/* Header */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-chat-text">Context Window</span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              {getUsageLabel(percentage)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-2.5">
            <div className="flex justify-between text-[10px] text-chat-text-muted mb-1">
              <span>{Math.round(percentage)}% used</span>
              <span>{formatTokenCount(contextUsed)} / {formatTokenCount(contextMax)}</span>
            </div>
            <div className="h-1.5 bg-chat-surface rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>

          {/* Token breakdown */}
          <div className="space-y-1.5 border-t border-chat-border/30 pt-2">
            <TokenRow label="Input" value={tokenUsage.inputTokens} icon="→" />
            <TokenRow label="Output" value={tokenUsage.outputTokens} icon="←" />
            {tokenUsage.reasoningTokens > 0 && (
              <TokenRow label="Reasoning" value={tokenUsage.reasoningTokens} icon="◆" />
            )}
            {tokenUsage.cacheReadTokens > 0 && (
              <TokenRow label="Cache Read" value={tokenUsage.cacheReadTokens} icon="↗" />
            )}
            {tokenUsage.cacheWriteTokens > 0 && (
              <TokenRow label="Cache Write" value={tokenUsage.cacheWriteTokens} icon="↙" />
            )}
            <div className="border-t border-chat-border/20 pt-1">
              <TokenRow label="Total" value={tokenUsage.totalTokens} icon="Σ" bold />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Token Row ───────────────────────────────────────────────────────────────

function TokenRow({
  label,
  value,
  icon,
  bold,
}: {
  label: string;
  value: number;
  icon: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`flex items-center gap-1.5 text-[11px] ${
          bold ? "text-chat-text font-medium" : "text-chat-text-muted"
        }`}
      >
        <span className="w-3 text-center text-[9px] opacity-60">{icon}</span>
        {label}
      </span>
      <span
        className={`text-[11px] tabular-nums ${
          bold ? "text-chat-text font-medium" : "text-chat-text-muted"
        }`}
      >
        {formatTokenCount(value)}
      </span>
    </div>
  );
}
