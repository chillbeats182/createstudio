package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ====================================================================
//  Constants
// ====================================================================

const (
	BaseURL    = "https://www.oreateai.com"
	GCSBase    = "https://storage.googleapis.com"
	UserAgent  = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
	ProjectID  = "iron-area-433903-r2"
)

// ====================================================================
//  Data Types
// ====================================================================

// CookieEntry represents a browser cookie
type CookieEntry struct {
	Domain          string  `json:"domain"`
	Name            string  `json:"name"`
	Value           string  `json:"value"`
	Path            string  `json:"path"`
	HttpOnly        bool    `json:"httpOnly"`
	Secure          bool    `json:"secure"`
	ExpirationDate  float64 `json:"expirationDate,omitempty"`
}

// UserInfo holds user account info
type UserInfo struct {
	Avatar     string `json:"avatar"`
	Email      string `json:"email"`
	IsLogin    bool   `json:"isLogin"`
	Way        int    `json:"way"`
	CreateTime int64  `json:"createTime"`
	IsNewUser  bool   `json:"isNewUser"`
}

// VipInfo holds VIP subscription info
type VipInfo struct {
	Etime               int64 `json:"etime"`
	HasContractPay      bool  `json:"hasContractPay"`
	HasEverBoughtExpCard bool `json:"hasEverBoughtExpCard"`
	Stime               int64 `json:"stime"`
	VipType             int   `json:"vipType"`
}

// AuthResult combines user info, VIP info and credits
type AuthResult struct {
	UserInfo  UserInfo `json:"userInfo"`
	VipInfo   VipInfo  `json:"vipInfo"`
	RestPoint int      `json:"restPoint"`
	Error     string   `json:"error,omitempty"`
}

// PointCost represents credit cost for a model configuration
type PointCost struct {
	Audio       bool   `json:"audio,omitempty"`
	Duration    int    `json:"duration,omitempty"`
	MotDuration int    `json:"motDuration,omitempty"`
	Point       int    `json:"point"`
	Resolution  string `json:"resolution"`
	AiType      int    `json:"aiType"`
}

// VideoSizeOption represents a video aspect ratio option
type VideoSizeOption struct {
	Icon  string `json:"icon"`
	Ratio string `json:"ratio"`
}

// DurationOption represents a duration choice
type DurationOption struct {
	Icon  string `json:"icon"`
	Value int    `json:"value"`
}

// ModelConfig represents a single model's configuration
type ModelConfig struct {
	Duration           []DurationOption  `json:"duration"`
	ModelIcon          string            `json:"modelIcon"`
	ModelName          string            `json:"modelName"`
	Description        map[string]string `json:"description"`
	PointCostImage     []PointCost       `json:"pointCostImage"`
	PointCostMotion    []PointCost       `json:"pointCostMotion"`
	PointCostReference []PointCost       `json:"pointCostReference"`
	SupportAudio       bool              `json:"supportAudio"`
	SupportModifySize  bool              `json:"supportModifySize"`
	VideoResolution    []string          `json:"videoResolution"`
	VideoSize          []VideoSizeOption `json:"videoSize"`
}

// SceneModel represents a model within a scene's factory
type SceneModel struct {
	ModelName   string `json:"modelName"`
	Restrictions string `json:"restrictions"`
}

// SceneFactory represents a model factory for a scene
type SceneFactory struct {
	ModelFactoryName string       `json:"modelFactoryName"`
	ModelIcon        string       `json:"modelIcon"`
	Models           []SceneModel `json:"models"`
}

// Scene represents a generation scene
type Scene struct {
	SceneID     string                 `json:"sceneId"`
	SceneName   map[string]string      `json:"sceneName"`
	SceneIcon   string                 `json:"sceneIcon"`
	Description map[string]string      `json:"description"`
	Factory     []SceneFactory         `json:"factory"`
}

// ModelsResult holds model and scene configs
type ModelsResult struct {
	Models []ModelConfig `json:"models"`
	Scenes []Scene       `json:"scenes"`
	Error  string        `json:"error,omitempty"`
}

// UploadFileMeta is the metadata for a file to upload
type UploadFileMeta struct {
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	FileExt  string `json:"fileExt"`
	FileName string `json:"fileName"`
}

// UploadCredential holds GCS upload info for one file.
// Uses custom UnmarshalJSON to handle both "sessionkey" and "sessionKey" casing.
type UploadCredential struct {
	Bucket     string `json:"bucket"`
	ObjectPath string `json:"objectPath"`
	SessionKey string `json:"-"`
}

