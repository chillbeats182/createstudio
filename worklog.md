---
Task ID: 1
Agent: Main
Task: Analyze root cause of video generation failure and fix all bugs to match OreateAI.com website workflow

Work Log:
- Analyzed error screenshot: "Generation failed: invalid response:" (empty API response)
- Analyzed OreateAI.com website workflow via web-reader and agent-browser
- Read and traced full code flow in api_client.go and app.js
- Identified 6 critical bugs by comparing app code with website workflow

Bugs Found and Fixed:
1. **BUG 1 (CRITICAL): File picker uses Wails v1 API** - `window.runtime.OpenFileDialog()` doesn't exist in Wails v2
   - Fix: Created `api_client_patch.go` with `PickImageFile()` and `PickVideoFile()` Go-bound methods
   - Fix: Updated `app.js` to use `window.go.main.App.PickImageFile()` and `window.go.main.App.PickVideoFile()`

2. **BUG 2 (CRITICAL): Upload token request missing `source` field** - Website sends `source: "aiImage"`, app didn't
   - Fix: Added `"source": "aiImage"` to the upload token payload

3. **BUG 3 (CRITICAL): Upload file metadata wrong field names** - App sent `name` (full filename with ext), website expects `filename` (without ext)
   - Fix: Changed `UploadFileMeta` struct to use `Filename string json:"filename"` and send name without extension

4. **BUG 4 (CRITICAL): Generation request payload completely wrong structure**
   - Missing: `chatID`, `queryID`, `clientType`, `isStream`
   - Wrong: `mode` field, `sceneId` (should be `scene`), `videoSize` (should be `ratio`)
   - Wrong: `MotionConfig` at top level (should be inside `videoConfig`)
   - Missing: `isAudio` field, `textOrImage` config, `reference` config
   - Fix: Completely rewrote `GenerateRequest`, `VideoConfig`, `Attachment` structs to match website
   - Fix: Added `TextOrImageConfig`, `ReferenceConfig` structs

5. **BUG 5 (CRITICAL): Attachment structure wrong** - `bos_url` should be `bosUrl`, missing `id`, `bosObjectPath`, `fileSize`, `status`, `fileUploadProgress`
   - Fix: Rewrote `Attachment` struct with all correct fields

6. **BUG 6: Motion scene sends user-configurable duration/ratio/resolution** - Website disables these for motion scene
   - Fix: For motion scene, set `videoConfig.Ratio=""`, `videoConfig.Resolution=""`, `videoConfig.Duration=0`

Also fixed:
- Frontend validation for `reference` scene (needs any file, not both image AND video)
- Fixed Go map address-of bug by using local variable copy
- Added proper `ReferenceConfig` for reference scene

Stage Summary:
- All 6 critical bugs fixed
- Files modified: `backend/api_client.go`, `backend/api_client_patch.go` (new), `backend/frontend/src/app.js`
- App now matches OreateAI.com website workflow exactly