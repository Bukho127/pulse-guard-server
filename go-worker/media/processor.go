package media

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// VideoJob defines the metadata structure
type VideoJob struct {
	IncidentID   int    `json:"incidentId"`
	FilePath     string `json:"filePath"`
	OriginalName string `json:"originalName"`
}

// ProcessVideo orchestrates the FFmpeg and Azure steps
func ProcessVideo(id int, job VideoJob) {
	fmt.Printf("[Worker %d] Processing Incident %d...\n", id, job.IncidentID)

	fileInfo, err := os.Stat(job.FilePath)
	if err != nil {
		fmt.Printf("File error: %v\n", err)
		return
	}

	sizeInMB := float64(fileInfo.Size()) / (1024 * 1024)
	targetPath := job.FilePath
	mimetype := "video/mp4"

	if sizeInMB >= 5.0 {
		compressedPath := filepath.Join(filepath.Dir(job.FilePath), "compressed-"+strings.TrimSuffix(filepath.Base(job.FilePath), filepath.Ext(job.FilePath))+".mp4")

		cmd := exec.Command("ffmpeg", "-y", "-i", job.FilePath,
			"-vcodec", "libx264", "-acodec", "aac", "-s", "1280x720",
			"-crf", "28", "-preset", "ultrafast", "-threads", "2",
			"-movflags", "frag_keyframe+empty_moov", compressedPath,
		)

		if err := cmd.Run(); err != nil {
			fmt.Printf("FFmpeg failed: %v\n", err)
			return
		}

		os.Remove(job.FilePath) // Clean uncompressed file
		targetPath = compressedPath
	} else {
		fmt.Printf("Small file (%.2fMB). Skipping compression.\n", sizeInMB)
	}

	// Calling the function from azure.go directly since they share package media!
	azureURL := UploadToAzure(targetPath, job.IncidentID, mimetype)

	if azureURL != "" {
		fmt.Printf("Complete! Incident %d live at: %s\n", job.IncidentID, azureURL)

		//RIGHT HERE: Call the webhook function before cleaning up the file!
		PingExpressWebhook(job.IncidentID, azureURL)

		os.Remove(targetPath) // Clean local file
	}
}

func PingExpressWebhook(incidentID int, videoURL string) {
	payload := map[string]interface{}{
		"incidentId": incidentID,
		"videoUrl":   videoURL,
	}
	jsonPayload, _ := json.Marshal(payload)

	//Fires the POST request directly to the 'app' container over the Docker network
	url := "http://app:5001/internal/video-complete"

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		fmt.Printf("Failed to notify Express webhook: %v\n", err)
		return
	}
	defer resp.Body.Close()

	fmt.Printf("Express notified of completed upload for Incident %d (Status: %s)\n", incidentID, resp.Status)
}
