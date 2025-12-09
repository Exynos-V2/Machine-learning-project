# AQI Prediction Flask Backend Server

This Flask application serves as a backend for the AQI (Air Quality Index) prediction model. It connects to an MQTT broker to receive real-time AQI data and provides REST API endpoints for predictions.

## Features

- **MQTT Integration**: Automatically subscribes to MQTT topic `data/sensordata` from broker `mqtteclipse.xetf.my.id`
- **Real-time Predictions**: Processes incoming AQI data and makes predictions using the trained model
- **REST API**: Provides endpoints for manual predictions and accessing prediction history
- **Prediction History**: Stores the last 100 predictions for historical access

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Verify Model Files

Ensure the following files exist in the `../Model/` directory:
- `best_model.joblib` - Trained model
- `scaler.pkl` - Feature scaler
- `deployment_params.pkl` - Deployment parameters
- `feature_columns.pkl` - Feature column order
- `label_encoder_target.pkl` - Label encoder for predictions

### 3. Run the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### GET `/`
Returns API information and available endpoints.

**Response:**
```json
{
  "message": "AQI Prediction API",
  "status": "running",
  "endpoints": {...}
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "mqtt_connected": true
}
```

### POST `/predict`
Manually predict status from an AQI value.

**Request:**
```json
{
  "AQI": "108"
}
```

**Response:**
```json
{
  "aqi": 108.0,
  "predicted_status": "Unhealthy_for_Sensitive",
  "probabilities": {
    "Good": 0.0,
    "Moderate": 0.0,
    "Unhealthy_for_Sensitive": 0.95,
    ...
  },
  "timestamp": "2024-01-15T10:30:00"
}
```

### GET `/latest`
Get the latest prediction from MQTT.

**Response:**
```json
{
  "aqi": 108.0,
  "predicted_status": "Unhealthy_for_Sensitive",
  "probabilities": {...},
  "timestamp": "2024-01-15T10:30:00"
}
```

### GET `/history`
Get prediction history.

**Query Parameters:**
- `limit` (optional): Number of recent predictions to return (default: 10, max: 100)

**Example:**
```
GET /history?limit=20
```

**Response:**
```json
{
  "count": 20,
  "history": [
    {
      "aqi": 108.0,
      "predicted_status": "Unhealthy_for_Sensitive",
      ...
    },
    ...
  ]
}
```

## MQTT Configuration

The application automatically connects to:
- **Broker**: `mqtteclipse.xetf.my.id`
- **Port**: `1883`
- **Topic**: `data/sensordata`

### Expected MQTT Message Format

```json
{
  "AQI": "108"
}
```

The AQI value can be a string or number. The application will automatically process incoming messages and make predictions.

## Usage Examples

### Using cURL

**Manual Prediction:**
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"AQI": "108"}'
```

**Get Latest Prediction:**
```bash
curl http://localhost:5000/latest
```

**Get Prediction History:**
```bash
curl http://localhost:5000/history?limit=5
```

### Using Python

```python
import requests

# Manual prediction
response = requests.post('http://localhost:5000/predict', 
                        json={'AQI': '108'})
print(response.json())

# Get latest prediction
response = requests.get('http://localhost:5000/latest')
print(response.json())

# Get history
response = requests.get('http://localhost:5000/history?limit=10')
print(response.json())
```

## Troubleshooting

### Model Not Loading
- Verify all model files exist in the `../Model/` directory
- Check file paths are correct
- Ensure you have read permissions for the model files

### MQTT Connection Issues
- Verify the MQTT broker is accessible: `mqtteclipse.xetf.my.id`
- Check network connectivity
- Verify the topic name: `data/sensordata`
- Check firewall settings for port 1883

### Prediction Errors
- Ensure the AQI value is a valid number
- Check that all model files are loaded correctly
- Verify the feature transformation is working (check console logs)

## Notes

- The server runs in debug mode by default. For production, set `debug=False` in `app.run()`
- Prediction history is stored in memory and limited to the last 100 predictions
- The MQTT client runs in a separate thread and automatically reconnects on disconnection
- CORS is enabled for all routes to allow cross-origin requests

