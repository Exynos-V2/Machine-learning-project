// Use proxy in Docker, or direct URL for local development
// In Docker, Vite proxies /api/* to flask-backend:5000
// For local dev or remote server, use full URL
// Fallback: try proxy first, then direct URL if proxy fails
let API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// If VITE_API_URL is set to a full URL (not /api), use it directly
// This allows overriding for server environments where proxy might not work
if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith('http')) {
  API_BASE_URL = import.meta.env.VITE_API_URL;
} else if (import.meta.env.VITE_API_URL === '/api') {
  // Use proxy
  API_BASE_URL = '/api';
} else {
  // Default: try proxy, but allow fallback
  API_BASE_URL = '/api';
}

// Export for debugging
if (import.meta.env.DEV) {
  console.log('API Base URL:', API_BASE_URL);
}

/**
 * Fetch latest prediction from MQTT
 */
export const getLatestPrediction = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/latest`);
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No predictions yet
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching latest prediction:', error);
    throw error;
  }
};

/**
 * Fetch prediction history
 */
export const getPredictionHistory = async (limit = 20) => {
  try {
    const response = await fetch(`${API_BASE_URL}/history?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching prediction history:', error);
    throw error;
  }
};

/**
 * Fetch real-time AQI history
 */
export const getAQIHistory = async (limit = 100) => {
  try {
    const response = await fetch(`${API_BASE_URL}/aqi-history?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching AQI history:', error);
    throw error;
  }
};

/**
 * Make a manual prediction
 */
export const makePrediction = async (aqiValue) => {
  try {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ AQI: aqiValue }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error making prediction:', error);
    throw error;
  }
};

/**
 * Check API health
 */
export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error checking health:', error);
    throw error;
  }
};