// UnmarshalJSON handles both "sessionkey" and "sessionKey" JSON field names
func (uc *UploadCredential) UnmarshalJSON(data []byte) error {
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	uc.Bucket, _ = raw["bucket"].(string)
	uc.ObjectPath, _ = raw["objectPath"].(string)
	// Try both casings: sessionkey (lowercase k) and sessionKey (camelCase k)
	if v, ok := raw["sessionkey"].(string); ok && v != "" {
		uc.SessionKey = v
	}
	if uc.SessionKey == "" {
		if v, ok := raw["sessionKey"].(string); ok {
			uc.SessionKey = v
		}
	}
	// Also try accessToken / access_token as fallback
	if uc.SessionKey == "" {
		if v, ok := raw["accessToken"].(string); ok {
			uc.SessionKey = v
		}
	}
	return nil
}

// UploadTokenResult holds the upload token response
type UploadTokenResult struct {
	KeyList map[string]UploadCredential `json:"KeyList"`
	Error   string                      `json:"error,omitempty"`
}

// Attachment represents a file attachment in generation request
type Attachment struct {
	BosURL     string `json:"bos_url"`
	FileName   string `json:"fileName"`
	FileExt    string `json:"fileExt"`
	Size       int64  `json:"size"`
	DocTitle   string `json:"doc_title"`
	DocType    string `json:"doc_type"`
	OriginSize int64  `json:"originSize"`
}

// VideoConfig holds the video generation configuration
type VideoConfig struct {
	SceneID    string `json:"sceneId"`
	ModelName  string `json:"modelName"`
	Duration   int    `json:"duration"`
	Resolution string `json:"resolution"`
	VideoSize  string `json:"videoSize"`
	AiType     int    `json:"aiType"`
}

// MotionConfig holds motion-specific configuration
type MotionConfig struct {
	CharacterImage    string `json:"characterImage"`
	MotionVideo       string `json:"motionVideo"`
	MotDuration       string `json:"motDuration"`
	KeepOriginalSound bool   `json:"keepOriginalSound"`
}

// GenerateRequest is the full generation payload
type GenerateRequest struct {
	Mode        string        `json:"mode"`
	Query       string        `json:"query"`
	Attachments []Attachment  `json:"attachments"`
	Motion      *MotionConfig `json:"motion,omitempty"`
	HtmlTplID   string        `json:"htmlTplId"`
	VideoConfig VideoConfig   `json:"videoConfig"`
}

// GenerateResult holds the generation response
type GenerateResult struct {
	Success      bool                   `json:"success"`
	DocID        string                 `json:"docId"`
	SubmitResult map[string]interface{} `json:"submitResult"`
	Error        string                 `json:"error,omitempty"`
}

// TaskStatusResult holds task polling result
type TaskStatusResult struct {
	Status map[string]interface{} `json:"status"`
	Data   map[string]interface{} `json:"data"`
	Error  string                 `json:"error,omitempty"`
}

// HistoryItem represents a single history entry
type HistoryItem struct {
	DocID        string `json:"docId"`
	ChatID       string `json:"chatId"`
	Title        string `json:"title"`
	CreateTime   int64  `json:"createTime"`
	Status       int    `json:"status"`
	VideoURL     string `json:"videoUrl,omitempty"`
	ThumbnailURL string `json:"thumbnailUrl,omitempty"`
	Prompt       string `json:"prompt,omitempty"`
	ModelName    string `json:"modelName,omitempty"`
}

// HistoryResult holds the history response
type HistoryResult struct {
	Items []HistoryItem `json:"items"`
	Total int           `json:"total"`
	Error string        `json:"error,omitempty"`
}

// ====================================================================
//  API Response envelope
// ====================================================================

type apiStatus struct {
	Code   int    `json:"code"`
	Msg    string `json:"msg"`
	ErrMsg string `json:"errMsg"`
}

type apiResponse struct {
	Status apiStatus       `json:"status"`
	Data   json.RawMessage `json:"data"`
}

type authData struct {
	BasicInfo UserInfo `json:"basicInfo"`
	VipInfo  VipInfo  `json:"vipInfo"`
}

type pointsData struct {
	RestPoint int `json:"restPoint"`
}

type modelsData struct {
	Models []ModelConfig `json:"models"`
}

type scenesData struct {
	Scenes []Scene `json:"scenes"`
}

type uploadTokenData struct {
	KeyList map[string]json.RawMessage `json:"KeyList"`
}

type historyListData struct {
	ChatList []struct {
		DocID        string                 `json:"docId"`
		ChatID       string                 `json:"chatId"`
		Title        string                 `json:"title"`
		CreateTime   int64                  `json:"createTime"`
		Status       int                    `json:"status"`
		VideoURL     string                 `json:"videoUrl"`
		ThumbnailURL string                 `json:"thumbnailUrl"`
		Prompt       string                 `json:"prompt"`
		ModelName    string                 `json:"modelName"`
		DocType      int                    `json:"docType"`
		Extra        map[string]interface{} `json:"extra"`
	} `json:"chatList"`
	Total int `json:"total"`
}

// ====================================================================
//  OreateAIClient — all API communication
// ====================================================================

// OreateAIClient handles all communication with OreateAI.com
type OreateAIClient struct {
	httpClient *http.Client
	cookieStr  string
}

