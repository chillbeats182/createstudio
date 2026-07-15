package main

import (
	"context"
	"fmt"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	fmt.Println("OreateAI Studio started")
}

// IsDesktop returns true to let the frontend know it's running in Wails
func (a *App) IsDesktop() bool {
	return true
}