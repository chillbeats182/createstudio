package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ====================================================================
//  Constants
// ====================================================================

const (
	BASE_URL = "https://www.oreateai.com"
	GCS_BASE = "https://storage.googleapis.com"
)

var (
	httpClient = &http.Client{Timeout: 60 * time.Second}

	defaultHeaders = map[string]string{
		"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		"Accept":          "application/json, text/plain, */*",
		"Accept-Language": "en-US,en;q=0.9",
		"Referer":         "https://www.oreateai.com/home/vertical/aiVideo",
		"Origin":          "https://www.oreateai.com",
	}
)

// ====================================================================
//  Safe map access helpers (Go's loose typing with map[string]interface{})
// ====================================================================

func safeMap(m map[string]interface{}, key string) map[string]interface{} {
	if m == nil {
		return nil
	}
	v, ok := m[key]
	if !ok || v == nil {
		return nil
	}
	if m2, ok := v.(map[string]interface{}); ok {
		return m2
	}
	return nil
}

func safeSlice(m map[string]interface{}, key string) []interface{} {
	if m == nil {
		return nil
	}
	v, ok := m[key]
	if !ok || v == nil {
		return nil
	}
	if s, ok := v.([]interface{}); ok {
		return s
	}
	return nil
}

func safeFloat(m map[string]interface{}, key string) float64 {
	if m == nil {
		return 0
	}
	v, ok := m[key]
	if !ok || v == nil {
		return 0
	}
	switch val := v.(type) {
	case float64:
		return val
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case json.Number:
		f, _ := val.Float64()
		return f
	}
	return 0
}

func safeStr(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}

// ====================================================================
//  Generic HTTP request helper
// ====================================================================

func oreateRequest(path, method, cookieHeader string, body io.Reader, extraHeaders map[string]string) ([]byte, int, error) {
	url := BASE_URL + path
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, 0, fmt.Errorf("create request: %w", err)
	}

	for k, v := range defaultHeaders {
		req.Header.Set(k, v)
	}
	if cookieHeader != "" {
		req.Header.Set("Cookie", cookieHeader)
	}
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("read body: %w", err)
	}
	return raw, resp.StatusCode, nil
}

func parseJSON(raw []byte) map[string]interface{} {
	var m map[string]interface{}
	json.Unmarshal(raw, &m)
	return m
}

// ====================================================================
//  OreateAuth — GET /oreate/user/getuserinfo + GET /bizapi/point/getrestpoints
// ====================================================================

func (a *App) OreateAuth(cookieHeader string) map[string]interface{} {
	type httpResult struct {
		raw []byte
		err error
	}

	userCh := make(chan httpResult, 1)
	pointsCh := make(chan httpResult, 1)

	go func() {
		raw, _, err := oreateRequest("/oreate/user/getuserinfo", "GET", cookieHeader, nil, nil)
		userCh <- httpResult{raw, err}
	}()

	go func() {
		raw, _, err := oreateRequest("/bizapi/point/getrestpoints", "GET", cookieHeader, nil, nil)
		pointsCh <- httpResult{raw, err}
	}()

	ur := <-userCh
	pr := <-pointsCh

	if ur.err != nil {
		return map[string]interface{}{"success": false, "userInfo": nil, "vipInfo": nil, "restPoint": 0, "error": ur.err.Error()}
	}

	userResp := parseJSON(ur.raw)
	pointsResp := parseJSON(pr.raw)

	userStatus := safeMap(userResp, "status")
	userData := safeMap(userResp, "data")
	pointsData := safeMap(pointsResp, "data")

	return map[string]interface{}{
		"success":   safeFloat(userStatus, "code") == 0,
		"userInfo":  safeMap(userData, "basicInfo"),
		"vipInfo":   safeMap(userData, "vipInfo"),
		"restPoint": safeFloat(pointsData, "restPoint"),
	}
}

// ====================================================================
//  OreateGetModels — GET modelconfigv3 + GET sceneconfig
// ====================================================================

func (a *App) OreateGetModels(cookieHeader string) map[string]interface{} {
	type httpResult struct {
		raw []byte
		err error
	}

	modelCh := make(chan httpResult, 1)
	sceneCh := make(chan httpResult, 1)

	go func() {
		raw, _, err := oreateRequest("/oreate/aivideo/getmodelconfigv3", "GET", cookieHeader, nil, nil)
		modelCh <- httpResult{raw, err}
	}()

	go func() {
		raw, _, err := oreateRequest("/oreate/aivideo/getsceneconfig", "GET", cookieHeader, nil, nil)
		sceneCh <- httpResult{raw, err}
	}()

	mr := <-modelCh
	sr := <-sceneCh

	if mr.err != nil {
		return map[string]interface{}{"success": false, "models": []interface{}{}, "scenes": []interface{}{}, "error": mr.err.Error()}
	}

	modelResp := parseJSON(mr.raw)
	sceneResp := parseJSON(sr.raw)

	modelData := safeMap(modelResp, "data")
	sceneData := safeMap(sceneResp, "data")

	return map[string]interface{}{
		"success": true,
		"models":  safeSlice(modelData, "models"),
		"scenes":  safeSlice(sceneData, "scenes"),
	}
}

// ====================================================================
//  OreateGetUploadToken — POST /oreate/convert/getuploadbostoken
// ====================================================================

func (a *App) OreateGetUploadToken(cookieHeader string, fileMetasJSON string) map[string]interface{} {
	var fileMetas []interface{}
	if err := json.Unmarshal([]byte(fileMetasJSON), &fileMetas); err != nil {
		return map[string]interface{}{"success": false, "KeyList": nil, "error": "invalid fileMetas JSON"}
	}

	payload := map[string]interface{}{
		"mFileList": fileMetas,
	}

	// Add source:"aiImage" if any file is an image
	imageExts := map[string]bool{"jpg": true, "jpeg": true, "png": true, "webp": true}
	for _, fm := range fileMetas {
		if m, ok := fm.(map[string]interface{}); ok {
			ext := strings.ToLower(safeStr(m, "fileExt"))
			if imageExts[ext] {
				payload["source"] = "aiImage"
				break
			}
		}
	}

	bodyBytes, _ := json.Marshal(payload)
	raw, _, err := oreateRequest("/oreate/convert/getuploadbostoken", "POST", cookieHeader, bytes.NewReader(bodyBytes), map[string]string{
		"Content-Type": "application/json",
	})
	if err != nil {
		return map[string]interface{}{"success": false, "KeyList": nil, "error": err.Error()}
	}

	resp := parseJSON(raw)
	status := safeMap(resp, "status")
	respData := safeMap(resp, "data")

	return map[string]interface{}{
		"success": safeFloat(status, "code") == 0,
		"KeyList": safeMap(respData, "KeyList"),
	}
}

// ====================================================================
//  OreateUploadFileGCS — PUT to Google Cloud Storage
// ====================================================================

func (a *App) OreateUploadFileGCS(base64Data string, bucket, objectPath, sessionkey, contentType string) map[string]interface{} {
	fileBytes, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		// Try URL-safe base64 (no padding)
		fileBytes, err = base64.RawURLEncoding.DecodeString(base64Data)
		if err != nil {
			return map[string]interface{}{"success": false, "url": "", "error": "failed to decode base64 file data"}
		}
	}

	url := GCS_BASE + "/" + bucket + "/" + objectPath
	req, err := http.NewRequest("PUT", url, bytes.NewReader(fileBytes))
	if err != nil {
		return map[string]interface{}{"success": false, "url": "", "error": err.Error()}
	}

	req.Header.Set("Authorization", "Bearer "+sessionkey)
	req.Header.Set("Content-Type", contentType)

	resp, err := httpClient.Do(req)
	if err != nil {
		return map[string]interface{}{"success": false, "url": "", "error": err.Error()}
	}
	defer resp.Body.Close()

	finalURL := GCS_BASE + "/" + bucket + "/" + objectPath
	if resp.StatusCode == 200 {
		return map[string]interface{}{"success": true, "url": finalURL}
	}

	body, _ := io.ReadAll(resp.Body)
	preview := string(body)
	if len(preview) > 500 {
		preview = preview[:500]
	}
	return map[string]interface{}{
		"success": false,
		"url":     "",
		"error":   fmt.Sprintf("GCS upload failed: HTTP %d - %s", resp.StatusCode, preview),
	}
}

// ====================================================================
//  OreateGenerate — POST /oreate/sse/stream (SSE response)
// ====================================================================

func (a *App) OreateGenerate(cookieHeader string, sseRequestJSON string) map[string]interface{} {
	raw, code, err := oreateRequest("/oreate/sse/stream", "POST", cookieHeader, strings.NewReader(sseRequestJSON), map[string]string{
		"Content-Type": "application/json",
		"locale":       "en-US",
		"Client-Type":  "pc",
		"accept":       "text/event-stream",
	})
	if err != nil {
		return map[string]interface{}{"success": false, "docId": "", "chatId": "", "events": []interface{}{}, "error": err.Error()}
	}

	if code != 200 {
		errResp := parseJSON(raw)
		status := safeMap(errResp, "status")
		msg := safeStr(status, "msg")
		if msg == "" {
			msg = string(raw)
			if len(msg) > 200 {
				msg = msg[:200]
			}
		}
		return map[string]interface{}{"success": false, "docId": "", "chatId": "", "events": []interface{}{}, "error": fmt.Sprintf("HTTP %d: %s", code, msg)}
	}

	// Parse SSE events from raw text
	text := string(raw)
	var events []map[string]interface{}
	chatId := ""
	docId := ""
	hasError := false
	errorMsg := ""

	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" || data == "[DONE]" {
			continue
		}

		var parsed map[string]interface{}
		if err := json.Unmarshal([]byte(data), &parsed); err != nil {
			continue
		}

		eventName := safeStr(parsed, "event")

		// Try to extract docId/chatId from any event
		if docId == "" {
			docId = safeStr(parsed, "docId")
			if docId == "" {
				docId = safeStr(parsed, "id")
			}
		}
		if chatId == "" {
			chatId = safeStr(parsed, "chatId")
		}

		events = append(events, map[string]interface{}{
			"event": eventName,
			"data":  parsed,
			"raw":   data,
		})

		if eventName == "error" {
			hasError = true
			ec := int(safeFloat(parsed, "code"))
			em := safeStr(parsed, "msg")
			if em != "" {
				errorMsg = fmt.Sprintf("error code %d: %s", ec, em)
			} else {
				errorMsg = fmt.Sprintf("error code %d", ec)
			}
		}
	}

	if events == nil {
		events = []map[string]interface{}{}
	}

	if hasError {
		return map[string]interface{}{"success": false, "docId": docId, "chatId": chatId, "events": events, "error": errorMsg}
	}

	if docId == "" && chatId != "" {
		docId = chatId
	}

	return map[string]interface{}{"success": true, "docId": docId, "chatId": chatId, "events": events}
}

// ====================================================================
//  OreateGetTaskStatus — POST /oreate/doc/getstatus
// ====================================================================

func (a *App) OreateGetTaskStatus(cookieHeader string, docId string) map[string]interface{} {
	payload := map[string]interface{}{
		"docIdList": []string{docId},
	}
	bodyBytes, _ := json.Marshal(payload)

	raw, _, err := oreateRequest("/oreate/doc/getstatus", "POST", cookieHeader, bytes.NewReader(bodyBytes), map[string]string{
		"Content-Type": "application/json",
	})
	if err != nil {
		return map[string]interface{}{"success": false, "status": -1, "progress": 0, "videoUrl": "", "doc": nil, "error": err.Error()}
	}

	resp := parseJSON(raw)
	status := safeMap(resp, "status")
	respData := safeMap(resp, "data")
	docList := safeSlice(respData, "docList")

	doc := map[string]interface{}{}
	if len(docList) > 0 {
		if d, ok := docList[0].(map[string]interface{}); ok {
			doc = d
		}
	}

	return map[string]interface{}{
		"success":   safeFloat(status, "code") == 0,
		"status":    safeFloat(doc, "status"),
		"progress":  safeFloat(doc, "progress"),
		"videoUrl":  safeStr(doc, "videoUrl"),
		"doc":       doc,
	}
}

// ====================================================================
//  OreateGetHistory — GET /oreate/memory/getchatlist
// ====================================================================

func (a *App) OreateGetHistory(cookieHeader string, pn, rn int) map[string]interface{} {
	path := fmt.Sprintf("/oreate/memory/getchatlist?pn=%d&rn=%d", pn, rn)
	raw, _, err := oreateRequest(path, "GET", cookieHeader, nil, nil)
	if err != nil {
		return map[string]interface{}{"success": false, "items": []interface{}{}, "total": 0, "error": err.Error()}
	}

	resp := parseJSON(raw)
	status := safeMap(resp, "status")
	respData := safeMap(resp, "data")
	chatList := safeSlice(respData, "chatList")
	total := safeFloat(respData, "total")

	// Map chatList items to match frontend HistoryItem shape
	items := []map[string]interface{}{}
	for _, item := range chatList {
		if c, ok := item.(map[string]interface{}); ok {
			items = append(items, map[string]interface{}{
				"docId":        safeStr(c, "docId"),
				"chatId":       safeStr(c, "chatId"),
				"title":        safeStr(c, "title"),
				"createTime":   safeFloat(c, "createTime"),
				"status":       safeFloat(c, "status"),
				"videoUrl":     safeStr(c, "videoUrl"),
				"thumbnailUrl": safeStr(c, "thumbnailUrl"),
				"prompt":       safeStr(c, "prompt"),
				"modelName":    safeStr(c, "modelName"),
			})
		}
	}

	return map[string]interface{}{
		"success": safeFloat(status, "code") == 0,
		"items":   items,
		"total":   total,
	}
}