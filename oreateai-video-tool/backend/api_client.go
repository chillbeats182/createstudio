package main

import (
        "bytes"
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

// ====================================================================
//  Constants
// ====================================================================

const (
        BaseURL   = "https://www.oreateai.com"
        GCSBase   = "https://storage.googleapis.com"
        UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
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

// UploadFileMeta is the metadata for a file to upload (matches website format)
type UploadFileMeta struct {
        Filename string `json:"filename"` // lowercase, no extension
        FileExt  string `json:"fileExt"`  // lowercase extension without dot
        Size     int64  `json:"size"`
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

// Attachment represents a file attachment in generation request (matches website format)
type Attachment struct {
        ID                 string  `json:"id"`
        FileName           string  `json:"fileName"`
        FileExt            string  `json:"fileExt"`
        OriginSize         int64   `json:"originSize"`
        FileSize           int64   `json:"fileSize"`
        BosURL             string  `json:"bosUrl"`
        BosObjectPath      string  `json:"bosObjectPath"`
        Status             string  `json:"status"`
        FileUploadProgress float64 `json:"fileUploadProgress"`
}

// VideoConfig holds the video generation configuration (matches website format)
type VideoConfig struct {
        ModelName   string             `json:"modelName"`
        Ratio       string             `json:"ratio"`
        Resolution  string             `json:"resolution"`
        Duration    int                `json:"duration"`
        IsAudio     bool               `json:"isAudio"`
        AiType      int                `json:"aiType"`
        Scene       string             `json:"scene"`
        TextOrImage *TextOrImageConfig  `json:"textOrImage,omitempty"`
        Reference   *ReferenceConfig    `json:"reference,omitempty"`
        Motion      *MotionConfig       `json:"motion,omitempty"`
}

// TextOrImageConfig is for text_or_image scene
type TextOrImageConfig struct {
        Image string `json:"image"`
}

// ReferenceConfig is for reference scene
type ReferenceConfig struct {
        ReferenceImages   []string `json:"referenceImages"`
        ReferenceVideos   []string `json:"referenceVideos"`
        RefDuration       string   `json:"refDuration"`
        RefTotalDuration  string   `json:"refTotalDuration"`
        KeepOriginalSound bool     `json:"keepOriginalSound"`
}

// MotionConfig holds motion-specific configuration (inside videoConfig)
type MotionConfig struct {
        CharacterImage    string `json:"characterImage"`
        MotionVideo       string `json:"motionVideo"`
        MotDuration       string `json:"motDuration"`
        KeepOriginalSound bool   `json:"keepOriginalSound"`
}

// GenerateRequest is the full generation payload (matches website format)
type GenerateRequest struct {
        ChatID      string        `json:"chatID"`
        QueryID     string        `json:"queryID"`
        ClientType  string        `json:"clientType"`
        IsStream    bool          `json:"isStream"`
        Query       string        `json:"query"`
        Attachments []Attachment  `json:"attachments"`
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
                "source":    "aiImage",
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

// UploadFile uploads a local file to GCS using direct PUT.
// The OreateAI API returns a sessionkey (Google OAuth token) that authorizes
// direct PUT to the GCS object URL. This is simpler and more reliable than
// the resumable upload API (which returns 403 due to billing restrictions).
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

        // Direct PUT to the GCS object URL — verified working with real API
        objectURL := fmt.Sprintf("%s/%s/%s", GCSBase, bucket, objectPath)

        fmt.Printf("[GCS] Uploading (direct PUT): %s (%d bytes, %s)\n", filepath.Base(filePath), fileSize, contentType)
        fmt.Printf("[GCS] URL: %s\n", objectURL)

        buf := new(bytes.Buffer)
        buf.ReadFrom(file)
        fileData := buf.Bytes()

        putReq, _ := http.NewRequest("PUT", objectURL, bytes.NewReader(fileData))
        putReq.Header.Set("Authorization", "Bearer "+sessionKey)
        putReq.Header.Set("Content-Type", contentType)

        uploadResp, err := a.apiClient.httpClient.Do(putReq)
        if err != nil {
                return "", fmt.Errorf("GCS upload failed: %w", err)
        }
        defer uploadResp.Body.Close()

        fmt.Printf("[GCS] Upload response: %d\n", uploadResp.StatusCode)

        if uploadResp.StatusCode == 200 {
                finalURL := objectURL
                fmt.Printf("[GCS] Upload success: %s\n", finalURL)
                return finalURL, nil
        }

        body, _ := io.ReadAll(uploadResp.Body)
        return "", fmt.Errorf("GCS upload returned status %d: %s", uploadResp.StatusCode, string(body))
}

// SubmitGeneration submits a video generation task.
// The server may return either SSE stream or plain JSON.
// Verified response format: {"status":{"code":0,"msg":"success"},"data":{"chatId":"..."}}
func (a *App) SubmitGeneration(requestJSON string) GenerateResult {
        var req GenerateRequest
        if err := json.Unmarshal([]byte(requestJSON), &req); err != nil {
                return GenerateResult{Error: fmt.Sprintf("invalid request: %v", err)}
        }

        body, _ := json.Marshal(req)

        fmt.Printf("[Generate] Submitting: scene=%s model=%s duration=%d res=%s ratio=%s aiType=%d attachments=%d\n",
                req.VideoConfig.Scene, req.VideoConfig.ModelName,
                req.VideoConfig.Duration, req.VideoConfig.Resolution, req.VideoConfig.Ratio,
                req.VideoConfig.AiType, len(req.Attachments))

        httpReq, _ := a.apiClient.newRequest("POST", "/oreate/create/chat", bytes.NewReader(body))
        httpReq.Header.Set("Content-Type", "application/json")
        httpReq.Header.Set("Accept", "application/json, text/event-stream, */*")

        resp, err := a.apiClient.httpClient.Do(httpReq)
        if err != nil {
                return GenerateResult{Error: fmt.Sprintf("request failed: %v", err)}
        }
        defer resp.Body.Close()

        respBody, _ := io.ReadAll(resp.Body)
        bodyStr := string(respBody)

        fmt.Printf("[Generate] Response: %d bytes, content-type: %s\n", len(bodyStr), resp.Header.Get("Content-Type"))

        // Try parsing as direct JSON first (server returns this format for non-SSE responses)
        var directResult map[string]interface{}
        if err := json.Unmarshal(respBody, &directResult); err == nil {
                // Successfully parsed as JSON — check for errors
                if status, ok := directResult["status"].(map[string]interface{}); ok {
                        code, _ := status["code"].(float64)
                        msg, _ := status["msg"].(string)
                        errMsg, _ := status["errMsg"].(string)
                        if code != 0 {
                                return GenerateResult{
                                        SubmitResult: directResult,
                                        Error:        fmt.Sprintf("generation error (code %d): %s — %s", int(code), msg, errMsg),
                                }
                        }
                }

                // Extract docId/chatId from the JSON response
                docID := ""
                if data, ok := directResult["data"].(map[string]interface{}); ok {
                        // Try various field names the server might return
                        for _, field := range []string{"docId", "docID", "chatId", "taskId"} {
                                if id, ok := data[field].(string); ok && id != "" {
                                        docID = id
                                        break
                                }
                        }
                }

                fmt.Printf("[Generate] docId/chatId=%s\n", docID)

                return GenerateResult{
                        Success:      true,
                        DocID:        docID,
                        SubmitResult: directResult,
                }
        }

        // If not valid JSON, try SSE parsing
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
                preview := bodyStr
                if len(preview) > 500 {
                        preview = preview[:500] + "..."
                }
                return GenerateResult{Error: fmt.Sprintf("invalid response (not JSON or SSE): %s", preview)}
        }

        // Find best SSE event
        var bestEvent *sseEvent
        for i := range events {
                ev := &events[i]
                if status, ok := ev.parsed["status"].(map[string]interface{}); ok {
                        code, _ := status["code"].(float64)
                        msg, _ := status["msg"].(string)
                        if code != 0 && code != 1 {
                                return GenerateResult{
                                        SubmitResult: ev.parsed,
                                        Error:        fmt.Sprintf("generation error (code %d): %s", int(code), msg),
                                }
                        }
                }
                if d, ok := ev.parsed["data"].(map[string]interface{}); ok {
                        if _, has := d["docId"]; has || d["docID"] != nil || d["chatId"] != nil {
                                bestEvent = ev
                                break
                        }
                }
                if bestEvent == nil {
                        if status, ok := ev.parsed["status"].(map[string]interface{}); ok {
                                if code, _ := status["code"].(float64); code == 0 {
                                        bestEvent = ev
                                }
                        }
                }
        }

        if bestEvent == nil {
                bestEvent = &events[0]
        }

        docID := ""
        if data, ok := bestEvent.parsed["data"].(map[string]interface{}); ok {
                for _, field := range []string{"docId", "docID", "chatId", "taskId"} {
                        if id, ok := data[field].(string); ok && id != "" {
                                docID = id
                                break
                        }
                }
        }

        fmt.Printf("[Generate] docId/chatId=%s (from SSE)\n", docID)

        return GenerateResult{
                Success:      true,
                DocID:        docID,
                SubmitResult: bestEvent.parsed,
        }
}

// GetTaskStatus polls the status of a generation task (POST method, matching website)
func (a *App) GetTaskStatus(docID string) TaskStatusResult {
        // Website uses POST for getstatus: vi.post("/oreate/doc/getstatus", n)
        payload := map[string]interface{}{
                "docIdList": []string{docID},
        }
        body, _ := json.Marshal(payload)

        req, _ := a.apiClient.newRequest("POST", "/oreate/doc/getstatus", bytes.NewReader(body))
        req.Header.Set("Content-Type", "application/json")

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
// Website uses: vi.get("/oreate/memory/getchatlist", {params: {pn, rn, updateTime}})
func (a *App) GetHistory(pageNo, pageSize int) HistoryResult {
        urlPath := fmt.Sprintf("/oreate/memory/getchatlist?pn=%d&rn=%d", pageNo, pageSize)
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
// Matches the exact workflow of https://www.oreateai.com
func (a *App) GenerateVideo(imagePath, videoPath, prompt, sceneID, modelName string, duration int, resolution, videoSize string, aiType int, motDuration string, keepOriginalSound bool) GenerateResult {
        fmt.Printf("=== GenerateVideo START ===\n")
        fmt.Printf("[Gen] imagePath=%q videoPath=%q\n", imagePath, videoPath)
        fmt.Printf("[Gen] scene=%s model=%s duration=%d res=%s ratio=%s aiType=%d\n",
                sceneID, modelName, duration, resolution, videoSize, aiType)

        // Helper to check if extension is an image
        isImageExt := func(ext string) bool {
                return ext == "png" || ext == "jpg" || ext == "jpeg" || ext == "webp" || ext == "gif"
        }

        // Helper to check if extension is a video
        isVideoExt := func(ext string) bool {
                return ext == "mp4" || ext == "mov" || ext == "avi" || ext == "webm"
        }

        // Build file list for upload token request (matches website: filename, fileExt, size)
        type localFile struct {
                path      string
                ext       string
                name      string // filename with extension e.g. "photo.jpg"
                nameNoExt string // filename without extension e.g. "photo"
                size      int64
                bosUrl    string
                objectPath string
        }

        var files []localFile

        if imagePath != "" {
                ext := strings.TrimPrefix(filepath.Ext(imagePath), ".")
                name := filepath.Base(imagePath)
                stat, _ := os.Stat(imagePath)
                sz := int64(0)
                if stat != nil {
                        sz = stat.Size()
                }
                files = append(files, localFile{
                        path:      imagePath,
                        ext:       ext,
                        name:      name,
                        nameNoExt: strings.TrimSuffix(name, "."+ext),
                        size:      sz,
                })
        }

        if videoPath != "" {
                ext := strings.TrimPrefix(filepath.Ext(videoPath), ".")
                name := filepath.Base(videoPath)
                stat, _ := os.Stat(videoPath)
                sz := int64(0)
                if stat != nil {
                        sz = stat.Size()
                }
                files = append(files, localFile{
                        path:      videoPath,
                        ext:       ext,
                        name:      name,
                        nameNoExt: strings.TrimSuffix(name, "."+ext),
                        size:      sz,
                })
        }

        // Step 1: Get upload credentials
        var tokenResult UploadTokenResult
        if len(files) > 0 {
                var fileMetas []UploadFileMeta
                for _, f := range files {
                        fileMetas = append(fileMetas, UploadFileMeta{
                                Filename: f.nameNoExt, // website sends name without extension
                                FileExt:  f.ext,
                                Size:     f.size,
                        })
                }
                metasJSON, _ := json.Marshal(fileMetas)
                fmt.Printf("[Gen] Upload token request: %s\n", string(metasJSON))

                tokenResult = a.GetUploadToken(string(metasJSON))
                if tokenResult.Error != "" {
                        return GenerateResult{Error: fmt.Sprintf("get upload token failed: %s", tokenResult.Error)}
                }
                fmt.Printf("[Gen] Got %d upload credentials\n", len(tokenResult.KeyList))
        }

        // Step 2: Upload files to GCS
        for i, f := range files {
                // Find matching credential
                var cred *UploadCredential
                var matchedKey string

                // Try matching by filename with extension, without extension, case-insensitive
                for key, c := range tokenResult.KeyList {
                        if key == f.name || key == f.nameNoExt || strings.EqualFold(key, f.name) || strings.EqualFold(key, f.nameNoExt) {
                                tmpCred := c
                                cred = &tmpCred
                                matchedKey = key
                                break
                        }
                }

                // Fallback: use by index
                if cred == nil && len(tokenResult.KeyList) > 0 {
                        keys := make([]string, 0, len(tokenResult.KeyList))
                        for k := range tokenResult.KeyList {
                                keys = append(keys, k)
                        }
                        if len(keys) == 1 {
                                tmpCred := tokenResult.KeyList[keys[0]]
                                cred = &tmpCred
                                matchedKey = keys[0]
                                fmt.Printf("[Gen] WARNING: No exact key match for %q, using only available credential\n", f.name)
                        } else if i < len(keys) {
                                tmpCred := tokenResult.KeyList[keys[i]]
                                cred = &tmpCred
                                matchedKey = keys[i]
                                fmt.Printf("[Gen] WARNING: No exact key match for %q, using key at index %d: %q\n", f.name, i, matchedKey)
                        }
                }

                if cred == nil {
                        return GenerateResult{Error: fmt.Sprintf("no upload credential found for file: %s (available keys: %v)",
                                f.name, mapKeys(tokenResult.KeyList))}
                }

                fmt.Printf("[Gen] Uploading %s with credential key=%q\n", f.name, matchedKey)

                uploadURL, err := a.UploadFile(f.path, cred.Bucket, cred.ObjectPath, cred.SessionKey)
                if err != nil {
                        return GenerateResult{Error: fmt.Sprintf("upload %s failed: %v", f.name, err)}
                }
                files[i].bosUrl = uploadURL
                files[i].objectPath = cred.ObjectPath
                fmt.Printf("[Gen] Uploaded %s → %s\n", f.name, uploadURL)
        }

        // Step 3: Build attachments array (matches website format)
        var attachments []Attachment
        characterURL := ""
        motionURL := ""

        if sceneID == "motion" {
                // Website: buildVideoAttach for motion returns [imitationVideo, character]
                // Video first, then image
                for _, f := range files {
                        if isVideoExt(f.ext) {
                                motionURL = f.bosUrl
                                attachments = append(attachments, Attachment{
                                        ID:                 f.name,
                                        FileName:           f.nameNoExt,
                                        FileExt:            f.ext,
                                        OriginSize:         f.size,
                                        FileSize:           f.size,
                                        BosURL:             f.bosUrl,
                                        BosObjectPath:      f.objectPath,
                                        Status:             "completed",
                                        FileUploadProgress: 1,
                                })
                        }
                }
                for _, f := range files {
                        if isImageExt(f.ext) {
                                characterURL = f.bosUrl
                                attachments = append(attachments, Attachment{
                                        ID:                 f.name,
                                        FileName:           f.nameNoExt,
                                        FileExt:            f.ext,
                                        OriginSize:         f.size,
                                        FileSize:           f.size,
                                        BosURL:             f.bosUrl,
                                        BosObjectPath:      f.objectPath,
                                        Status:             "completed",
                                        FileUploadProgress: 1,
                                })
                        }
                }
        } else {
                // For text_or_image and reference: images first
                for _, f := range files {
                        if isImageExt(f.ext) {
                                characterURL = f.bosUrl
                        }
                        attachments = append(attachments, Attachment{
                                ID:                 f.name,
                                FileName:           f.nameNoExt,
                                FileExt:            f.ext,
                                OriginSize:         f.size,
                                FileSize:           f.size,
                                BosURL:             f.bosUrl,
                                BosObjectPath:      f.objectPath,
                                Status:             "completed",
                                FileUploadProgress: 1,
                        })
                }
        }

        // Step 4: Build videoConfig (matches website format)
        videoConfig := VideoConfig{
                ModelName:  modelName,
                AiType:     aiType,
                Scene:      sceneID,
                IsAudio:    false,
        }

        // Set duration, ratio, resolution based on scene
        if sceneID == "motion" {
                // Motion scene: duration, ratio, resolution are NOT user-configurable
                // They come from the uploaded video. Send empty values.
                videoConfig.Ratio = ""
                videoConfig.Resolution = ""
                videoConfig.Duration = 0
                videoConfig.Motion = &MotionConfig{
                        CharacterImage:    characterURL,
                        MotionVideo:       motionURL,
                        MotDuration:       motDuration,
                        KeepOriginalSound: keepOriginalSound,
                }
        } else if sceneID == "text_or_image" {
                videoConfig.Ratio = videoSize
                videoConfig.Resolution = resolution
                videoConfig.Duration = duration
                videoConfig.TextOrImage = &TextOrImageConfig{
                        Image: characterURL,
                }
        } else if sceneID == "reference" {
                videoConfig.Ratio = videoSize
                videoConfig.Resolution = resolution
                videoConfig.Duration = duration
                // Build reference config: separate images and videos
                var refImages, refVideos []string
                for _, f := range files {
                        if isImageExt(f.ext) {
                                refImages = append(refImages, f.bosUrl)
                        } else if isVideoExt(f.ext) {
                                refVideos = append(refVideos, f.bosUrl)
                        }
                }
                videoConfig.Reference = &ReferenceConfig{
                        ReferenceImages:   refImages,
                        ReferenceVideos:   refVideos,
                        RefDuration:       "",
                        RefTotalDuration:  "",
                        KeepOriginalSound: keepOriginalSound,
                }
        } else {
                // frame_based and other scenes
                videoConfig.Ratio = videoSize
                videoConfig.Resolution = resolution
                videoConfig.Duration = duration
        }

        // Step 5: Build the full generation request (matches website format)
        genReq := GenerateRequest{
                ChatID:      "",
                QueryID:     "",
                ClientType:  "pc",
                IsStream:    true,
                Query:       prompt,
                Attachments: attachments,
                VideoConfig: videoConfig,
        }

        reqJSON, _ := json.MarshalIndent(genReq, "", "  ")
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