export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-5 py-1.5">
      <div className="w-8 h-8 rounded-xl shrink-0 bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div className="flex items-center gap-1.5 bg-chat-ai-bubble/60 backdrop-blur-sm border border-chat-border/30 rounded-2xl rounded-tl-md px-4 py-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-chat-text-muted animate-pulse-dot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}