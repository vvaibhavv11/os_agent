import { create } from 'zustand';
import { GetSettings, SaveSettings, FetchModels } from '../../wailsjs/go/main/App';

// --- Interfaces ---

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  type: string; // 'openrouter' | 'openai' | 'compat'
  model: string; // default model
  baseURL: string;
  apiKey: string;
}

export interface FavoriteModel {
  provider: string;
  modelId: string;
}

interface CachedModels {
  list: ModelInfo[];
  loading: boolean;
  error: string;
  fetchedAt: number;
}

interface ModelSelectorState {
  // Current selection
  selectedProvider: string;
  selectedModel: string;

  // All configured providers
  providers: ProviderInfo[];

  // Cached models per provider ID
  modelsByProvider: Record<string, CachedModels>;

  // Favorites
  favoriteModels: FavoriteModel[];

  // Whether the store has been initialized
  initialized: boolean;

  // Actions
  init: () => Promise<void>;
  refreshProviders: () => Promise<void>;
  setSelection: (providerId: string, modelId: string) => void;
  fetchModelsForProvider: (providerId: string) => Promise<void>;
  toggleFavorite: (provider: string, modelId: string) => void;
  isFavorite: (provider: string, modelId: string) => boolean;
}

// --- Constants ---

const FAVORITES_KEY = 'ai-chat-favorite-models';
const CACHE_TTL = 300_000; // 5 minutes

// --- Helpers ---

function loadFavorites(): FavoriteModel[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupt data
  }
  return [];
}

function saveFavorites(favorites: FavoriteModel[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    // ignore write errors
  }
}

interface SettingsJSON {
  active_provider: string;
  providers: Array<{
    id: string;
    name: string;
    type: string;
    api_key: string;
    model: string;
    base_url: string;
  }>;
}

function parseSettings(json: string): SettingsJSON {
  return JSON.parse(json);
}

function mapProviders(settings: SettingsJSON): ProviderInfo[] {
  return (settings.providers || []).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    model: p.model,
    baseURL: p.base_url,
    apiKey: p.api_key,
  }));
}

// --- Store ---

export const useModelSelectorStore = create<ModelSelectorState>((set, get) => ({
  selectedProvider: '',
  selectedModel: '',
  providers: [],
  modelsByProvider: {},
  favoriteModels: [],
  initialized: false,

  async init() {
    try {
      const settingsJSON = await GetSettings();
      const settings = parseSettings(settingsJSON);
      const providers = mapProviders(settings);

      const activeId = settings.active_provider || '';
      const activeProvider = providers.find((p) => p.id === activeId);
      const selectedModel = activeProvider?.model || '';

      const favoriteModels = loadFavorites();

      set({
        providers,
        selectedProvider: activeId,
        selectedModel,
        favoriteModels,
        initialized: true,
      });
    } catch (err) {
      console.error('[modelSelectorStore] init failed:', err);
      // Still mark as initialized so the UI isn't stuck
      set({ initialized: true });
    }
  },

  async refreshProviders() {
    try {
      const settingsJSON = await GetSettings();
      const settings = parseSettings(settingsJSON);
      const providers = mapProviders(settings);
      set({ providers });
    } catch (err) {
      console.error('[modelSelectorStore] refreshProviders failed:', err);
    }
  },

  setSelection(providerId: string, modelId: string) {
    // Update local state immediately
    set({ selectedProvider: providerId, selectedModel: modelId });

    // Persist in background — don't block the UI
    (async () => {
      try {
        const settingsJSON = await GetSettings();
        const settings = parseSettings(settingsJSON);

        settings.active_provider = providerId;

        const provider = settings.providers?.find((p) => p.id === providerId);
        if (provider) {
          provider.model = modelId;
        }

        await SaveSettings(JSON.stringify(settings));
      } catch (err) {
        console.error('[modelSelectorStore] setSelection persist failed:', err);
      }
    })();
  },

  async fetchModelsForProvider(providerId: string) {
    const { modelsByProvider, providers } = get();

    // Check cache freshness
    const cached = modelsByProvider[providerId];
    if (cached && !cached.error && cached.fetchedAt && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return;
    }

    const provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      set({
        modelsByProvider: {
          ...get().modelsByProvider,
          [providerId]: { list: [], loading: false, error: 'Provider not found', fetchedAt: 0 },
        },
      });
      return;
    }

    // Set loading state
    set({
      modelsByProvider: {
        ...get().modelsByProvider,
        [providerId]: {
          list: cached?.list || [],
          loading: true,
          error: '',
          fetchedAt: cached?.fetchedAt || 0,
        },
      },
    });

    try {
      const modelsJSON = await FetchModels(provider.type, provider.baseURL, provider.apiKey);
      const models: ModelInfo[] = JSON.parse(modelsJSON);

      set({
        modelsByProvider: {
          ...get().modelsByProvider,
          [providerId]: {
            list: models,
            loading: false,
            error: '',
            fetchedAt: Date.now(),
          },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({
        modelsByProvider: {
          ...get().modelsByProvider,
          [providerId]: {
            list: cached?.list || [],
            loading: false,
            error: message,
            fetchedAt: cached?.fetchedAt || 0,
          },
        },
      });
      console.error('[modelSelectorStore] fetchModelsForProvider failed:', err);
    }
  },

  toggleFavorite(provider: string, modelId: string) {
    const { favoriteModels } = get();
    const idx = favoriteModels.findIndex(
      (f) => f.provider === provider && f.modelId === modelId
    );

    let updated: FavoriteModel[];
    if (idx >= 0) {
      updated = [...favoriteModels.slice(0, idx), ...favoriteModels.slice(idx + 1)];
    } else {
      updated = [...favoriteModels, { provider, modelId }];
    }

    set({ favoriteModels: updated });
    saveFavorites(updated);
  },

  isFavorite(provider: string, modelId: string) {
    return get().favoriteModels.some(
      (f) => f.provider === provider && f.modelId === modelId
    );
  },
}));
