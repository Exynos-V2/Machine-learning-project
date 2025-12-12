import { useState, useEffect, useRef } from 'react';
import './AQIStatus.css';
import rouletteSound from '../assets/item-roulette.mp3';

const PREDEFINED_COLORS = [
  '#00FFFF', // Bright Cyan
  '#00FF00', // Bright Green
  '#0000FF', // Pure Blue
  '#8B00FF', // Violet
  '#FF0000', // Pure Red
  '#FF8C00', // Dark Orange
  '#FFD700', // Gold
  '#FF00FF', // Magenta
  '#00FF7F', // Spring Green
  '#4B0082'  // Indigo
];

const getStatusColor = (status) => {
  const statusMap = {
    'Good': '#00E400',
    'Moderate': '#FFFF00',
    'Unhealthy_for_Sensitive': '#FF7E00',
    'Unhealthy': '#FF0000',
    'Very_Unhealthy': '#8F3F97',
    'Hazardous': '#7E0023'
  };
  return statusMap[status] || '#888';
};

const getStatusLabel = (status) => {
  return status.replace(/_/g, ' ');
};

const getAQICategory = (aqi) => {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy_for_Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very_Unhealthy';
  return 'Hazardous';
};

export const AQIStatus = ({ latestData, onColorChange, currentColor }) => {
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [gamblingColor, setGamblingColor] = useState(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const audioRef = useRef(null);

  const handleColorSelect = (color) => {
    if (onColorChange && !isRandomizing) {
      onColorChange(color);
    }
  };

  const handleRandomize = () => {
    if (isRandomizing) return; // Prevent multiple clicks during animation
    
    setIsRandomizing(true);
    let iterations = 0;
    const audioDuration = 4275; // 4 seconds in ms
    const finalDelay = 200; // ms delay before final selection
    const animationDuration = audioDuration - finalDelay; // Animation duration to match audio
    const maxIterations = 35; // Number of color cycles
    const cycleSpeed = animationDuration / maxIterations; // ms per cycle (calculated to match audio)
    const finalColor = PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)];

    // Clear any existing intervals/timeouts
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Play sound effect in sync with animation (4 seconds)
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = 1.0;
      audioRef.current.loop = false; // Don't loop, play once for 4 seconds
      audioRef.current.play().catch(err => {
        console.log('Audio play failed:', err);
      });

      // Gradually slow down the sound as animation progresses (last 30% of animation)
      const slowdownStart = Math.floor(maxIterations * 0.7);
      const slowdownInterval = setInterval(() => {
        if (iterations >= slowdownStart && iterations < maxIterations) {
          const progress = (iterations - slowdownStart) / (maxIterations - slowdownStart);
          // Slow down from 1.0 to 0.5 playback rate
          audioRef.current.playbackRate = 1.0 - (progress * 0.5);
        }
      }, cycleSpeed);

      // Stop sound exactly when animation ends (after 4 seconds)
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.playbackRate = 1.0;
        }
        clearInterval(slowdownInterval);
      }, audioDuration);
    }

    // Rapidly cycle through color swatches
    intervalRef.current = setInterval(() => {
      iterations++;
      const randomIndex = Math.floor(Math.random() * PREDEFINED_COLORS.length);
      setGamblingColor(PREDEFINED_COLORS[randomIndex]);
      
      // Slow down as we approach the end
      if (iterations >= maxIterations) {
        clearInterval(intervalRef.current);
        // Final color selection with a slight delay
        timeoutRef.current = setTimeout(() => {
          setGamblingColor(finalColor);
          handleColorSelect(finalColor);
          setIsRandomizing(false);
          setGamblingColor(null);
        }, finalDelay);
      }
    }, cycleSpeed);
  };

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(rouletteSound);
    audioRef.current.volume = 0.5; // Set volume to 50%
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const ColorPickerSection = () => (
    <div className="color-picker-section">
      <label className="color-picker-label">Background Color</label>
      <div className="color-swatches">
        {PREDEFINED_COLORS.map((color) => {
          const isGambling = isRandomizing && gamblingColor === color;
          const isActive = !isRandomizing && currentColor === color;
          return (
            <button
              key={color}
              className={`color-swatch ${isActive ? 'active' : ''} ${isGambling ? 'gambling' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => handleColorSelect(color)}
              aria-label={`Select color ${color}`}
              disabled={isRandomizing}
            />
          );
        })}
        <button
          className={`color-randomize ${isRandomizing ? 'randomizing' : ''}`}
          onClick={handleRandomize}
          title="Randomize color"
          disabled={isRandomizing}
        >
          🎲
        </button>
      </div>
    </div>
  );

  if (!latestData || latestData.aqi === null || latestData.aqi === undefined) {
    return (
      <div className="aqi-status-container">
        <div className="aqi-status-loading">Waiting for data...</div>
        <ColorPickerSection />
      </div>
    );
  }

  // Extract real-time AQI and prediction data
  const realTimeAQI = latestData.aqi;
  const prediction = latestData.prediction;
  const aqiTimestamp = latestData.aqi_timestamp;
  const predictionInterval = latestData.prediction_interval_minutes || 15;

  // Use prediction status if available, otherwise use AQI category
  const statusColor = prediction 
    ? getStatusColor(prediction.predicted_status)
    : getStatusColor(getAQICategory(realTimeAQI));
  const aqiCategory = getAQICategory(realTimeAQI);

  return (
    <div className="aqi-status-container">
      <div className="aqi-value-display">
        <div className="aqi-number" style={{ color: statusColor }}>
          {Math.round(realTimeAQI)}
        </div>
        <div className="aqi-label">AQI (Real-time)</div>
      </div>
      
      <div className="status-info">
        {prediction ? (
          <>
            <div 
              className="status-badge" 
              style={{ backgroundColor: statusColor }}
            >
              {getStatusLabel(prediction.predicted_status)}
            </div>
            <div className="category-info">
              Predicted Status (Updated every {predictionInterval} min)
            </div>
          </>
        ) : (
          <>
            <div 
              className="status-badge" 
              style={{ backgroundColor: statusColor }}
            >
              {getStatusLabel(aqiCategory)}
            </div>
            <div className="category-info">
              Category (Waiting for first prediction...)
            </div>
          </>
        )}
        <div className="category-info-secondary">
          Current Category: {getStatusLabel(aqiCategory)}
        </div>
      </div>

      {prediction && prediction.probabilities && (
        <div className="probabilities">
          <h3>Prediction Probabilities</h3>
          <div className="probability-list">
            {Object.entries(prediction.probabilities)
              .sort(([, a], [, b]) => b - a)
              .map(([status, prob]) => (
                <div key={status} className="probability-item">
                  <div className="probability-label">
                    {getStatusLabel(status)}
                  </div>
                  <div className="probability-bar-container">
                    <div 
                      className="probability-bar"
                      style={{ 
                        width: `${prob * 100}%`,
                        backgroundColor: getStatusColor(status)
                      }}
                    />
                  </div>
                  <div className="probability-value">
                    {(prob * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="timestamp-info">
        {aqiTimestamp && (
          <div className="timestamp">
            AQI Updated: {new Date(aqiTimestamp).toLocaleString()}
          </div>
        )}
        {prediction && prediction.timestamp && (
          <div className="timestamp prediction-timestamp">
            Prediction Updated: {new Date(prediction.timestamp).toLocaleString()}
            <span className="prediction-interval-badge">
              (Every {predictionInterval} min)
            </span>
          </div>
        )}
        {!prediction && (
          <div className="timestamp waiting-prediction">
            ⏳ Waiting for first prediction (runs every {predictionInterval} minutes)
          </div>
        )}
      </div>

      <ColorPickerSection />
    </div>
  );
};

export default AQIStatus;