// NewOreateAIClient creates a new client
func NewOreateAIClient() *OreateAIClient {
	return &OreateAIClient{
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// setCookie parses cookie JSON and sets the cookie string
func (c *OreateAIClient) setCookie(cookieJSON string) error {
	cookies, err := parseCookies(cookieJSON)
	if err != nil {
		return fmt.Errorf("invalid cookie format: %w", err)
	}
	if len(cookies) == 0 {
		return fmt.Errorf("no cookies found in input")
	}
	c.cookieStr = buildCookieHeader(cookies)
	return nil
}

// newRequest creates a new HTTP request with standard headers
func (c *OreateAIClient) newRequest(method, path string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequest(method, BaseURL+path, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", UserAgent)
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Referer", "https://www.oreateai.com/home/vertical/aiVideo")
	req.Header.Set("Origin", "https://www.oreateai.com")
	req.Header.Set("Sec-Fetch-Dest", "empty")
	req.Header.Set("Sec-Fetch-Mode", "cors")
	req.Header.Set("Sec-Fetch-Site", "same-origin")

	if c.cookieStr != "" {
		req.Header.Set("Cookie", c.cookieStr)
	}

	return req, nil
}

// doJSON performs a request and decodes the JSON response
func (c *OreateAIClient) doJSON(req *http.Request) (*apiResponse, error) {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body failed: %w", err)
	}

	fmt.Printf("[API] %s %s → %d (%d bytes)\n", req.Method, req.URL.Path, resp.StatusCode, len(body))

	var apiResp apiResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("invalid JSON response: %w", err)
	}

	if apiResp.Status.Code != 0 {
		fmt.Printf("[API] Error response: code=%d msg=%s errMsg=%s\n",
			apiResp.Status.Code, apiResp.Status.Msg, apiResp.Status.ErrMsg)
	}

	return &apiResp, nil
}

// ====================================================================
//  Cookie Parsing
// ====================================================================

func parseCookies(input string) ([]CookieEntry, error) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return nil, fmt.Errorf("empty input")
	}

	// Try JSON array
	var cookies []CookieEntry
	if err := json.Unmarshal([]byte(trimmed), &cookies); err == nil && len(cookies) > 0 {
		return cookies, nil
	}

	// Try semicolon-separated string
	if strings.Contains(trimmed, ";") {
		parts := strings.Split(trimmed, ";")
		for _, part := range parts {
			part = strings.TrimSpace(part)
			eqIdx := strings.Index(part, "=")
			if eqIdx == -1 {
				continue
			}
			name := strings.TrimSpace(part[:eqIdx])
			value := strings.TrimSpace(part[eqIdx+1:])
			if name == "" {
				continue
			}
			cookies = append(cookies, CookieEntry{
				Domain: ".oreateai.com",
				Name:   name,
				Value:  value,
				Path:   "/",
			})
		}
		if len(cookies) > 0 {
			return cookies, nil
		}
	}

	return nil, fmt.Errorf("could not parse cookies from input")
}

func buildCookieHeader(cookies []CookieEntry) string {
	parts := make([]string, len(cookies))
	for i, c := range cookies {
		parts[i] = c.Name + "=" + c.Value
	}
	return strings.Join(parts, "; ")
}

// ====================================================================
//  Public Methods — called from frontend via Wails bindings
// ====================================================================

// Authenticate validates the cookie and returns user info + credits
func (a *App) Authenticate(cookieJSON string) AuthResult {
	if err := a.apiClient.setCookie(cookieJSON); err != nil {
		return AuthResult{Error: err.Error()}
	}
	a.cookieJSON = cookieJSON

	// Fetch user info
	userReq, _ := a.apiClient.newRequest("GET", "/oreate/user/getuserinfo", nil)
	userResp, err := a.apiClient.doJSON(userReq)
	if err != nil {
		return AuthResult{Error: fmt.Sprintf("user info request failed: %v", err)}
	}
	if userResp.Status.Code != 0 {
		return AuthResult{Error: fmt.Sprintf("auth failed: %s", userResp.Status.Msg)}
	}

	var userAuthData authData
	if err := json.Unmarshal(userResp.Data, &userAuthData); err != nil {
		return AuthResult{Error: fmt.Sprintf("parse user data failed: %v", err)}
	}

	fmt.Printf("[Auth] User: %s, IsLogin: %v\n", userAuthData.BasicInfo.Email, userAuthData.BasicInfo.IsLogin)

	// Fetch credits
	pointsReq, _ := a.apiClient.newRequest("GET", "/bizapi/point/getrestpoints", nil)
	pointsResp, err := a.apiClient.doJSON(pointsReq)
	if err != nil {
		return AuthResult{
			UserInfo:  userAuthData.BasicInfo,
			VipInfo:   userAuthData.VipInfo,
			RestPoint: 0,
		}
	}

	var pts pointsData
	restPoint := 0
	if json.Unmarshal(pointsResp.Data, &pts) == nil {
		restPoint = pts.RestPoint
	}

	fmt.Printf("[Auth] Credits: %d\n", restPoint)

	return AuthResult{
		UserInfo:  userAuthData.BasicInfo,
		VipInfo:   userAuthData.VipInfo,
		RestPoint: restPoint,
	}
}

