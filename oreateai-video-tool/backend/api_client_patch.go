package main

import (
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// PickImageFile opens a native file dialog to select an image file (Wails v2)
func (a *App) PickImageFile() string {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Source Image",
		Filters: []runtime.FileFilter{
			{DisplayName: "Image files", Pattern: "*.png;*.jpg;*.jpeg;*.webp;*.gif"},
		},
	})
	if err != nil {
		fmt.Printf("[PickImage] Error: %v\n", err)
		return ""
	}
	return path
}

// PickVideoFile opens a native file dialog to select a video file (Wails v2)
func (a *App) PickVideoFile() string {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Motion Video",
		Filters: []runtime.FileFilter{
			{DisplayName: "Video files", Pattern: "*.mp4;*.mov;*.avi;*.webm"},
		},
	})
	if err != nil {
		fmt.Printf("[PickVideo] Error: %v\n", err)
		return ""
	}
	return path
}