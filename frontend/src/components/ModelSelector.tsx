import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useModelSelectorStore } from "../stores/modelSelectorStore";
import type { ModelInfo } from "../stores/modelSelectorStore";

// ─── Provider Type Helpers ───────────────────────────────────────────────────

function providerTypeIcon(type: string) {
  switch (type) {
    case "openrouter":
      return (
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "openai":
      return (
        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    default:
      return (
        <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
  }
}

function providerTypeBadgeColor(type: string) {
  switch (type) {
    case "openrouter": return "bg-blue-500/15 text-blue-400";
    case "openai":     return "bg-green-500/15 text-green-400";
    default:           return "bg-purple-500/15 text-purple-400";
  }
}

function providerTypeName(type: string) {
  switch (type) {
    case "openrouter": return "OpenRouter";
    case "openai":     return "OpenAI";
    case "compat":     return "Compatible";
    default:           return type;
  }
}

// ─── Truncate model name for trigger display ─────────────────────────────────

function displayModelName(modelId: string): string {
  // Show last segment after slash if present, for readability
  const parts = modelId.split("/");
  return parts.length > 1 ? parts[parts.length - 1] : modelId;
}

// ─── View type ───────────────────────────────────────────────────────────────

type View =
  | { kind: "all" }
  | { kind: "provider"; providerId: string; providerName: string; providerType: string };

// ─── Component ───────────────────────────────────────────────────────────────

export default function ModelSelector() {
  const {
    selectedProvider,
    selectedModel,
    providers,
    modelsByProvider,
    favoriteModels,
    initialized,
    init,
    setSelection,
    fetchModelsForProvider,
    toggleFavorite,
    isFavorite,
  } = useModelSelectorStore();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "all" });
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Init store on mount
  useEffect(() => {
    if (!initialized) init();
  }, [initialized, init]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Auto-focus search when drilling into a provider
  useEffect(() => {
    if (view.kind === "provider" && searchRef.current) {
      searchRef.current.focus();
    }
  }, [view]);

  // Reset view/search when dropdown opens/closes
  useEffect(() => {
    if (open) {
      // Single provider optimization
      if (providers.length === 1) {
        const p = providers[0];
        setView({ kind: "provider", providerId: p.id, providerName: p.name, providerType: p.type });
        fetchModelsForProvider(p.id);
      } else {
        setView({ kind: "all" });
      }
      setSearch("");
      // Fetch models for current selection
      if (selectedProvider) {
        fetchModelsForProvider(selectedProvider);
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback(() => setOpen((v) => !v), []);

  const handleSelectModel = useCallback(
    (providerId: string, modelId: string) => {
      setSelection(providerId, modelId);
      setOpen(false);
    },
    [setSelection]
  );

  const handleDrillProvider = useCallback(
    (providerId: string, providerName: string, providerType: string) => {
      setView({ kind: "provider", providerId, providerName, providerType });
      setSearch("");
      fetchModelsForProvider(providerId);
    },
    [fetchModelsForProvider]
  );

  const handleBack = useCallback(() => {
    setView({ kind: "all" });
    setSearch("");
  }, []);

  // Filtered models for Level 2
  const filteredModels = useMemo((): ModelInfo[] => {
    if (view.kind !== "provider") return [];
    const cached = modelsByProvider[view.providerId];
    if (!cached?.list) return [];
    if (!search.trim()) return cached.list;
    const q = search.trim().toLowerCase();
    return cached.list.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    );
  }, [view, modelsByProvider, search]);

  // ─── Trigger Button ───

  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const triggerLabel = selectedModel ? displayModelName(selectedModel) : "Select a model...";

  // ─── Render ───

  if (!initialized) return null;

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger */}
      <button
        onClick={handleToggle}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-200 ${
          open
            ? "bg-chat-accent/10 border-chat-accent/40 text-chat-text"
            : "bg-chat-surface/40 hover:bg-chat-surface/70 border-chat-border/30 text-chat-text-muted hover:text-chat-text"
        } border backdrop-blur-sm`}
      >
        {currentProvider && providerTypeIcon(currentProvider.type)}
        <span className="max-w-[180px] truncate">{triggerLabel}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 max-h-[400px] bg-chat-bg/95 backdrop-blur-xl border border-chat-border/50 rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-slide-up-fade z-50 flex flex-col">
          {view.kind === "all" ? (
            <AllProvidersView
              providers={providers}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              favoriteModels={favoriteModels}
              modelsByProvider={modelsByProvider}
              onDrillProvider={handleDrillProvider}
              onSelectModel={handleSelectModel}
              isFavorite={isFavorite}
            />
          ) : (
            <ProviderModelsView
              providerId={view.providerId}
              providerName={view.providerName}
              providerType={view.providerType}
              models={filteredModels}
              cached={modelsByProvider[view.providerId]}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              search={search}
              onSearch={setSearch}
              onBack={providers.length > 1 ? handleBack : undefined}
              onSelect={handleSelectModel}
              onToggleFavorite={toggleFavorite}
              onRetry={() => fetchModelsForProvider(view.providerId)}
              isFavorite={isFavorite}
              searchRef={searchRef}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Level 1: All Providers ──────────────────────────────────────────────────

interface AllProvidersViewProps {
  providers: ReturnType<typeof useModelSelectorStore.getState>["providers"];
  selectedProvider: string;
  selectedModel: string;
  favoriteModels: ReturnType<typeof useModelSelectorStore.getState>["favoriteModels"];
  modelsByProvider: ReturnType<typeof useModelSelectorStore.getState>["modelsByProvider"];
  onDrillProvider: (id: string, name: string, type: string) => void;
  onSelectModel: (providerId: string, modelId: string) => void;
  isFavorite: (provider: string, modelId: string) => boolean;
}

function AllProvidersView({
  providers,
  selectedProvider,
  selectedModel,
  favoriteModels,
  modelsByProvider,
  onDrillProvider,
  onSelectModel,
}: AllProvidersViewProps) {
  return (
    <div className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-2.5 pb-1.5">
        <span className="text-[10px] font-semibold text-chat-text-muted/60 uppercase tracking-wider">
          Select Model
        </span>
      </div>

      <div className="overflow-y-auto flex-1 pb-1">
        {/* Favorites */}
        {favoriteModels.length > 0 && (
          <div className="px-1.5 mb-1">
            <div className="px-2 py-1">
              <span className="text-[10px] font-medium text-amber-400/70 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Favorites
              </span>
            </div>
            {favoriteModels.map((fav) => {
              const provider = providers.find((p) => p.id === fav.provider);
              if (!provider) return null;
              const isSelected = selectedProvider === fav.provider && selectedModel === fav.modelId;
              return (
                <button
                  key={`${fav.provider}:${fav.modelId}`}
                  onClick={() => onSelectModel(fav.provider, fav.modelId)}
                  className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left transition-all duration-150 ${
                    isSelected
                      ? "bg-chat-accent/10 ring-1 ring-chat-accent/30"
                      : "hover:bg-chat-surface/50"
                  }`}
                >
                  <svg className="w-3 h-3 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {providerTypeIcon(provider.type)}
                  <span className="text-sm text-chat-text truncate flex-1">
                    {displayModelName(fav.modelId)}
                  </span>
                  <span className="text-[10px] text-chat-text-muted shrink-0">{provider.name}</span>
                </button>
              );
            })}
            <div className="mx-2 my-1 border-t border-chat-border/20" />
          </div>
        )}

        {/* Providers */}
        <div className="px-1.5">
          {providers.length === 0 && (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-chat-text-muted">No providers configured.</p>
              <p className="text-[10px] text-chat-text-muted/50 mt-1">
                Add providers in Settings
              </p>
            </div>
          )}
          {providers.map((provider) => {
            const cached = modelsByProvider[provider.id];
            const modelCount = cached?.list?.length ?? 0;
            const isLoading = cached?.loading ?? false;
            const hasError = !!cached?.error;

            return (
              <button
                key={provider.id}
                onClick={() => onDrillProvider(provider.id, provider.name, provider.type)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left hover:bg-chat-surface/50 transition-all duration-150 group"
              >
                {providerTypeIcon(provider.type)}
                <span className="text-sm font-medium text-chat-text truncate flex-1">
                  {provider.name}
                </span>
                {isLoading && (
                  <svg className="w-3.5 h-3.5 text-chat-text-muted animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {!isLoading && hasError && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Error fetching models" />
                )}
                {!isLoading && !hasError && modelCount > 0 && (
                  <span className="text-[10px] text-chat-text-muted bg-chat-surface/80 px-1.5 py-0.5 rounded-full shrink-0">
                    {modelCount}
                  </span>
                )}
                <svg
                  className="w-3.5 h-3.5 text-chat-text-muted/40 group-hover:text-chat-text-muted shrink-0 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Level 2: Provider Models ────────────────────────────────────────────────

interface ProviderModelsViewProps {
  providerId: string;
  providerName: string;
  providerType: string;
  models: ModelInfo[];
  cached:
    | { list: ModelInfo[]; loading: boolean; error: string; fetchedAt: number }
    | undefined;
  selectedProvider: string;
  selectedModel: string;
  search: string;
  onSearch: (value: string) => void;
  onBack?: () => void;
  onSelect: (providerId: string, modelId: string) => void;
  onToggleFavorite: (provider: string, modelId: string) => void;
  onRetry: () => void;
  isFavorite: (provider: string, modelId: string) => boolean;
  searchRef: React.RefObject<HTMLInputElement>;
}

function ProviderModelsView({
  providerId,
  providerName,
  providerType,
  models,
  cached,
  selectedProvider,
  selectedModel,
  search,
  onSearch,
  onBack,
  onSelect,
  onToggleFavorite,
  onRetry,
  isFavorite,
  searchRef,
}: ProviderModelsViewProps) {
  const isLoading = cached?.loading ?? false;
  const error = cached?.error ?? "";
  const hasModels = models.length > 0;

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        {onBack && (
          <button
            onClick={onBack}
            className="p-0.5 rounded-md hover:bg-chat-surface/60 transition-colors"
          >
            <svg
              className="w-4 h-4 text-chat-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {providerTypeIcon(providerType)}
        <span className="text-xs font-semibold text-chat-text">{providerName}</span>
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${providerTypeBadgeColor(providerType)}`}>
          {providerTypeName(providerType)}
        </span>
      </div>

      {/* Search */}
      <div className="px-2.5 pb-1.5">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-chat-text-muted/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search models..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-chat-surface/40 border border-chat-border/30 text-sm text-chat-text placeholder-chat-text-muted/50 outline-none focus:border-chat-accent/40 transition-colors"
          />
        </div>
      </div>

      {/* Model List */}
      <div className="overflow-y-auto flex-1 max-h-[280px] px-1.5 pb-1.5">
        {/* Loading skeleton */}
        {isLoading && !hasModels && (
          <div className="space-y-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
              >
                <div className="h-3.5 bg-chat-surface/60 rounded animate-pulse-subtle flex-1" style={{ maxWidth: `${60 + i * 15}%` }} />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-red-400 mb-2">{error}</p>
            <button
              onClick={onRetry}
              className="text-xs text-chat-accent hover:text-chat-accent-hover transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* No models */}
        {!isLoading && !error && !hasModels && !search && (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-chat-text-muted">No models found</p>
            <p className="text-[10px] text-chat-text-muted/50 mt-1">
              Check your API key and base URL
            </p>
          </div>
        )}

        {/* No search results */}
        {!isLoading && !error && !hasModels && search && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-chat-text-muted">
              No models matching "<span className="text-chat-text">{search}</span>"
            </p>
          </div>
        )}

        {/* Model rows */}
        {hasModels &&
          models.map((model) => {
            const isSelected =
              selectedProvider === providerId && selectedModel === model.id;
            const isFav = isFavorite(providerId, model.id);

            return (
              <button
                key={model.id}
                onClick={() => onSelect(providerId, model.id)}
                className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left transition-all duration-150 group ${
                  isSelected
                    ? "bg-chat-accent/10 border-l-2 border-chat-accent"
                    : "border-l-2 border-transparent hover:bg-chat-surface/40"
                }`}
              >
                <span className="text-sm text-chat-text truncate flex-1" title={model.id}>
                  {model.id}
                </span>
                {/* Star button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(providerId, model.id);
                  }}
                  className={`p-0.5 rounded transition-all duration-150 shrink-0 ${
                    isFav
                      ? "text-amber-400 hover:text-amber-300"
                      : "text-chat-text-muted/20 group-hover:text-chat-text-muted/50 hover:!text-amber-400"
                  }`}
                  title={isFav ? "Remove from favorites" : "Add to favorites"}
                >
                  <svg className="w-3.5 h-3.5" fill={isFav ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              </button>
            );
          })}

        {/* Loading indicator when refreshing with existing models */}
        {isLoading && hasModels && (
          <div className="flex justify-center py-2">
            <svg className="w-4 h-4 text-chat-text-muted animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
