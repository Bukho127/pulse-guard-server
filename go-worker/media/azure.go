package media

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
)

// UploadToAzure handles background cloud ingestion without requiring extra sub-packages
func UploadToAzure(filePath string, incidentID int, mimetype string) string {
	connStr := os.Getenv("AZURE_STORAGE_CONNECTION_STRING")
	if connStr == "" {
		log.Println("Error: AZURE_STORAGE_CONNECTION_STRING is not set in environment")
		return ""
	}

	client, err := azblob.NewClientFromConnectionString(connStr, nil)
	if err != nil {
		log.Printf("Azure client error: %v\n", err)
		return ""
	}

	file, err := os.Open(filePath)
	if err != nil {
		log.Printf("Cannot open file for upload: %v\n", err)
		return ""
	}
	defer file.Close()

	containerName := "incidents"
	blobName := fmt.Sprintf("incident-%d-%s", time.Now().Unix(), filepath.Base(filePath))

	// By passing nil, Azure automatically determines metadata configurations,
	// or we can safely omit properties to resolve version mismatch errors.
	_, err = client.UploadFile(context.TODO(), containerName, blobName, file, nil)
	if err != nil {
		log.Printf("zure upload failed: %v\n", err)
		return ""
	}

	accountName := ""
	parts := strings.Split(connStr, ";")
	for _, part := range parts {
		if strings.HasPrefix(part, "AccountName=") {
			accountName = strings.TrimPrefix(part, "AccountName=")
			break
		}
	}

	return fmt.Sprintf("https://%s.blob.core.windows.net/%s/%s", accountName, containerName, blobName)
}
