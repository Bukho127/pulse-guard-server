# Pulse Guard Server Documentation

## Overview

**Pulse Guard** is a community-driven video crime reporting platform designed to improve public safety across Cape Town townships. Instead of being passive bystanders, community members become active participants by capturing and submitting video evidence of crimes as they occur.

The primary goal of Pulse Guard is to provide emergency responders and law enforcement with **situational awareness** through real-time video reports. By giving police access to visual evidence from the scene, they can make faster, more informed decisions before arriving.

Every submitted video is reviewed by authorized police personnel. Once an incident has been verified and acknowledged, it is published to a community crime heatmap. This allows residents, businesses, community organizations, and investors to better understand crime patterns within specific areas, promoting transparency and encouraging data-driven decisions.

Pulse Guard aims to bridge the gap between communities and law enforcement by creating a secure, efficient, and reliable crime reporting ecosystem.

---

# Technology Stack

The Pulse Guard backend is built using a polyglot architecture, where each technology is responsible for a specific part of the system.

| Technology      | Purpose                                                         |
| --------------- | --------------------------------------------------------------- |
| **Node.js**     | Runtime environment for the REST API                            |
| **Express.js**  | Web framework for handling HTTP requests and routing            |
| **Go (Golang)** | High-performance video processing pipeline                      |
| **FFmpeg**      | Video compression, transcoding, and optimization before storage |
| **Multer**      | File handling                                                   |
| **Azure Blob**  | Object storage for all the processed videos                     |
| **H3.js**       | For Heatmap generation                                          |



## Backend (Node.js + Express)

The primary backend is built with **Node.js** and **Express**. It is responsible for:

* User authentication and authorization
* Incident management
* Video upload coordination
* Database operations
* Police acknowledgement workflow
* Heatmap data generation
* REST API endpoints
* Integration with the video processing service

## Video Processing Pipeline (Go)

Video processing is handled by a dedicated service written in **Go**.

This service receives uploaded videos and processes them independently from the main API. Using Go allows the application to efficiently handle CPU-intensive workloads while maintaining high throughput and low latency.

Responsibilities include:

* Receiving uploaded videos
* Video validation
* Compression
* Transcoding
* Preparing media for storage and streaming

## FFmpeg

The Go video service uses **FFmpeg** to perform media processing tasks.

FFmpeg is responsible for:

* Compressing uploaded videos
* Reducing file size while preserving quality
* Converting videos into supported formats
* Optimizing videos for faster uploads and playback
* Preparing videos for long-term storage

This separation ensures that heavy video processing does not impact the responsiveness of the main Node.js API, allowing Pulse Guard to scale more effectively as the number of uploaded incidents increases.
