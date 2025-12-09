FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Flask application
COPY app.py .

# Create directory for model files (will be mounted via volume)
RUN mkdir -p /app/model

# Expose Flask port
EXPOSE 5000

# Run Flask application
CMD ["python", "app.py"]

