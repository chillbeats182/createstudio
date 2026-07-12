# OreateAI Studio

> Desktop application for OreateAI.com AI video generation — built with [Wails v2](https://wails.io/)

**Educational Purpose Only**

---

## 🚀 Cara Build EXE via GitHub (Paling Mudah)

Kamu **tidak perlu install apapun** di komputermu. Cukup push tag ke GitHub, dan GitHub Actions akan otomatis build EXE-nya.

### Langkah-langkah:

#### 1. Push kode ke repository
```bash
git clone https://github.com/chillbeats182/createstudio.git
cd createstudio
# edit kode kalau mau...
git add -A
git commit -m "update"
git push
```

#### 2. Buat tag dan push untuk trigger build
```bash
git tag v1.0.0
git push origin v1.0.0
```

#### 3. Tunggu build selesai
1. Buka **https://github.com/chillbeats182/createstudio/actions**
2. Klik workflow **"Build Windows EXE"** yang sedang berjalan
3. Tunggu ~3-5 menit sampai statusnya ✅ hijau

#### 4. Download EXE-nya
Ada 2 cara:

**Cara A — Dari Release (otomatis saat push tag):**
1. Buka **https://github.com/chillbeats182/createstudio/releases**
2. Klik release `v1.0.0`
3. Download `oreateai-studio.exe`

**Cara B — Dari Artifacts:**
1. Buka **https://github.com/chillbeats182/createstudio/actions**
2. Klik workflow run yang ✅ berhasil
3. Scroll ke bawah → **Artifacts** → download `oreateai-studio-windows`
4. Extract zip-nya, dapat file `oreateai-studio.exe`

#### 5. Build manual kapan saja (tanpa tag)
1. Buka **https://github.com/chillbeats182/createstudio/actions**
2. Klik **"Build Windows EXE"** di sidebar kiri
3. Klik tombol **"Run workflow"** → pilih branch `main` → klik **"Run workflow"**

---

## 🛠️ Build Lokal (Opsional)

Jika ingin build di komputermu sendiri:

### Prerequisites

| Platform | Yang perlu di-install |
|----------|---------------------|
| **Windows** | [Go 1.21+](https://go.dev/dl/) + [Wails CLI](https://wails.io/docs/gettingstarted/installation/) (WebView2 sudah built-in Win10/11) |
| **macOS** | Go + Wails CLI + `xcode-select --install` |
| **Linux** | Go + Wails CLI + `sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev` |

### Build Commands

```bash
# 1. Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 2. Clone & masuk folder
git clone https://github.com/chillbeats182/createstudio.git
cd createstudio

# 3. Download dependencies
cd backend && go mod tidy && cd ..

# 4. Development mode (hot reload)
wails dev

# 5. Production build
wails build -clean
# Output: build/bin/oreateai-studio.exe
```

---

## Features

- 🔐 **Cookie Authentication** — Paste browser cookies to connect
- 👤 **Account Info** — Email, VIP status, available credits
- 🎬 **4 Scenes** — Text/Image to Video, Motion, Reference, Text to Video
- 🤖 **15+ Models** — Kling 3.0, Wan 2.7, Seedance 2.0, Veo 3, Pixverse V5
- ⚙️ **Full Config** — Duration, resolution, aspect ratio, audio, motion settings
- 📤 **File Upload** — Native file picker or drag & drop
- 📋 **History** — Browse and replay past generations
- 🌙 **Dark Theme** — Zinc + emerald accents

## How to Get Cookies

1. Buka [OreateAI.com](https://www.oreateai.com/) → login
2. Tekan **F12** → tab **Application** → **Cookies**
3. Install extension [EditThisCookie](https://microsoftedge.microsoft.com/addons/detail/editthiscookie/neaplmfkghgehbncnkmbgdnjcmhkhhcj)
4. Klik export → copy JSON array → paste di app

## Project Structure

```
createstudio/
├── .github/workflows/build.yml   # GitHub Actions auto-build
├── backend/
│   ├── main.go                    # Wails entry point
│   ├── api_client.go              # OreateAI API client (all 8 endpoints)
│   ├── go.mod
│   └── frontend/
│       ├── index.html
│       └── src/
│           ├── app.js             # Wails bindings & UI logic
│           └── style.css          # Dark theme
├── wails.json
└── README.md
```

## License

Educational use only. Not affiliated with OreateAI.com.