// GetModels fetches model and scene configurations
func (a *App) GetModels() ModelsResult {
	modelReq, _ := a.apiClient.newRequest("GET", "/oreate/aivideo/getmodelconfigv3", nil)
	modelResp, err := a.apiClient.doJSON(modelReq)
	if err != nil {
		return ModelsResult{Error: err.Error()}
	}

	var modelData modelsData
	if err := json.Unmarshal(modelResp.Data, &modelData); err != nil {
		return ModelsResult{Error: fmt.Sprintf("parse models failed: %v", err)}
	}

	sceneReq, _ := a.apiClient.newRequest("GET", "/oreate/aivideo/getsceneconfig", nil)
	sceneResp, err := a.apiClient.doJSON(sceneReq)
	if err != nil {
		return ModelsResult{Models: modelData.Models, Error: fmt.Sprintf("scenes fetch failed: %v", err)}
	}

	var sceneData scenesData
	if err := json.Unmarshal(sceneResp.Data, &sceneData); err != nil {
		return ModelsResult{Models: modelData.Models, Error: fmt.Sprintf("parse scenes failed: %v", err)}
	}

	fmt.Printf("[Models] %d models, %d scenes loaded\n", len(modelData.Models), len(sceneData.Scenes))

	return ModelsResult{
		Models: modelData.Models,
		Scenes: sceneData.Scenes,
	}
}

// GetUploadToken gets GCS upload credentials for the given files
func (a *App) GetUploadToken(fileMetasJSON string) UploadTokenResult {
	var fileMetas []UploadFileMeta
	if err := json.Unmarshal([]byte(fileMetasJSON), &fileMetas); err != nil {
		return UploadTokenResult{Error: fmt.Sprintf("invalid file metas: %v", err)}
	}

	payload := map[string]interface{}{
		"mFileList": fileMetas,
	}
	body, _ := json.Marshal(payload)

	fmt.Printf("[UploadToken] Requesting for %d files: %v\n", len(fileMetas), fileMetas)

	req, _ := a.apiClient.newRequest("POST", "/oreate/convert/getuploadbostoken", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.apiClient.doJSON(req)
	if err != nil {
		return UploadTokenResult{Error: err.Error()}
	}
	if resp.Status.Code != 0 {
		return UploadTokenResult{Error: fmt.Sprintf("upload token error: %s (code %d)", resp.Status.Msg, resp.Status.Code)}
	}

	// Parse KeyList with flexible credential deserialization
	var rawData uploadTokenData
	if err := json.Unmarshal(resp.Data, &rawData); err != nil {
		return UploadTokenResult{Error: fmt.Sprintf("parse upload token failed: %v", err)}
	}

	keyList := make(map[string]UploadCredential)
	for k, v := range rawData.KeyList {
		var cred UploadCredential
		if err := json.Unmarshal(v, &cred); err != nil {
			fmt.Printf("[UploadToken] WARNING: failed to parse credential for key %q: %v\n", k, err)
			continue
		}
		if cred.SessionKey == "" {
			fmt.Printf("[UploadToken] WARNING: empty sessionKey for key %q (bucket=%s, path=%s)\n", k, cred.Bucket, cred.ObjectPath)
		}
		keyList[k] = cred
		fmt.Printf("[UploadToken] Key %q → bucket=%s path=%s sessionKey=%s...\n",
			k, cred.Bucket, cred.ObjectPath, truncateStr(cred.SessionKey, 20))
	}

	return UploadTokenResult{KeyList: keyList}
}

// UploadFile uploads a local file to GCS using resumable upload
func (a *App) UploadFile(filePath, bucket, objectPath, sessionKey string) (string, error) {
	if sessionKey == "" {
		return "", fmt.Errorf("empty sessionKey — cannot authenticate GCS upload")
	}

	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("cannot open file: %w", err)
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return "", fmt.Errorf("cannot stat file: %w", err)
	}
	fileSize := stat.Size()

	// Determine content type
	ext := strings.ToLower(filepath.Ext(filePath))
	contentType := "application/octet-stream"
	switch ext {
	case ".png":
		contentType = "image/png"
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".webp":
		contentType = "image/webp"
	case ".gif":
		contentType = "image/gif"
	case ".mp4":
		contentType = "video/mp4"
	case ".mov":
		contentType = "video/quicktime"
	case ".avi":
		contentType = "video/x-msvideo"
	case ".webm":
		contentType = "video/webm"
	}

	encodedPath := url.PathEscape(objectPath)
	uploadURL := fmt.Sprintf("%s/upload/storage/v1/b/%s/o?uploadType=resumable&name=%s", GCSBase, bucket, encodedPath)

	fmt.Printf("[GCS] Initiating upload: %s (%d bytes, %s)\n", filepath.Base(filePath), fileSize, contentType)

	// Step 1: Initiate resumable upload
	initReq, _ := http.NewRequest("POST", uploadURL, nil)
	initReq.Header.Set("Authorization", "Bearer "+sessionKey)
	initReq.Header.Set("Content-Type", "application/json")
	initReq.Header.Set("Content-Length", "0")
	initReq.Header.Set("x-goog-user-project", ProjectID)

	initResp, err := a.apiClient.httpClient.Do(initReq)
	if err != nil {
		return "", fmt.Errorf("GCS init failed: %w", err)
	}
	initResp.Body.Close()

	fmt.Printf("[GCS] Init response: %d\n", initResp.StatusCode)

	if initResp.StatusCode != 200 && initResp.StatusCode != 201 {
		return "", fmt.Errorf("GCS init returned status %d — check sessionKey validity", initResp.StatusCode)
	}

	location := initResp.Header.Get("Location")
	if location == "" {
		return "", fmt.Errorf("GCS init returned no Location header")
	}

	// Step 2: Upload file data
	buf := new(bytes.Buffer)
	buf.ReadFrom(file)
	fileData := buf.Bytes()

	putReq, _ := http.NewRequest("PUT", location, bytes.NewReader(fileData))
	putReq.Header.Set("Content-Range", fmt.Sprintf("bytes 0-%d/%d", fileSize-1, fileSize))
	putReq.Header.Set("Authorization", "Bearer "+sessionKey)
	putReq.Header.Set("x-goog-user-project", ProjectID)
	putReq.Header.Set("Content-Type", contentType)

	uploadResp, err := a.apiClient.httpClient.Do(putReq)
	if err != nil {
		return "", fmt.Errorf("GCS upload failed: %w", err)
	}
	defer uploadResp.Body.Close()

	fmt.Printf("[GCS] Upload response: %d\n", uploadResp.StatusCode)

	if uploadResp.StatusCode == 200 || uploadResp.StatusCode == 201 {
		finalURL := fmt.Sprintf("https://storage.googleapis.com/%s/%s", bucket, objectPath)
		fmt.Printf("[GCS] Upload success: %s\n", finalURL)
		return finalURL, nil
	}

	body, _ := io.ReadAll(uploadResp.Body)
	return "", fmt.Errorf("GCS upload returned status %d: %s", uploadResp.StatusCode, string(body))
}

