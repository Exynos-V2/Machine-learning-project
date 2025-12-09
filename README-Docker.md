# Docker Compose Setup

This project uses Docker Compose to orchestrate three services:
1. **Flask Backend Server** - Python Flask API for AQI predictions
2. **Model** - Machine learning model files (mounted as volume)
3. **Website** - React frontend application

## Prerequisites

- Docker Desktop installed and running
- Docker Compose (usually included with Docker Desktop)

## Quick Start

1. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

2. **Start services in detached mode (background):**
   ```bash
   docker-compose up -d --build
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop all services:**
   ```bash
   docker-compose down
   ```

## Services

### Flask Backend
- **Port:** 5000
- **URL:** http://localhost:5000
- **Health Check:** http://localhost:5000/health
- **Model Files:** Mounted from `./Model` directory

### Website (React Frontend)
- **Port:** 3000
- **URL:** http://localhost:3000
- **Build:** Multi-stage build with Nginx for production

## Environment Variables

### Flask Backend
- `FLASK_ENV=production` - Flask environment
- `PYTHONUNBUFFERED=1` - Python output buffering

### Website
- `VITE_API_URL=http://localhost:5000` - API endpoint URL

## Volumes

- `./Model:/app/model:ro` - Model files mounted as read-only volume to Flask container

## Network

All services are connected via a bridge network (`aqi-network`) for internal communication.

## Troubleshooting

### Flask can't find model files
- Ensure the `Model` directory exists in the project root
- Check that model files are present: `best_model.joblib`, `scaler.joblib`, etc.

### Website can't connect to Flask
- Verify Flask is running: `docker-compose ps`
- Check Flask logs: `docker-compose logs flask-backend`
- Ensure API URL in website environment matches Flask service

### Port conflicts
- If port 5000 or 3000 are in use, modify ports in `docker-compose.yml`:
  ```yaml
  ports:
    - "5001:5000"  # Change host port
  ```

## Development

### Rebuild after code changes
```bash
docker-compose up --build
```

### View specific service logs
```bash
docker-compose logs flask-backend
docker-compose logs website
```

### Execute commands in containers
```bash
# Flask container
docker-compose exec flask-backend python app.py

# Website container
docker-compose exec website sh
```

## Production Deployment

For production, consider:
- Using environment-specific docker-compose files
- Setting up proper secrets management
- Configuring reverse proxy (nginx/traefik)
- Setting up SSL/TLS certificates
- Using Docker secrets for sensitive data

