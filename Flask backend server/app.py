from flask import Flask, jsonify, request
from flask_cors import CORS
import paho.mqtt.client as mqtt
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
import os
import threading
from collections import deque

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Global variables for model and data
model = None
scaler = None
deployment_params = None
feature_columns = None
label_encoder_target = None
latest_prediction = None
prediction_history = deque(maxlen=100)  # Store last 100 predictions

# MQTT Configuration
MQTT_BROKER = "mqtteclipse.xetf.my.id"
MQTT_PORT = 1883
MQTT_TOPIC = "data/sensordata"
mqtt_client = None

# ============================================================================
# Feature Transformation Functions (from model.ipynb)
# ============================================================================

def transform_aqi_to_features(aqi_value, deployment_params):
    """
    Transform a single AQI value into all features for model prediction.
    
    Parameters:
    -----------
    aqi_value : float
        Single AQI value from IoT device
    deployment_params : dict
        Dictionary containing saved parameters (bin edges, IQR bounds, etc.)
    
    Returns:
    --------
    features : dict
        Dictionary of all feature values
    """
    features = {}
    
    # 1. Original AQI Value
    features['AQI Value'] = aqi_value
    
    # 2. Transformations
    features['AQI_Squared'] = aqi_value ** 2
    features['AQI_Log'] = np.log1p(aqi_value)
    features['AQI_Sqrt'] = np.sqrt(aqi_value)
    features['AQI_Cubed'] = aqi_value ** 3
    features['AQI_Reciprocal'] = 1 / (aqi_value + 1)
    
    # 3. Bins (using saved bin edges)
    if 'aqi_bin_10_edges' in deployment_params:
        features['AQI_Bin_10'] = np.digitize(aqi_value, deployment_params['aqi_bin_10_edges'][1:-1]) - 1
        features['AQI_Bin_10'] = max(0, min(9, features['AQI_Bin_10']))  # Clamp to [0, 9]
    
    if 'aqi_bin_20_edges' in deployment_params:
        features['AQI_Bin_20'] = np.digitize(aqi_value, deployment_params['aqi_bin_20_edges'][1:-1]) - 1
        features['AQI_Bin_20'] = max(0, min(19, features['AQI_Bin_20']))  # Clamp to [0, 19]
    
    # 4. Distance features
    features['Distance_to_50'] = abs(aqi_value - 50)
    features['Distance_to_100'] = abs(aqi_value - 100)
    features['Distance_to_150'] = abs(aqi_value - 150)
    features['Distance_to_200'] = abs(aqi_value - 200)
    features['Distance_to_300'] = abs(aqi_value - 300)
    
    # 5. Range indicators
    features['In_Range_0_50'] = 1 if 0 <= aqi_value <= 50 else 0
    features['In_Range_51_100'] = 1 if 51 <= aqi_value <= 100 else 0
    features['In_Range_101_150'] = 1 if 101 <= aqi_value <= 150 else 0
    features['In_Range_151_200'] = 1 if 151 <= aqi_value <= 200 else 0
    features['In_Range_201_300'] = 1 if 201 <= aqi_value <= 300 else 0
    features['In_Range_300_plus'] = 1 if aqi_value > 300 else 0
    
    # 6. AQI Category
    if aqi_value <= 50:
        aqi_category = 'Good'
    elif aqi_value <= 100:
        aqi_category = 'Moderate'
    elif aqi_value <= 150:
        aqi_category = 'Unhealthy_for_Sensitive'
    elif aqi_value <= 200:
        aqi_category = 'Unhealthy'
    elif aqi_value <= 300:
        aqi_category = 'Very_Unhealthy'
    else:
        aqi_category = 'Hazardous'
    
    # Encode category
    category_map = {
        'Good': 0, 'Moderate': 1, 'Unhealthy_for_Sensitive': 2,
        'Unhealthy': 3, 'Very_Unhealthy': 4, 'Hazardous': 5
    }
    features['AQI_Category_Encoded'] = category_map.get(aqi_category, 0)
    
    # 7. Outlier flag (using saved IQR bounds)
    if 'outlier_lower_bound' in deployment_params and 'outlier_upper_bound' in deployment_params:
        lower = deployment_params['outlier_lower_bound']
        upper = deployment_params['outlier_upper_bound']
        features['Is_Outlier'] = 1 if (aqi_value < lower or aqi_value > upper) else 0
    else:
        features['Is_Outlier'] = 0
    
    # 8. DateTime features (extracted from current date/time)
    current_date = datetime.now()
    
    # Basic datetime features
    features['Year'] = current_date.year
    features['Month'] = current_date.month
    features['Day'] = current_date.day
    
    # Day of week mapping
    day_mapping = {'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 
                   'Friday': 4, 'Saturday': 5, 'Sunday': 6}
    day_of_week_name = current_date.strftime('%A')
    features['DayOfWeek_Num'] = day_mapping.get(day_of_week_name, 0)
    
    # Cyclical encodings for Month
    features['Month_Sin'] = np.sin(2 * np.pi * features['Month'] / 12)
    features['Month_Cos'] = np.cos(2 * np.pi * features['Month'] / 12)
    
    # Cyclical encodings for DayOfWeek
    features['DayOfWeek_Sin'] = np.sin(2 * np.pi * features['DayOfWeek_Num'] / 7)
    features['DayOfWeek_Cos'] = np.cos(2 * np.pi * features['DayOfWeek_Num'] / 7)
    
    # Cyclical encodings for Day
    features['Day_Sin'] = np.sin(2 * np.pi * features['Day'] / 31)
    features['Day_Cos'] = np.cos(2 * np.pi * features['Day'] / 31)
    
    # Season feature
    def get_season(month):
        if month in [12, 1, 2]:
            return 'Winter'
        elif month in [3, 4, 5]:
            return 'Spring'
        elif month in [6, 7, 8]:
            return 'Summer'
        else:
            return 'Fall'
    
    season = get_season(features['Month'])
    # Season encoding: LabelEncoder assigns: Fall=0, Spring=1, Summer=2, Winter=3 (alphabetical order)
    season_map = {'Fall': 0, 'Spring': 1, 'Summer': 2, 'Winter': 3}
    features['Season_Encoded'] = season_map.get(season, 0)
    
    return features