// SubmitGeneration submits a video generation task via SSE endpoint
func (a *App) SubmitGeneration(requestJSON string) GenerateResult {
	var req GenerateRequest
	if err := json.Unmarshal([]byte(requestJSON), &req); err != nil {
		return GenerateResult{Error: fmt.Sprintf("invalid request: %v", err)}
	}

	body, _ := json.Marshal(req)

	fmt.Printf("[Generate] Submitting: mode=%s scene=%s model=%s duration=%d res=%s size=%s aiType=%d attachments=%d\n",
		req.Mode, req.VideoConfig.SceneID, req.VideoConfig.ModelName,
		req.VideoConfig.Duration, req.VideoConfig.Resolution, req.VideoConfig.VideoSize,
		req.VideoConfig.AiType, len(req.Attachments))

	httpReq, _ := a.apiClient.newRequest("POST", "/oreate/create/chat", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := a.apiClient.httpClient.Do(httpReq)
	if err != nil {
		return GenerateResult{Error: fmt.Sprintf("request failed: %v", err)}
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	bodyStr := string(respBody)

	fmt.Printf("[Generate] Response: %d bytes\n", len(bodyStr))

	// Parse SSE data lines — collect ALL events
	type sseEvent struct {
		raw    string
		parsed map[string]interface{}
	}

	var events []sseEvent
	for _, line := range strings.Split(bodyStr, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimPrefix(line, "data:")
		data = strings.TrimSpace(data)
		if data == "" || data == "[DONE]" {
			continue
		}

		var parsed map[string]interface{}
		if err := json.Unmarshal([]byte(data), &parsed); err == nil {
			events = append(events, sseEvent{raw: data, parsed: parsed})
			fmt.Printf("[Generate] SSE event: status=%v\n", parsed["status"])
		}
	}

	if len(events) == 0 {
		// No SSE events found — try direct JSON
		var result map[string]interface{}
		if err := json.Unmarshal(respBody, &result); err != nil {
			preview := bodyStr
			if len(preview) > 300 {
				preview = preview[:300] + "..."
			}
			return GenerateResult{Error: fmt.Sprintf("invalid response: %s", preview)}
		}
		events = append(events, sseEvent{parsed: result})
	}

	// Find the event with docId — prefer events with status.code == 0
	var bestEvent *sseEvent
	for i := range events {
		ev := &events[i]
		// Check for error status
		if status, ok := ev.parsed["status"].(map[string]interface{}); ok {
			code, _ := status["code"].(float64)
			msg, _ := status["msg"].(string)
			if code != 0 && code != 1 {
				// Real error (not processing)
				return GenerateResult{
					SubmitResult: ev.parsed,
					Error:        fmt.Sprintf("generation error (code %d): %s", int(code), msg),
				}
			}
		}
		// Check if this event has a docId in data
		if d, ok := ev.parsed["data"].(map[string]interface{}); ok {
			if _, hasDocId := d["docId"]; hasDocId {
				bestEvent = ev
				break // Found it
			}
			if _, hasDocId := d["docID"]; hasDocId {
				bestEvent = ev
				break
			}
		}
		// Fall back to first event with status.code == 0
		if bestEvent == nil {
			if status, ok := ev.parsed["status"].(map[string]interface{}); ok {
				if code, _ := status["code"].(float64); code == 0 {
					bestEvent = ev
				}
			}
		}
	}

	if bestEvent == nil {
		bestEvent = &events[0] // Use first event as fallback
	}

	// Extract docId from the best event
	docID := ""
	if data, ok := bestEvent.parsed["data"].(map[string]interface{}); ok {
		if id, ok := data["docId"].(string); ok {
			docID = id
		} else if id, ok := data["docID"].(string); ok {
			docID = id
		} else if id, ok := data["taskId"].(string); ok {
			docID = id
		} else if id, ok := data["chatId"].(string); ok {
			docID = id
		}
	}

	if docID == "" {
		fmt.Printf("[Generate] WARNING: No docId found in response\n")
		pretty, _ := json.MarshalIndent(bestEvent.parsed, "", "  ")
		fmt.Printf("[Generate] Response data:\n%s\n", string(pretty))
	}

	fmt.Printf("[Generate] docId=%s\n", docID)

	return GenerateResult{
		Success:      true,
		DocID:        docID,
		SubmitResult: bestEvent.parsed,
	}
}

// GetTaskStatus polls the status of a generation task
func (a *App) GetTaskStatus(docID string) TaskStatusResult {
	req, _ := a.apiClient.newRequest("GET", "/oreate/doc/getstatus?docIdList="+url.QueryEscape(docID), nil)

	resp, err := a.apiClient.doJSON(req)
	if err != nil {
		return TaskStatusResult{Error: err.Error()}
	}

	var data map[string]interface{}
	json.Unmarshal(resp.Data, &data)

	fmt.Printf("[Status] docId=%s status_code=%d\n", docID, resp.Status.Code)

	return TaskStatusResult{
		Status: map[string]interface{}{"code": resp.Status.Code, "msg": resp.Status.Msg},
		Data:   data,
	}
}

// GetHistory fetches the generation history
func (a *App) GetHistory(pageNo, pageSize int) HistoryResult {
	urlPath := fmt.Sprintf("/oreate/memory/getchatlist?pageNo=%d&pageSize=%d&chatType=aiVideo", pageNo, pageSize)
	req, _ := a.apiClient.newRequest("GET", urlPath, nil)

	resp, err := a.apiClient.doJSON(req)
	if err != nil {
		return HistoryResult{Error: err.Error()}
	}

	var data historyListData
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		return HistoryResult{Error: fmt.Sprintf("parse history failed: %v", err)}
	}

	items := make([]HistoryItem, 0, len(data.ChatList))
	for _, c := range data.ChatList {
		items = append(items, HistoryItem{
			DocID:        c.DocID,
			ChatID:       c.ChatID,
			Title:        c.Title,
			CreateTime:   c.CreateTime,
			Status:       c.Status,
			VideoURL:     c.VideoURL,
			ThumbnailURL: c.ThumbnailURL,
			Prompt:       c.Prompt,
			ModelName:    c.ModelName,
		})
	}

	return HistoryResult{
		Items: items,
		Total: data.Total,
	}
}

// GenerateVideo is the all-in-one convenience method: upload + submit
func (a *App) GenerateVideo(imagePath, videoPath, prompt, sceneID, modelName string, duration int, resolution, videoSize string, aiType int, motDuration string, keepOriginalSound bool) GenerateResult {
	fmt.Printf("=== GenerateVideo START ===\n")
	fmt.Printf("[Gen] imagePath=%q videoPath=%q\n", imagePath, videoPath)
	fmt.Printf("[Gen] scene=%s model=%s duration=%d res=%s size=%s aiType=%d\n",
		sceneID, modelName, duration, resolution, videoSize, aiType)

	// Build file list
	var fileMetas []UploadFileMeta

	if imagePath != "" {
		ext := strings.TrimPrefix(filepath.Ext(imagePath), ".")
		name := filepath.Base(imagePath)
		meta := UploadFileMeta{
			Name:     name,
			FileExt:  ext,
			FileName: strings.TrimSuffix(name, "."+ext),
		}
		if stat, err := os.Stat(imagePath); err == nil {
			meta.Size = stat.Size()
		}
		fileMetas = append(fileMetas, meta)
		fmt.Printf("[Gen] Image meta: %+v\n", meta)
	}

	if videoPath != "" {
		ext := strings.TrimPrefix(filepath.Ext(videoPath), ".")
		name := filepath.Base(videoPath)
		meta := UploadFileMeta{
			Name:     name,
			FileExt:  ext,
			FileName: strings.TrimSuffix(name, "."+ext),
		}
		if stat, err := os.Stat(videoPath); err == nil {
			meta.Size = stat.Size()
		}
		fileMetas = append(fileMetas, meta)
		fmt.Printf("[Gen] Video meta: %+v\n", meta)
	}

	// Get upload credentials (skip if no files)
	var tokenResult UploadTokenResult
	if len(fileMetas) > 0 {
		metasJSON, _ := json.Marshal(fileMetas)
		tokenResult = a.GetUploadToken(string(metasJSON))
		if tokenResult.Error != "" {
			return GenerateResult{Error: fmt.Sprintf("get upload token failed: %s", tokenResult.Error)}
		}
		fmt.Printf("[Gen] Got %d upload credentials\n", len(tokenResult.KeyList))
	}

	// Upload files and track URLs
	type fileInfo struct {
		path    string
		ext     string
		name    string
		nameNoExt string
		url     string
	}
	var uploadedFiles []fileInfo

	if imagePath != "" {
		uploadedFiles = append(uploadedFiles, fileInfo{
			path:      imagePath,
			ext:       strings.TrimPrefix(filepath.Ext(imagePath), "."),
			name:      filepath.Base(imagePath),
			nameNoExt: strings.TrimSuffix(filepath.Base(imagePath), filepath.Ext(imagePath)),
		})
	}
	if videoPath != "" {
		uploadedFiles = append(uploadedFiles, fileInfo{
			path:      videoPath,
			ext:       strings.TrimPrefix(filepath.Ext(videoPath), "."),
			name:      filepath.Base(videoPath),
			nameNoExt: strings.TrimSuffix(filepath.Base(videoPath), filepath.Ext(videoPath)),
		})
	}

	for i, fi := range uploadedFiles {
		// Find matching credential — try multiple key formats
		var cred *UploadCredential
		var matchedKey string

		for key, c := range tokenResult.KeyList {
			// Try exact filename match (with extension)
			if key == fi.name {
				cred = &c
				matchedKey = key
				break
			}
			// Try filename without extension
			if key == fi.nameNoExt {
				cred = &c
				matchedKey = key
				break
			}
			// Try case-insensitive match
			if strings.EqualFold(key, fi.name) || strings.EqualFold(key, fi.nameNoExt) {
				cred = &c
				matchedKey = key
				break
			}
		}

		if cred == nil && len(tokenResult.KeyList) > 0 {
			// Last resort: if there's only one credential, use it
			if len(tokenResult.KeyList) == 1 {
				for k, c := range tokenResult.KeyList {
					cred = &c
					matchedKey = k
					break
				}
				fmt.Printf("[Gen] WARNING: No exact key match for %q, using only available credential\n", fi.name)
			} else {
				// Try matching by index position
				keys := make([]string, 0, len(tokenResult.KeyList))
				for k := range tokenResult.KeyList {
					keys = append(keys, k)
				}
				if i < len(keys) {
					cred = &tokenResult.KeyList[keys[i]]
					matchedKey = keys[i]
					fmt.Printf("[Gen] WARNING: No exact key match for %q, using key at index %d: %q\n", fi.name, i, matchedKey)
				}
			}
		}

		if cred == nil {
			return GenerateResult{Error: fmt.Sprintf("no upload credential found for file: %s (available keys: %v)",
				fi.name, mapKeys(tokenResult.KeyList))}
		}

		fmt.Printf("[Gen] Uploading %s with credential key=%q\n", fi.name, matchedKey)

		uploadURL, err := a.UploadFile(fi.path, cred.Bucket, cred.ObjectPath, cred.SessionKey)
		if err != nil {
			return GenerateResult{Error: fmt.Sprintf("upload %s failed: %v", fi.name, err)}
		}
		uploadedFiles[i].url = uploadURL
	}

	// Build attachments
	var attachments []Attachment
	characterURL := ""
	motionURL := ""

	// For motion scene, video goes first, then image
	if sceneID == "motion" {
		for _, fi := range uploadedFiles {
			if fi.ext == "mp4" || fi.ext == "mov" || fi.ext == "avi" || fi.ext == "webm" {
				motionURL = fi.url
				stat, _ := os.Stat(fi.path)
				attachments = append(attachments, Attachment{
					BosURL:     motionURL,
					FileName:   fi.name,
					FileExt:    fi.ext,
					Size:       stat.Size(),
					DocTitle:   fi.name,
					DocType:    fi.ext,
					OriginSize: stat.Size(),
				})
			}
		}
		for _, fi := range uploadedFiles {
			if fi.ext == "png" || fi.ext == "jpg" || fi.ext == "jpeg" || fi.ext == "webp" || fi.ext == "gif" {
				characterURL = fi.url
				stat, _ := os.Stat(fi.path)
				attachments = append(attachments, Attachment{
					BosURL:     characterURL,
					FileName:   fi.name,
					FileExt:    fi.ext,
					Size:       stat.Size(),
					DocTitle:   fi.name,
					DocType:    fi.ext,
					OriginSize: stat.Size(),
				})
			}
		}
	} else {
		// For other scenes (text_or_image, reference), image goes first
		for _, fi := range uploadedFiles {
			isImage := fi.ext == "png" || fi.ext == "jpg" || fi.ext == "jpeg" || fi.ext == "webp" || fi.ext == "gif"
			if isImage {
				characterURL = fi.url
			}
			stat, _ := os.Stat(fi.path)
			attachments = append(attachments, Attachment{
				BosURL:     fi.url,
				FileName:   fi.name,
				FileExt:    fi.ext,
				Size:       stat.Size(),
				DocTitle:   fi.name,
				DocType:    fi.ext,
				OriginSize: stat.Size(),
			})
		}
	}

	// Build generation request
	genReq := GenerateRequest{
		Mode:        "chat_video",
		Query:       prompt,
		Attachments: attachments,
		HtmlTplID:   "",
		VideoConfig: VideoConfig{
			SceneID:    sceneID,
			ModelName:  modelName,
			Duration:   duration,
			Resolution: resolution,
			VideoSize:  videoSize,
			AiType:     aiType,
		},
	}

	if sceneID == "motion" {
		genReq.Motion = &MotionConfig{
			CharacterImage:    characterURL,
			MotionVideo:       motionURL,
			MotDuration:       motDuration,
			KeepOriginalSound: keepOriginalSound,
		}
	}

	reqJSON, _ := json.Marshal(genReq)
	fmt.Printf("[Gen] Request payload:\n%s\n", string(reqJSON))

	return a.SubmitGeneration(string(reqJSON))
}

// ReadFileAsDataURL reads a file and returns a base64 data URL (e.g. "data:image/png;base64,...")
func (a *App) ReadFileAsDataURL(filePath string) string {
	data, err := os.ReadFile(filePath)
	if err != nil {
		fmt.Printf("[ReadFile] Error reading %s: %v\n", filePath, err)
		return ""
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	mime := "application/octet-stream"
	switch ext {
	case ".png":
		mime = "image/png"
	case ".jpg", ".jpeg":
		mime = "image/jpeg"
	case ".webp":
		mime = "image/webp"
	case ".gif":
		mime = "image/gif"
	case ".mp4":
		mime = "video/mp4"
	case ".mov":
		mime = "video/quicktime"
	case ".webm":
		mime = "video/webm"
	}

	encoded := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mime, encoded)
}

// ParseCookiesFromJSON is a Wails-bound helper to validate cookies
func (a *App) ParseCookiesFromJSON(cookieJSON string) string {
	cookies, err := parseCookies(cookieJSON)
	if err != nil {
		return fmt.Sprintf(`{"valid":false,"error":"%s"}`, strings.ReplaceAll(err.Error(), `"`, `'`))
	}
	oussFound := false
	for _, c := range cookies {
		if c.Name == "ouss" {
			oussFound = true
			break
		}
	}
	if !oussFound {
		return `{"valid":false,"error":"ouss cookie not found - make sure you export all cookies from oreateai.com"}`
	}
	return fmt.Sprintf(`{"valid":true,"count":%d}`, len(cookies))
}

// GetModelPointCosts returns point costs for a specific model
func (a *App) GetModelPointCosts(modelName, sceneID string) string {
	result := a.GetModels()
	if result.Error != "" {
		return fmt.Sprintf(`{"error":"%s"}`, result.Error)
	}

	for _, m := range result.Models {
		if m.ModelName == modelName {
			var costs interface{}
			switch sceneID {
			case "motion":
				costs = m.PointCostMotion
			case "reference":
				costs = m.PointCostReference
			default:
				costs = m.PointCostImage
			}
			jsonBytes, _ := json.Marshal(map[string]interface{}{
				"pointCosts":       costs,
				"videoSize":        m.VideoSize,
				"videoResolution":  m.VideoResolution,
				"duration":         m.Duration,
				"supportAudio":     m.SupportAudio,
			})
			return string(jsonBytes)
		}
	}

	return `{"error":"model not found"}`
}

// ====================================================================
//  Helpers
// ====================================================================

func mapKeys(m map[string]UploadCredential) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func truncateStr(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}