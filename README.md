# OreateAI Studio

> Desktop application for OreateAI.com AI video generation — built with [Wails v2](https://wails.io/)

**Educational Purpose Only**

## Features

- 🔐 **Cookie Authentication** — Paste browser cookies to connect your account
- 👤 **Account Info** — Displays email, VIP status, and available credits
- 🎬 **Multi-Scene Support** — Text/Image to Video, First & Last Frame, Reference, Motion Mimicry
- 🤖 **15+ AI Models** — Kling 3.0/2.6, Wan 2.7/2.6, Seedance 2.0, Veo 3, Pixverse V5
- ⚙️ **Full Config** — Duration, resolution, video size, audio, motion settings
- 📤 **File Upload** — Drag & drop or native file picker for images and videos
- 📝 **Prompt Editor** — Text prompt for generation description
- 📋 **History** — Browse and replay past generations
- 🎥 **Video Player** — Built-in player for generated results
- 🌙 **Dark Theme** — Professional dark UI with emerald accents

## Prerequisites

1. **Go 1.21+** — [Install Go](https://go.dev/dl/)
2. **Wails CLI v2** — [Install Wails](https://wails.io/docs/gettingstarted/installation/)
3. **Platform-specific dependencies:**

   ### Windows
   ```
   No additional dependencies needed.
   WebView2 comes pre-installed on Windows 10/11.
   ```

   ### macOS
   ```
   xcode-select --install
   ```

   ### Linux
   ```
   sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev
   ```

## Build Instructions

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/oreateai-video-tool.git
cd oreateai-video-tool
```

### 2. Install Wails CLI (if not already installed)
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### 3. Download Go dependencies
```bash
cd backend
go mod tidy
```

### 4. Build the application

#### Development mode (with hot reload):
```bash
# From the project root (oreateai-video-tool/)
wails dev
```

#### Production build (.exe on Windows):
```bash
# From the project root
wails build

# The output will be at:
#   build/bin/oreateai-studio.exe  (Windows)
#   build/bin/oreateai-studio      (Linux/macOS)
```

#### Build for specific platform:
```bash
# Windows (from Linux/macOS with cross-compile):
wails build -platform windows/amd64

# macOS:
wails build -platform darwin/universal

# Linux:
wails build -platform linux/amd64
```

### 5. Run the built application
```bash
# Windows
./build/bin/oreateai-studio.exe

# Linux
./build/bin/oreateai-studio

# macOS
open build/bin/oreateai-studio.app
```

## How to Get Your Cookies

1. Open [OreateAI.com](https://www.oreateai.com/) in Chrome/Edge and log in
2. Press **F12** to open DevTools
3. Go to **Application** → **Cookies** → `https://www.oreateai.com`
4. Click the **Export** button (or use a cookie export extension like [EditThisCookie](https://microsoftedge.microsoft.com/addons/detail/editthiscookie/neaplmfkghgehbncnkmbgdnjcmhkhhcj))
5. Copy the entire JSON array
6. Paste it into the app's cookie input field

**Important**: The `ouss` cookie is required for authentication. Make sure it's included in your export.

## Project Structure

```
oreateai-video-tool/
├── backend/
│   ├── main.go              # Wails entry point, app struct
│   ├── api_client.go        # All OreateAI API logic
│   ├── frontend/
│   │   ├── index.html       # Main UI
│   │   └── src/
│   │       ├── app.js       # Frontend logic (Wails bindings)
│   │       └── style.css    # Dark theme styles
│   └── go.mod               # Go module definition
├── wails.json               # Wails build config
└── README.md                # This file
```

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oreate/user/getuserinfo` | GET | User account info |
| `/bizapi/point/getrestpoints` | GET | Available credits |
| `/oreate/aivideo/getmodelconfigv3` | GET | Model configurations |
| `/oreate/aivideo/getsceneconfig` | GET | Scene configurations |
| `/oreate/convert/getuploadbostoken` | POST | GCS upload credentials |
| `/oreate/create/chat` | POST | Submit generation task (SSE) |
| `/oreate/doc/getstatus` | GET | Poll task status |
| `/oreate/memory/getchatlist` | GET | Generation history |

## Tech Stack

- **Backend**: Go 1.21+ with Wails v2
- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **Style**: Custom CSS with dark theme (zinc + emerald)
- **API**: REST + SSE to OreateAI.com
- **Upload**: GCS resumable upload protocol

## License

Educational use only. Not affiliated with OreateAI.com.

## Disclaimer

This tool is for **educational purposes only**. It demonstrates how web APIs can be reverse-engineered and interacted with programmatically. Use responsibly and in compliance with OreateAI.com's Terms of Service.