def transform_aqi_to_array(aqi_value, deployment_params, feature_columns):
    """
    Transform AQI value to feature array in the correct order for model prediction.
    
    Parameters:
    -----------
    aqi_value : float
        Single AQI value from IoT device
    deployment_params : dict
        Dictionary containing saved parameters
    feature_columns : list
        List of feature column names in the correct order
    
    Returns:
    --------
    feature_array : numpy array
        Array of features in the correct order for model prediction
    """
    features_dict = transform_aqi_to_features(aqi_value, deployment_params)
    
    # Convert to array in the correct order
    feature_array = np.array([features_dict[col] for col in feature_columns])
    
    return feature_array

# ============================================================================
# Model Loading Functions
# ============================================================================

def load_model_files():
    """Load all necessary model files"""
    global model, scaler, deployment_params, feature_columns, label_encoder_target
    
    try:
        # Check if running in Docker (model files mounted at /app/model)
        # Otherwise use relative path for local development
        docker_path = '/app/model'
        if os.path.exists(docker_path):
            model_dir = docker_path
            print(f"✓ Running in Docker, using model directory: {model_dir}")
        else:
            # Get the base directory (parent of Flask backend server)
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_dir = os.path.join(base_dir, 'Model')
            print(f"✓ Running locally, using model directory: {model_dir}")
        
        # Verify model directory exists
        if not os.path.exists(model_dir):
            raise FileNotFoundError(f"Model directory not found: {model_dir}")
        
        # List files in model directory for debugging
        try:
            files = os.listdir(model_dir)
            print(f"✓ Files in model directory ({len(files)} files): {files}")
            # Check for required files
            required_files = ['best_model.joblib', 'scaler.joblib', 'deployment_params.joblib', 
                            'feature_columns.joblib', 'label_encoder_target.joblib']
            missing_files = [f for f in required_files if f not in files]
            if missing_files:
                raise FileNotFoundError(f"Missing required model files: {missing_files}")
            print(f"✓ All required model files found")
        except PermissionError as e:
            raise PermissionError(f"Cannot access model directory {model_dir}: {e}")
        
        # Load model
        model_path = os.path.join(model_dir, 'best_model.joblib')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")
        model = joblib.load(model_path)
        print(f"✓ Loaded model from {model_path}")
        
        # Load scaler
        scaler_path = os.path.join(model_dir, 'scaler.joblib')
        if not os.path.exists(scaler_path):
            raise FileNotFoundError(f"Scaler file not found: {scaler_path}")
        scaler = joblib.load(scaler_path)
        print(f"✓ Loaded scaler from {scaler_path}")
        
        # Load deployment params
        params_path = os.path.join(model_dir, 'deployment_params.joblib')
        if not os.path.exists(params_path):
            raise FileNotFoundError(f"Deployment params file not found: {params_path}")
        deployment_params = joblib.load(params_path)
        print(f"✓ Loaded deployment params from {params_path}")
        
        # Load feature columns
        feature_path = os.path.join(model_dir, 'feature_columns.joblib')
        if not os.path.exists(feature_path):
            raise FileNotFoundError(f"Feature columns file not found: {feature_path}")
        feature_columns = joblib.load(feature_path)
        print(f"✓ Loaded feature columns from {feature_path}")
        
        # Load label encoder
        encoder_path = os.path.join(model_dir, 'label_encoder_target.joblib')
        if not os.path.exists(encoder_path):
            raise FileNotFoundError(f"Label encoder file not found: {encoder_path}")
        label_encoder_target = joblib.load(encoder_path)
        print(f"✓ Loaded label encoder from {encoder_path}")
        
        print("✓ All model files loaded successfully!")
        return True
    except Exception as e:
        import traceback
        print(f"✗ Error loading model files: {str(e)}")
        print(f"✗ Traceback: {traceback.format_exc()}")
        return False

