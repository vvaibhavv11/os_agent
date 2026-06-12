import { useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";

function typeLabel(t: string) {
  switch (t) {
    case "openrouter": return "OpenRouter";
    case "openai": return "OpenAI";
    case "compat": return "Compatible";
    default: return t;
  }
}

function typeColor(t: string) {
  switch (t) {
    case "openrouter": return "bg-blue-500/20 text-blue-300";
    case "openai": return "bg-green-500/20 text-green-300";
    case "compat": return "bg-purple-500/20 text-purple-300";
    default: return "bg-gray-500/20 text-gray-300";
  }
}

export default function SettingsPage() {
  const {
    showSettings,
    providers, activeProvider, editingId,
    models, loading, dirty, saved,
    setActive, setEditing,
    updateProvider, addProvider, removeProvider,
    save, close, fetchModels,
  } = useSettingsStore();

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [modelDropdowns, setModelDropdowns] = useState<Record<string, boolean>>({});

  if (!showSettings) return null;

  const toggleShowKey = (id: string) =>
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));

  const needsSave = providers.some(
    (p) => p.type === "compat" && !p.baseURL
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="w-full max-w-lg mx-4 bg-chat-bg border border-chat-border/50 rounded-2xl shadow-2xl animate-slide-up overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-chat-border/50">
          <h1 className="text-base font-semibold text-chat-text">Settings</h1>
          <button
            onClick={close}
            className="p-1.5 rounded-xl hover:bg-chat-surface transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5 text-chat-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* provider list */}
        <div className="px-3 py-3 space-y-2 max-h-[60vh] overflow-y-auto">
          {providers.length === 0 && (
            <p className="text-sm text-chat-text-muted text-center py-6">
              No providers configured. Click "Add Provider" to get started.
            </p>
          )}

          {providers.map((provider) => {
            const isExpanded = editingId === provider.id;
            const isActive = activeProvider === provider.id;
            const ms = models[provider.id];
            const showModelList = modelDropdowns[provider.id];

            return (
              <div
                key={provider.id}
                className={`rounded-xl border transition-all duration-200 ${
                  isActive
                    ? "border-chat-accent/40 bg-chat-accent/5"
                    : "border-chat-border/30 bg-chat-surface/40"
                } ${isExpanded ? "ring-1 ring-chat-accent/30" : ""}`}
              >
                {/* collapsed row */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
                  onClick={() => setEditing(isExpanded ? null : provider.id)}
                >
                  {/* radio */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setActive(provider.id); }}
                    className={`shrink-0 w-4 h-4 rounded-full border-2 transition-colors ${
                      isActive
                        ? "border-chat-accent bg-chat-accent"
                        : "border-chat-border hover:border-chat-accent"
                    }`}
                    title={isActive ? "Active provider" : "Set as active"}
                  />

                  {/* name */}
                  <span className="text-sm font-medium text-chat-text truncate min-w-0 flex-1">
                    {provider.name || "Unnamed"}
                  </span>

                  {/* type badge */}
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 ${typeColor(provider.type)}`}>
                    {typeLabel(provider.type)}
                  </span>

                  {/* model */}
                  {provider.model && (
                    <span className="text-[11px] text-chat-text-muted truncate max-w-[120px] hidden sm:block">
                      {provider.model}
                    </span>
                  )}

                  {/* delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeProvider(provider.id); }}
                    className="p-1 rounded-lg hover:bg-red-500/20 opacity-30 hover:opacity-100 transition-opacity shrink-0"
                    title="Remove provider"
                  >
                    <svg className="w-3.5 h-3.5 text-chat-text-muted hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>

                  {/* chevron */}
                  <svg
                    className={`w-4 h-4 text-chat-text-muted shrink-0 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* expanded form */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-chat-border/20">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-chat-text-muted mb-1">Name</label>
                      <input
                        type="text"
                        value={provider.name}
                        onChange={(e) => updateProvider(provider.id, "name", e.target.value)}
                        placeholder="My Provider"
                        className="w-full px-3 py-1.5 rounded-lg bg-chat-bg border border-chat-border/40 text-chat-text text-sm placeholder-chat-text-muted/50 focus:outline-none focus:border-chat-accent transition-colors"
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label className="block text-xs font-medium text-chat-text-muted mb-1">Type</label>
                      <select
                        value={provider.type}
                        onChange={(e) => updateProvider(provider.id, "type", e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-chat-bg border border-chat-border/40 text-chat-text text-sm focus:outline-none focus:border-chat-accent transition-colors"
                      >
                        <option value="openrouter">OpenRouter</option>
                        <option value="openai">OpenAI</option>
                        <option value="compat">OpenAI Compatible</option>
                      </select>
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="block text-xs font-medium text-chat-text-muted mb-1">API Key</label>
                      <div className="relative">
                        <input
                          type={showKeys[provider.id] ? "text" : "password"}
                          value={provider.apiKey}
                          onChange={(e) => updateProvider(provider.id, "apiKey", e.target.value)}
                          placeholder={provider.type === "compat" ? "Optional for local endpoints" : "sk-..."}
                          className="w-full px-3 py-1.5 pr-8 rounded-lg bg-chat-bg border border-chat-border/40 text-chat-text text-sm placeholder-chat-text-muted/50 focus:outline-none focus:border-chat-accent transition-colors"
                        />
                        <button
                          onClick={() => toggleShowKey(provider.id)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-chat-surface transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-chat-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            {showKeys[provider.id] ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            )}
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Model + Fetch */}
                    <div>
                      <label className="block text-xs font-medium text-chat-text-muted mb-1">Model</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={provider.model}
                            onChange={(e) => updateProvider(provider.id, "model", e.target.value)}
                            placeholder="gpt-4o-mini"
                            className="w-full px-3 py-1.5 rounded-lg bg-chat-bg border border-chat-border/40 text-chat-text text-sm placeholder-chat-text-muted/50 focus:outline-none focus:border-chat-accent transition-colors"
                          />
                          {/* model dropdown */}
                          {showModelList && ms && ms.list.length > 0 && (
                            <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-chat-surface border border-chat-border/50 rounded-lg shadow-lg">
                              {ms.list.map((mid) => (
                                <button
                                  key={mid}
                                  className="w-full text-left px-3 py-1.5 text-sm text-chat-text hover:bg-chat-bg transition-colors truncate"
                                  onClick={() => {
                                    updateProvider(provider.id, "model", mid);
                                    setModelDropdowns((prev) => ({ ...prev, [provider.id]: false }));
                                  }}
                                >
                                  {mid}
                                </button>
                              ))}
                            </div>
                          )}
                          {ms && ms.error && (
                            <p className="text-xs text-red-400 mt-0.5">{ms.error}</p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            fetchModels(provider.id);
                            setModelDropdowns((prev) => ({ ...prev, [provider.id]: true }));
                          }}
                          disabled={ms?.loading}
                          className="px-2.5 py-1.5 rounded-lg bg-chat-surface border border-chat-border/40 text-chat-text-muted hover:text-chat-text hover:border-chat-accent/40 disabled:opacity-40 transition-all duration-200 shrink-0"
                          title="Fetch models"
                        >
                          {ms?.loading ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Base URL */}
                    <div>
                      <label className="block text-xs font-medium text-chat-text-muted mb-1">
                        Base URL
                        {provider.type !== "compat" && (
                          <span className="text-chat-text-muted/50 ml-1">(optional override)</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={provider.baseURL}
                        onChange={(e) => updateProvider(provider.id, "baseURL", e.target.value)}
                        placeholder={
                          provider.type === "openrouter" ? "https://openrouter.ai/api/v1" :
                          provider.type === "openai" ? "https://api.openai.com/v1" :
                          "https://..."
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-chat-bg border border-chat-border/40 text-chat-text text-sm placeholder-chat-text-muted/50 focus:outline-none focus:border-chat-accent transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* add provider button */}
        <div className="px-4 pb-3">
          <button
            onClick={addProvider}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-dashed border-chat-border/50 text-chat-text-muted text-sm hover:border-chat-accent/40 hover:text-chat-accent transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Provider
          </button>
        </div>

        {/* footer */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-chat-border/50">
          <button
            onClick={save}
            disabled={loading || !dirty || needsSave}
            className="px-5 py-2 rounded-xl bg-chat-accent text-white text-sm font-medium hover:bg-chat-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? "Saving..." : "Save"}
          </button>
          {saved && (
            <span className="text-sm text-green-400 animate-fade-in">
              Settings saved
            </span>
          )}
          <button
            onClick={close}
            className="px-5 py-2 rounded-xl border border-chat-border/50 text-chat-text text-sm hover:bg-chat-surface transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
