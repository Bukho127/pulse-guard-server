# Pulse Guard Server Documentation

## Overview

**Pulse Guard** is a community-driven video crime reporting platform designed to improve public safety across Cape Town townships. Rather than remaining passive bystanders, community members can actively contribute to public safety by capturing and submitting video evidence of criminal incidents.

The platform's primary objective is to provide emergency responders and law enforcement with **real-time situational awareness**. Access to visual evidence from the scene enables responders to assess incidents more accurately, prioritise resources, and make informed decisions before arriving on site.

Every submitted video is reviewed by authorised police personnel. Once an incident has been verified and acknowledged, it becomes part of the platform's crime intelligence data. The incident is then reflected on a community crime heatmap, allowing residents, businesses, researchers, and investors to better understand crime trends and identify areas requiring increased attention.

Pulse Guard aims to strengthen collaboration between communities and law enforcement by providing a secure, scalable, and reliable platform for reporting, reviewing, and visualizing crime incidents.

---

# Technology Stack

Pulse Guard follows a **polyglot architecture**, using the most appropriate technology for each responsibility. The REST API is implemented with Node.js and Express, while computationally intensive media processing is delegated to a dedicated Go service.

| Technology             | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| **Node.js**            | Runtime environment for the REST API                    |
| **Express.js**         | HTTP routing, middleware, and API development           |
| **Go (Golang)**        | High-performance video processing pipeline              |
| **FFmpeg**             | Video compression and transcoding                       |
| **Multer**             | Multipart file upload handling                          |
| **Azure Blob Storage** | Persistent object storage for processed videos          |
| **H3.js**              | Hexagonal spatial indexing for crime heatmap generation |

---

# Backend (Node.js + Express)

The primary backend service manages the application's business logic and exposes the REST API consumed by the web and mobile applications.

Its responsibilities include:

* User authentication and authorisation
* Incident management
* Video upload coordination
* Database operations
* Police acknowledgement workflow
* Heatmap data generation
* REST API endpoints
* Communication with the Go video processing service

---

# Video Processing Pipeline (Go)

Video processing is isolated into a dedicated microservice written in **Go**.

Processing uploaded media is CPU-intensive and can significantly impact API responsiveness if performed within the Node.js application. Separating these responsibilities allows the REST API to remain responsive while the Go service efficiently processes uploaded videos concurrently.

The video pipeline is responsible for:

* Receiving uploaded videos
* Validating media files
* Compressing videos
* Transcoding videos into supported formats
* Preparing media for long-term storage
* Returning the processed media to the backend

---

# FFmpeg

The Go service uses **FFmpeg** as its underlying media processing engine.

FFmpeg performs several essential tasks before a video is stored:

* Compressing uploaded videos
* Reducing file size while maintaining acceptable visual quality
* Transcoding videos into supported formats
* Optimising videos for streaming and playback
* Preparing videos for long-term archival

By delegating these operations to FFmpeg through the Go service, the Node.js API remains lightweight and responsive while ensuring consistent media quality.

---

# Azure Blob Storage

Processed videos are stored in **Azure Blob Storage**, providing secure, scalable, and durable object storage.

Using cloud object storage enables Pulse Guard to:

* Store large video files efficiently
* Serve media independently of the application server
* Improve scalability as the platform grows
* Reduce storage pressure on backend servers
* Provide reliable long-term persistence for evidence

---

# H3 Spatial Indexing

Pulse Guard uses **H3.js**, Uber's hexagonal hierarchical geospatial indexing system, to generate crime heatmaps.

When a police officer acknowledges an incident, the incident's geographic coordinates are converted into an H3 index. Incidents occurring within the same hexagonal cell are aggregated, allowing the frontend to visualise crime density without exposing precise locations.

This approach offers several advantages:

* Efficient spatial aggregation
* Consistent hexagonal map visualization
* Fast geographic queries
* Improved privacy compared to displaying exact coordinates
* Scalable heatmap generation for thousands of incidents

# Architecture Diagram 

```text
Mobile App
      │
      ▼
Node.js + Express API
      │
      ├────────► MySQL
      ├────────► Go Video Service
      │               │
      │               ▼
      │            FFmpeg
      │               │
      ▼               ▼
Azure Blob Storage
      │
      ▼
Police Review
      │
      ▼
H3 Heatmap
```
