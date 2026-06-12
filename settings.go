package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const settingsFileName = "settings.json"
const encKeyFileName = ".enc.key"
const encPrefix = "enc:"

func ensureEncKey() ([]byte, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(home, appDir, encKeyFileName)
	data, err := os.ReadFile(path)
	if err == nil && len(data) == 32 {
		return data, nil
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, fmt.Errorf("mkdir: %w", err)
	}
	if err := os.WriteFile(path, key, 0600); err != nil {
		return nil, fmt.Errorf("write key: %w", err)
	}
	return key, nil
}

func encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	key, err := ensureEncKey()
	if err != nil {
		return plaintext, nil // fall back to plaintext
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return plaintext, nil
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return plaintext, nil
	}
	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return plaintext, nil
	}
	ciphertext := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)
	return encPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

func decrypt(ciphertext string) string {
	if !strings.HasPrefix(ciphertext, encPrefix) {
		return ciphertext
	}
	key, err := ensureEncKey()
	if err != nil {
		return ciphertext
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return ciphertext
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return ciphertext
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(ciphertext, encPrefix))
	if err != nil {
		return ciphertext
	}
	nonceSize := aesGCM.NonceSize()
	if len(raw) < nonceSize {
		return ciphertext
	}
	nonce, ciphertextBytes := raw[:nonceSize], raw[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return ciphertext
	}
	return string(plaintext)
}

func encryptProvider(p ProviderConfig) (ProviderConfig, error) {
	enc, err := encrypt(p.APIKey)
	if err != nil {
		return p, err
	}
	p.APIKey = enc
	return p, nil
}

func decryptProvider(p ProviderConfig) ProviderConfig {
	p.APIKey = decrypt(p.APIKey)
	return p
}

func settingsPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, appDir, settingsFileName), nil
}

func loadSettingsFromFile() (*Settings, error) {
	path, err := settingsPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	// Try new format first
	var s Settings
	if err := json.Unmarshal(data, &s); err == nil && len(s.Providers) > 0 {
		// Decrypt all API keys
		for i := range s.Providers {
			s.Providers[i] = decryptProvider(s.Providers[i])
		}
		return &s, nil
	}

	// Try old flat format
	var flat struct {
		APIKey   string `json:"api_key"`
		Model    string `json:"model"`
		Provider string `json:"provider"`
	}
	if err := json.Unmarshal(data, &flat); err == nil && flat.Provider != "" {
		provType := flat.Provider
		model := flat.Model
		if model == "" {
			model = "openrouter/owl-alpha"
		}
		apiKey := decrypt(flat.APIKey)
		baseURL := defaultBaseURL(provType)
		id := provType
		s = Settings{
			ActiveProvider: id,
			Providers: []ProviderConfig{
				{ID: id, Name: providerDisplayName(provType), Type: provType, APIKey: apiKey, Model: model, BaseURL: baseURL},
			},
		}
		return &s, nil
	}

	return nil, fmt.Errorf("no settings found")
}

func saveSettingsToFile(s *Settings) error {
	// Encrypt all API keys before saving
	encrypted := *s
	encrypted.Providers = make([]ProviderConfig, len(s.Providers))
	for i, p := range s.Providers {
		enc, err := encryptProvider(p)
		if err != nil {
			return err
		}
		encrypted.Providers[i] = enc
	}

	path, err := settingsPath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(encrypted, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func defaultBaseURL(provType string) string {
	switch provType {
	case "openrouter":
		return "https://openrouter.ai/api/v1"
	case "openai":
		return "https://api.openai.com/v1"
	default:
		return ""
	}
}

func providerDisplayName(provType string) string {
	switch provType {
	case "openrouter":
		return "OpenRouter"
	case "openai":
		return "OpenAI"
	case "compat":
		return "OpenAI Compatible"
	default:
		return provType
	}
}

func (a *App) GetSettings() string {
	s, err := loadSettingsFromFile()
	if err != nil || s == nil {
		// Return defaults when no settings file exists
		providerName := os.Getenv("AI_PROVIDER")
		if providerName == "" {
			providerName = "openrouter"
		}
		model := os.Getenv("OPENROUTER_MODEL")
		if model == "" {
			model = "openrouter/owl-alpha"
		}
		apiKey := os.Getenv("OPENROUTER_API_KEY")
		s = &Settings{
			ActiveProvider: providerName,
			Providers: []ProviderConfig{
				{
					ID:      providerName,
					Name:    providerDisplayName(providerName),
					Type:    providerName,
					APIKey:  apiKey,
					Model:   model,
					BaseURL: defaultBaseURL(providerName),
				},
			},
		}
	}
	data, _ := json.Marshal(s)
	return string(data)
}

func (a *App) SaveSettings(settingsJSON string) error {
	var s Settings
	if err := json.Unmarshal([]byte(settingsJSON), &s); err != nil {
		return err
	}

	if err := saveSettingsToFile(&s); err != nil {
		return err
	}

	// Apply active provider to env vars
	for _, p := range s.Providers {
		if p.ID == s.ActiveProvider {
			os.Setenv("OPENROUTER_API_KEY", p.APIKey)
			os.Setenv("OPENROUTER_MODEL", p.Model)
			os.Setenv("AI_PROVIDER", p.Type)
			break
		}
	}

	// Reset cached provider so getProvider() re-reads settings
	activeProvider = nil

	return nil
}

func (a *App) FetchModels(providerType, baseURL, apiKey string) string {
	if baseURL == "" {
		baseURL = defaultBaseURL(providerType)
	}
	if baseURL == "" {
		return "[]"
	}
	req, err := http.NewRequest("GET", strings.TrimRight(baseURL, "/")+"/models", nil)
	if err != nil {
		return "[]"
	}
	decrypted := decrypt(apiKey)
	if decrypted != "" {
		req.Header.Set("Authorization", "Bearer "+decrypted)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "[]"
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "[]"
	}

	models := make([]ModelInfo, 0, len(result.Data))
	for _, m := range result.Data {
		models = append(models, ModelInfo{ID: m.ID, Name: m.ID})
	}
	data, _ := json.Marshal(models)
	return string(data)
}
