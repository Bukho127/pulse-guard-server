# Docker Setup Guide for Pulse Guard Backend

This guide explains how to run your entire application (Node.js + Valkey) using Docker.

---

## Files Created

1. **Dockerfile** - Builds the Node.js application image
2. **docker-compose.yml** - Orchestrates both Valkey and Node.js containers
3. **.dockerignore** - Excludes unnecessary files from the Docker build
4. **.env.example** - Template for environment variables

---

## Prerequisites

- Docker Desktop installed and running
- Your `.env` file configured (copy from `.env.example` if needed)

---

## Setup Instructions

### Step 1: Configure Environment Variables

Copy `.env.example` to `.env` and update it:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pulse_guard
REDIS_HOST=valkey
REDIS_PORT=6379
JWT_SECRET=your_secret_key
```

**Note:** If you're running MySQL locally (not in Docker), use `DB_HOST=host.docker.internal` on Windows/Mac.

---

### Step 2: Start All Services with Docker Compose

```bash
docker-compose up -d
```

This will:
- Build your Node.js app image
- Start the Node.js container
- Start the Valkey container
- Create a shared network between them

---

### Step 3: Verify Services are Running

```bash
docker-compose ps
```

You should see:
```
CONTAINER ID   IMAGE                         STATUS
xyz123         pulse-guard-backend:latest    Up 2 minutes
abc789         valkey/valkey:latest          Up 2 minutes
```

---

## Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f valkey
```

### Stop Services

```bash
docker-compose down
```

### Stop and Remove Data

```bash
docker-compose down -v
```

### Rebuild the App Image

If you made changes to code:

```bash
docker-compose up -d --build
```

### Access App

```
http://localhost:5000
```

---

## Troubleshooting

### App container won't start

Check logs:
```bash
docker-compose logs app
```

Common issues:
- Database not running - ensure MySQL is accessible
- Wrong environment variables - check `.env` file
- Port 5000 already in use - change in `docker-compose.yml`

### Can't connect to Valkey from app

The app automatically uses `valkey` as the hostname (set in docker-compose.yml).
Make sure `REDIS_HOST=valkey` in `.env` when running with Docker.

### Need to execute commands inside container

```bash
# Run a command
docker-compose exec app npm list

# Open bash shell
docker-compose exec app sh
```

---

## Development vs Production

### Development (Current Setup)

```bash
docker-compose up -d
```

Runs with `npm run dev` (nodemon for auto-reload)

### Production

Modify `docker-compose.yml` and change the CMD:

```dockerfile
CMD ["npm", "start"]  # instead of npm run dev
```

And set:

```env
NODE_ENV=production
```

---

## Network Details

The `docker-compose.yml` creates a shared network called `pulse-guard-network`:

- **Valkey hostname:** `valkey:6379`
- **App hostname:** `pulse-guard-backend:5000`
- **External access:** `localhost:5000` and `localhost:6379`

---

## Backing Up Data

Valkey data is persisted in the `valkey-data` volume:

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect pulse-guard_valkey-data
```

---

## Next Steps

1. Copy `.env.example` to `.env`
2. Update `.env` with your credentials
3. Run `docker-compose up -d`
4. Test your API at `http://localhost:5000`

Need help? Check the logs with `docker-compose logs -f`