package main

import (
        "embed"
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
                BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 255},
                OnStartup:        app.startup,
                Bind: []interface{}{
                        app,
                },
        })

        if err != nil {
                log.Fatalf("Failed to start application: %v", err)
        }
}