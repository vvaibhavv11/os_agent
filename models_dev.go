package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// models.dev is the primary source of model metadata (context length, pricing, etc.).
// Fetched from https://models.dev/api.json and cached locally — same approach as OpenCode.
// Each provider entry has a "models" map; each model entry has limit.context for context window.

const modelsDevURL = "https://models.dev/api.json"
const modelsDevRefreshInterval = 5 * time.Minute
const modelsDevBackgroundInterval = 60 * time.Minute
const modelsDevCacheFile = "models.json"

// Map provider type names to models.dev provider IDs.
var providerToModelsDev = map[string]string{
	"openrouter":    "openrouter",
	"anthropic":     "anthropic",
	"openai":        "openai",
	"openai-codex":  "openai",
	"openai-like":   "",
	"compat":        "",
	"deepseek":      "deepseek",
	"gemini":        "google",
	"google":        "google",
	"xai":           "xai",
	"nvidia":        "nvidia",
	"groq":          "groq",
	"mistral":       "mistral",
	"togetherai":    "togetherai",
	"perplexity":    "perplexity",
	"cohere":        "cohere",
	"fireworks":     "fireworks-ai",
	"huggingface":   "huggingface",
	"novita":        "novita-ai",
	"kimi":          "kimi-for-coding",
	"moonshot":      "kimi-for-coding",
	"stepfun":       "stepfun",
	"minimax":       "minimax",
	"minimax-oauth": "minimax",
	"minimax-cn":    "minimax-cn",
	"alibaba":       "alibaba",
	"qwen-oauth":    "alibaba",
	"copilot":       "github-copilot",
	"ollama-cloud":  "ollama-cloud",
	"cloudflare":    "cloudflare",
	"replicate":     "replicate",
}

// modelsDevData wraps the registry with a local cache file, mirroring OpenCode's approach.
type modelsDevData struct {
	mu        sync.RWMutex
	providers map[string]interface{}
	path      string
	lastFetch time.Time
}

var modelsDev = newModelsDevData()

func newModelsDevData() *modelsDevData {
	d := &modelsDevData{providers: make(map[string]interface{})}
	home, err := os.UserHomeDir()
	if err != nil {
		return d
	}
	d.path = filepath.Join(home, appDir, modelsDevCacheFile)
	d.loadFromDisk()
	go d.backgroundRefresh()
	return d
}

func (d *modelsDevData) loadFromDisk() {
	if d.path == "" {
		return
	}
	data, err := os.ReadFile(d.path)
	if err != nil {
		return
	}
	var m map[string]interface{}
	if json.Unmarshal(data, &m) != nil {
		return
	}
	d.mu.Lock()
	d.providers = m
	d.mu.Unlock()
}

func (d *modelsDevData) saveToDisk() {
	if d.path == "" {
		return
	}
	d.mu.RLock()
	data, err := json.Marshal(d.providers)
	d.mu.RUnlock()
	if err != nil {
		return
	}
	os.MkdirAll(filepath.Dir(d.path), 0755)
	os.WriteFile(d.path, data, 0644)
}

func (d *modelsDevData) backgroundRefresh() {
	for {
		time.Sleep(modelsDevBackgroundInterval)
		d.fetch()
	}
}

func (d *modelsDevData) fetch() {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(modelsDevURL)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return
	}
	var m map[string]interface{}
	if json.NewDecoder(resp.Body).Decode(&m) != nil {
		return
	}
	d.mu.Lock()
	d.providers = m
	d.lastFetch = time.Now()
	d.mu.Unlock()
	d.saveToDisk()
}

