import { useState, useEffect, useRef } from 'react';
import './AQIStatus.css';
import rouletteSound from '../assets/item-roulette.mp3';

const PREDEFINED_COLORS = [
  '#00CED1', // Cyan
  '#00E400', // Green
  '#4A90E2', // Blue
  '#9B59B6', // Purple
  '#E74C3C', // Red
  '#F39C12', // Orange
  '#1ABC9C', // Turquoise
  '#E91E63', // Pink
  '#00BCD4', // Light Blue
  '#8E44AD'  // Dark Purple
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

export const AQIStatus = ({ prediction, onColorChange, currentColor }) => {
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

  if (!prediction) {
    return (
      <div className="aqi-status-container">
        <div className="aqi-status-loading">Waiting for data...</div>
        <ColorPickerSection />
      </div>
    );
  }

  const { aqi, predicted_status, probabilities } = prediction;
  const statusColor = getStatusColor(predicted_status);
  const aqiCategory = getAQICategory(aqi);

  return (
    <div className="aqi-status-container">
      <div className="aqi-value-display">
        <div className="aqi-number" style={{ color: statusColor }}>
          {Math.round(aqi)}
        </div>
        <div className="aqi-label">AQI</div>
      </div>
      
      <div className="status-info">
        <div 
          className="status-badge" 
          style={{ backgroundColor: statusColor }}
        >
          {getStatusLabel(predicted_status)}
        </div>
        <div className="category-info">
          Category: {getStatusLabel(aqiCategory)}
        </div>
      </div>

      {probabilities && (
        <div className="probabilities">
          <h3>Prediction Probabilities</h3>
          <div className="probability-list">
            {Object.entries(probabilities)
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

      {prediction.timestamp && (
        <div className="timestamp">
          Last updated: {new Date(prediction.timestamp).toLocaleString()}
        </div>
      )}

      <ColorPickerSection />
    </div>
  );
};

export default AQIStatus;

