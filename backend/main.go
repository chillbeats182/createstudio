package main

import (
	"context"
	"embed"
	"fmt"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "OreateAI Studio",
		Width:     1280,
		Height:    820,
		MinWidth:  960,
		MinHeight: 640,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 9, G: 9, B: 11, A: 255},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		log.Fatalf("Failed to start application: %v", err)
	}
}

// App struct holds the API client
type App struct {
	ctx        context.Context
	apiClient  *OreateAIClient
	cookieJSON string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		apiClient: NewOreateAIClient(),
	}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	fmt.Println("OreateAI Studio started")
}