// GetModelContextLength looks up context length for a model, returns 0 if unknown.
// Uses double-checked locking to avoid concurrent fetches.
func (d *modelsDevData) GetModelContextLength(providerType, modelID string) int {
	d.mu.RLock()
	stale := d.lastFetch.IsZero() || time.Since(d.lastFetch) > modelsDevRefreshInterval
	d.mu.RUnlock()

	if stale {
		d.mu.Lock()
		if d.lastFetch.IsZero() || time.Since(d.lastFetch) > modelsDevRefreshInterval {
			d.mu.Unlock()
			d.fetch()
		} else {
			d.mu.Unlock()
		}
	}

	d.mu.RLock()
	defer d.mu.RUnlock()

	mdevProviderID, ok := providerToModelsDev[providerType]
	if !ok || mdevProviderID == "" {
		return 0
	}
	providerRaw, ok := d.providers[mdevProviderID]
	if !ok {
		return 0
	}
	provider, ok := providerRaw.(map[string]interface{})
	if !ok {
		return 0
	}
	modelsRaw, ok := provider["models"]
	if !ok {
		return 0
	}
	models, ok := modelsRaw.(map[string]interface{})
	if !ok {
		return 0
	}

	if ctx := contextFromEntry(models, modelID); ctx > 0 {
		return ctx
	}

	modelLower := strings.ToLower(modelID)
	for mid, entry := range models {
		if strings.ToLower(mid) == modelLower {
			return contextFromModelEntry(entry)
		}
	}

	bareName := modelID
	if idx := strings.Index(modelID, "/"); idx >= 0 {
		bareName = modelID[idx+1:]
	} else {
		for mid, entry := range models {
			if idx := strings.Index(mid, "/"); idx >= 0 {
				if strings.ToLower(mid[idx+1:]) == modelLower {
					return contextFromModelEntry(entry)
				}
			}
		}
	}
	if bareName != modelID {
		if ctx := contextFromEntry(models, bareName); ctx > 0 {
			return ctx
		}
		bareLower := strings.ToLower(bareName)
		for mid, entry := range models {
			if strings.ToLower(mid) == bareLower {
				return contextFromModelEntry(entry)
			}
		}
	}
	return 0
}

func contextFromEntry(models map[string]interface{}, id string) int {
	entry, ok := models[id]
	if !ok {
		return 0
	}
	return contextFromModelEntry(entry)
}

func contextFromModelEntry(entry interface{}) int {
	m, ok := entry.(map[string]interface{})
	if !ok {
		return 0
	}
	limitRaw, ok := m["limit"]
	if !ok {
		return 0
	}
	limit, ok := limitRaw.(map[string]interface{})
	if !ok {
		return 0
	}
	ctxRaw, ok := limit["context"]
	if !ok {
		return 0
	}
	switch v := ctxRaw.(type) {
	case float64:
		if v > 0 {
			return int(v)
		}
	}
	return 0
}

// --- /v1/models endpoint fallback ---

func queryEndpointContextLength(providerType, baseURL, apiKey, modelID string) int {
	if baseURL == "" {
		baseURL = defaultBaseURL(providerType)
	}
	if baseURL == "" {
		return 0
	}
	req, err := http.NewRequest("GET", strings.TrimRight(baseURL, "/")+"/models", nil)
	if err != nil {
		return 0
	}
	decrypted := decrypt(apiKey)
	if decrypted != "" {
		req.Header.Set("Authorization", "Bearer "+decrypted)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()
	var result struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0
	}
	modelLower := strings.ToLower(modelID)
	for _, m := range result.Data {
		id, _ := m["id"].(string)
		if strings.ToLower(id) != modelLower {
			continue
		}
		for _, key := range []string{"context_length", "context_window", "max_model_len", "max_input_tokens", "max_total_tokens"} {
			if v, ok := m[key]; ok {
				if f, ok := v.(float64); ok && f > 0 {
					return int(f)
				}
			}
		}
		break
	}
	return 0
}

// --- Frontend-facing methods ---

// FetchModelContextLength resolves context length for a given model.
// Tiers: 1) models.dev, 2) /v1/models endpoint, 3) conservative fallback.
func (a *App) FetchModelContextLength(providerType, baseURL, apiKey, modelID string) int {
	if ctx := modelsDev.GetModelContextLength(providerType, modelID); ctx > 0 {
		return ctx
	}
	if ctx := queryEndpointContextLength(providerType, baseURL, apiKey, modelID); ctx > 0 {
		return ctx
	}
	return 65536
}

// GetModelContextLength returns context length as a string (for frontend).
func (a *App) GetModelContextLength(providerType, baseURL, apiKey, modelID string) string {
	ctx := a.FetchModelContextLength(providerType, baseURL, apiKey, modelID)
	return fmt.Sprintf("%d", ctx)
}
