package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	// This imports everything under the media/ folder
	"pulse-guard-worker/media"

	"github.com/joho/godotenv"
)

// Global channel accepting our custom media struct type
var jobQueue = make(chan media.VideoJob, 100)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading global environment")
	}

	// Starting 5 worker goroutines to process jobs concurrently
	//this is useful for handling multiple video processing tasks at the same time
	for w := 1; w <= 5; w++ {
		go func(workerID int) {
			for job := range jobQueue {
				// Calling the public processor function
				media.ProcessVideo(workerID, job)
			}
		}(w)
	}

	http.HandleFunc("/process-video", handleIncomingJob)

	fmt.Println("Pulse Guard Go worker running on http://localhost:5002")
	if err := http.ListenAndServe(":5002", nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func handleIncomingJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var job media.VideoJob
	if err := json.NewDecoder(r.Body).Decode(&job); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	jobQueue <- job

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte(`{"status":"queued"}`))
}