def predict_status(aqi_value):
    """
    Predict Status from AQI value using the loaded model.
    
    Parameters:
    -----------
    aqi_value : float
        AQI value to predict from
    
    Returns:
    --------
    prediction : dict
        Dictionary containing prediction results
    """
    global model, scaler, deployment_params, feature_columns, label_encoder_target
    
    if model is None or scaler is None:
        return {"error": "Model not loaded"}
    
    try:
        # Convert AQI to float if it's a string
        aqi_value = float(aqi_value)
        
        # Transform AQI to features
        features = transform_aqi_to_array(aqi_value, deployment_params, feature_columns)
        
        # Convert to DataFrame with feature names (fixes sklearn warning)
        features_df = pd.DataFrame([features], columns=feature_columns)
        
        # Scale features
        features_scaled_array = scaler.transform(features_df)
        
        # Convert scaled features back to DataFrame with feature names
        features_scaled_df = pd.DataFrame(features_scaled_array, columns=feature_columns)
        
        # Predict
        predicted_encoded = model.predict(features_scaled_df)[0]
        
        # Decode prediction
        predicted_status = label_encoder_target.inverse_transform([predicted_encoded])[0]
        
        # Get prediction probabilities
        probabilities = model.predict_proba(features_scaled_df)[0]
        classes = label_encoder_target.classes_
        prob_dict = {str(cls): float(prob) for cls, prob in zip(classes, probabilities)}
        
        return {
            "aqi": aqi_value,
            "predicted_status": predicted_status,
            "probabilities": prob_dict,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e)}

# ============================================================================
# MQTT Functions
# ============================================================================

def on_connect(client, userdata, flags, rc):
    """Callback when MQTT client connects"""
    if rc == 0:
        print(f"✓ Connected to MQTT broker: {MQTT_BROKER}")
        client.subscribe(MQTT_TOPIC)
        print(f"✓ Subscribed to topic: {MQTT_TOPIC}")
    else:
        print(f"✗ Failed to connect to MQTT broker. Return code: {rc}")

