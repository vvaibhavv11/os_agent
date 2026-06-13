import { create } from "zustand";
import { GetSettings, SaveSettings, FetchModels } from "../../wailsjs/go/main/App";
import { useModelSelectorStore } from './modelSelectorStore';

export interface ProviderForm {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  model: string;
  baseURL: string;
}

interface ModelsState {
  list: string[];
  loading: boolean;
  error: string;
}

interface SettingsState {
  showSettings: boolean;
  providers: ProviderForm[];
  activeProvider: string;
  editingId: string | null;
  models: Record<string, ModelsState>;
  loading: boolean;
  dirty: boolean;
  saved: boolean;

  open: () => void;
  close: () => void;
  load: () => Promise<void>;
  save: () => Promise<void>;

  setActive: (id: string) => void;
  setEditing: (id: string | null) => void;
  updateProvider: (id: string, field: keyof ProviderForm, value: string) => void;
  addProvider: () => void;
  removeProvider: (id: string) => void;
  fetchModels: (providerId: string) => Promise<void>;
}

function genId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function defaultBaseURL(type: string): string {
  switch (type) {
    case "openrouter": return "https://openrouter.ai/api/v1";
    case "openai": return "https://api.openai.com/v1";
    default: return "";
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  showSettings: false,
  providers: [],
  activeProvider: "",
  editingId: null,
  models: {},
  loading: false,
  dirty: false,
  saved: false,

  open: () => {
    set({ showSettings: true });
    get().load();
  },

  close: () => {
    set({ showSettings: false, dirty: false, saved: false, editingId: null, models: {} });
  },

  load: async () => {
    set({ loading: true });
    try {
      const raw = await GetSettings();
      const s = JSON.parse(raw);
      const providers: ProviderForm[] = (s.providers || []).map((p: any) => ({
        id: p.id,
        name: p.name || "",
        type: p.type || "openrouter",
        apiKey: p.api_key || "",
        model: p.model || "",
        baseURL: p.base_url || defaultBaseURL(p.type || "openrouter"),
      }));
      set({
        providers,
        activeProvider: s.active_provider || (providers[0]?.id ?? ""),
        dirty: false,
        saved: false,
      });
    } catch { /* ignore */ }
    set({ loading: false });
  },

  save: async () => {
    const { providers, activeProvider } = get();
    set({ loading: true, saved: false });
    try {
      await SaveSettings(JSON.stringify({
        active_provider: activeProvider,
        providers: providers.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          api_key: p.apiKey,
          model: p.model,
          base_url: p.baseURL || defaultBaseURL(p.type),
        })),
      }));
      set({ dirty: false, saved: true });
      // Refresh model selector with updated providers
      useModelSelectorStore.getState().refreshProviders();
    } catch { /* ignore */ }
    set({ loading: false });
  },

  setActive: (id) => set({ activeProvider: id, dirty: true, saved: false }),

  setEditing: (id) => set({ editingId: id }),

  updateProvider: (id, field, value) => {
    const providers = get().providers.map((p) => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      if (field === "type") {
        updated.baseURL = defaultBaseURL(value);
      }
      return updated;
    });
    set({ providers, dirty: true, saved: false });
  },

  addProvider: () => {
    const id = "prov_" + genId();
    const providers = [...get().providers, {
      id,
      name: "New Provider",
      type: "compat" as string,
      apiKey: "",
      model: "",
      baseURL: "",
    }];
    set({ providers, editingId: id, dirty: true, saved: false });
  },

  removeProvider: (id) => {
    const { providers, activeProvider } = get();
    const filtered = providers.filter((p) => p.id !== id);
    let newActive = activeProvider;
    if (activeProvider === id) {
      newActive = filtered[0]?.id ?? "";
    }
    set({ providers: filtered, activeProvider: newActive, dirty: true, saved: false });
  },

  fetchModels: async (providerId) => {
    const provider = get().providers.find((p) => p.id === providerId);
    if (!provider) return;

    set((state) => ({
      models: { ...state.models, [providerId]: { list: [], loading: true, error: "" } },
    }));

    try {
      const raw = await FetchModels(provider.type, provider.baseURL, provider.apiKey);
      const data = JSON.parse(raw);
      const list = data.map((m: any) => m.id);
      set((state) => ({
        models: { ...state.models, [providerId]: { list, loading: false, error: "" } },
      }));
    } catch {
      set((state) => ({
        models: { ...state.models, [providerId]: { list: [], loading: false, error: "Failed to fetch" } },
      }));
    }
  },
}));
