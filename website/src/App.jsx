import { useState, useEffect, useCallback } from 'react'
import './App.css'
import Plasma from './Plasma'
import AQIStatus from './components/AQIStatus'
import AQIChart from './components/AQIChart'
import { getLatestPrediction, getPredictionHistory } from './services/api'

function App() {
  const [latestPrediction, setLatestPrediction] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [plasmaColor, setPlasmaColor] = useState('#00CED1')

  const fetchLatestData = useCallback(async () => {
    try {
      const latest = await getLatestPrediction()
      if (latest) {
        setLatestPrediction(latest)
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('waiting')
      }
      setError(null)
    } catch (err) {
      console.error('Error fetching latest data:', err)
      setError('Failed to connect to API. Make sure the Flask server is running on http://localhost:5000')
      setConnectionStatus('error')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const historyData = await getPredictionHistory(20)
      if (historyData && historyData.history) {
        setHistory(historyData.history)
      }
    } catch (err) {
      console.error('Error fetching history:', err)
    }
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchLatestData()
    fetchHistory()

    // Set up polling for real-time updates (every 2 seconds)
    const interval = setInterval(() => {
      fetchLatestData()
      fetchHistory()
    }, 2000)

    return () => clearInterval(interval)
  }, [fetchLatestData, fetchHistory])

  return (
    <div className="app-container">
      <div className="plasma-background">
        <Plasma 
          color={plasmaColor}
          speed={1}
          direction="forward"
          scale={1}
          opacity={0.8}
          mouseInteractive={true}
        />
      </div>
      <div className="app-content">
        <header className="app-header">
          <h1>Air Quality Index Monitor</h1>
          <div className={`connection-status ${connectionStatus}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {connectionStatus === 'connected' && 'Connected'}
              {connectionStatus === 'waiting' && 'Waiting for data...'}
              {connectionStatus === 'error' && 'Connection Error'}
              {connectionStatus === 'disconnected' && 'Disconnected'}
            </span>
          </div>
        </header>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading data...</p>
          </div>
        ) : (
          <div className="dashboard-grid">
            <AQIStatus prediction={latestPrediction} onColorChange={setPlasmaColor} currentColor={plasmaColor} />
            <AQIChart history={history} />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