def on_message(client, userdata, msg):
    """Callback when MQTT message is received"""
    global latest_prediction
    
    try:
        # Decode message
        payload = msg.payload.decode('utf-8')
        data = json.loads(payload)
        
        print(f"Received MQTT message: {data}")
        
        # Extract AQI value
        if 'AQI' in data:
            aqi_value = data['AQI']
            
            # Make prediction
            prediction = predict_status(aqi_value)
            
            if "error" not in prediction:
                latest_prediction = prediction
                prediction_history.append(prediction)
                print(f"✓ Prediction made: AQI={aqi_value}, Status={prediction['predicted_status']}")
            else:
                print(f"✗ Prediction error: {prediction['error']}")
        else:
            print("✗ No 'AQI' field in received data")
            
    except json.JSONDecodeError as e:
        print(f"✗ Error decoding JSON: {str(e)}")
    except Exception as e:
        print(f"✗ Error processing MQTT message: {str(e)}")

def on_disconnect(client, userdata, rc):
    """Callback when MQTT client disconnects"""
    print(f"Disconnected from MQTT broker. Return code: {rc}")

def start_mqtt_client():
    """Start MQTT client in a separate thread"""
    global mqtt_client
    
    try:
        mqtt_client = mqtt.Client()
        mqtt_client.on_connect = on_connect
        mqtt_client.on_message = on_message
        mqtt_client.on_disconnect = on_disconnect
        
        # Connect to broker
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        
        # Start loop in a separate thread
        mqtt_client.loop_start()
        print(f"✓ MQTT client started")
    except Exception as e:
        print(f"✗ Error starting MQTT client: {str(e)}")

# ============================================================================
# Flask Routes
# ============================================================================

@app.route('/', methods=['GET'])
def home():
    """Home endpoint"""
    return jsonify({
        "message": "AQI Prediction API",
        "status": "running",
        "endpoints": {
            "/": "This endpoint",
            "/predict": "POST - Predict status from AQI value",
            "/latest": "GET - Get latest prediction from MQTT",
            "/history": "GET - Get prediction history",
            "/health": "GET - Health check"
        }
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None,
        "mqtt_connected": mqtt_client.is_connected() if mqtt_client else False
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Predict status from AQI value"""
    try:
        data = request.get_json()
        
        if not data or 'AQI' not in data:
            return jsonify({"error": "Missing 'AQI' field in request"}), 400
        
        aqi_value = data['AQI']
        prediction = predict_status(aqi_value)
        
        if "error" in prediction:
            return jsonify(prediction), 500
        
        return jsonify(prediction), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/latest', methods=['GET'])
def get_latest():
    """Get latest prediction from MQTT"""
    global latest_prediction
    
    if latest_prediction is None:
        return jsonify({"message": "No predictions received yet"}), 404
    
    return jsonify(latest_prediction), 200

@app.route('/history', methods=['GET'])
def get_history():
    """Get prediction history"""
    global prediction_history
    
    # Get limit from query parameter
    limit = request.args.get('limit', default=10, type=int)
    
    # Convert deque to list and limit
    history = list(prediction_history)[-limit:]
    
    return jsonify({
        "count": len(history),
        "history": history
    }), 200

# ============================================================================
# Main
# ============================================================================

if __name__ == '__main__':
    print("=" * 60)
    print("Starting AQI Prediction Flask Server")
    print("=" * 60)
    
    # Verify model directory accessibility
    docker_model_path = '/app/model'
    if os.path.exists(docker_model_path):
        print(f"✓ Docker model path exists: {docker_model_path}")
        try:
            files = os.listdir(docker_model_path)
            print(f"✓ Files in Docker model directory: {files}")
        except Exception as e:
            print(f"✗ Cannot list files in {docker_model_path}: {e}")
    else:
        print(f"✗ Docker model path does not exist: {docker_model_path}")
        # Check local path
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        local_model_dir = os.path.join(base_dir, 'Model')
        print(f"Checking local model directory: {local_model_dir}")
        if os.path.exists(local_model_dir):
            print(f"✓ Local model directory exists: {local_model_dir}")
    
    # Load model files
    if load_model_files():
        print("✓ All model files loaded successfully")
    else:
        print("✗ Failed to load model files. Server will start but predictions will fail.")
        print("✗ Please check:")
        print("  1. Model directory is mounted correctly in docker-compose.yml")
        print("  2. All required .joblib files exist in the Model directory")
        print("  3. File permissions are correct")
    
    # Start MQTT client
    start_mqtt_client()
    
    # Run Flask app
    print("\n" + "=" * 60)
    print("Flask server starting on http://localhost:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)

