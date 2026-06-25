# --- Stage 1: Build the binary ---
FROM golang:1.26-alpine AS builder

# Install FFmpeg dependencies inside the build container if needed
RUN apk add --no-cache git

WORKDIR /app

# Copy dependency files first for caching optimization
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the application files (including media/)
COPY . .

# Build a highly optimized, static binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /pulse-guard-worker .

# --- Stage 2: Runtime Environment ---
FROM alpine:3.19

# CRITICAL: Install FFmpeg inside the runtime container so Go can call it!
RUN apk add --no-cache ffmpeg

WORKDIR /

# Copy the compiled binary from Stage 1
COPY --from=builder /pulse-guard-worker /pulse-guard-worker

EXPOSE 5002

CMD ["/pulse-guard-worker"]