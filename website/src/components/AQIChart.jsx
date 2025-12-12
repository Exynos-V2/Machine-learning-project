import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './AQIChart.css';

export const AQIChart = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="aqi-chart-container">
        <div className="chart-loading">No data available for chart</div>
      </div>
    );
  }

  // Helper function to get AQI category from AQI value
  const getAQICategory = (aqi) => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy_for_Sensitive';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very_Unhealthy';
    return 'Hazardous';
  };

  // Prepare data for chart - reverse to show chronological order
  const chartData = history
    .slice()
    .reverse()
    .map((item, index) => ({
      time: new Date(item.timestamp).toLocaleTimeString(),
      aqi: Math.round(item.aqi),
      status: item.predicted_status || getAQICategory(item.aqi), // Use predicted_status if available, otherwise calculate from AQI
      index: index
    }));

  // Get color based on AQI value
  const getColor = (aqi) => {
    if (aqi <= 50) return '#00E400';
    if (aqi <= 100) return '#FFFF00';
    if (aqi <= 150) return '#FF7E00';
    if (aqi <= 200) return '#FF0000';
    if (aqi <= 300) return '#8F3F97';
    return '#7E0023';
  };

  // Get color for status
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

  // Prepare data for status distribution pie chart
  // Use predicted_status if available, otherwise calculate from AQI value
  const statusCounts = {};
  history.forEach(item => {
    const status = item.predicted_status || getAQICategory(item.aqi);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
    color: getStatusColor(name)
  }));

  // Prepare data for AQI category distribution pie chart
  const categoryCounts = {
    'Good (0-50)': 0,
    'Moderate (51-100)': 0,
    'Unhealthy for Sensitive (101-150)': 0,
    'Unhealthy (151-200)': 0,
    'Very Unhealthy (201-300)': 0,
    'Hazardous (300+)': 0
  };

  history.forEach(item => {
    const aqi = item.aqi;
    if (aqi <= 50) categoryCounts['Good (0-50)']++;
    else if (aqi <= 100) categoryCounts['Moderate (51-100)']++;
    else if (aqi <= 150) categoryCounts['Unhealthy for Sensitive (101-150)']++;
    else if (aqi <= 200) categoryCounts['Unhealthy (151-200)']++;
    else if (aqi <= 300) categoryCounts['Very Unhealthy (201-300)']++;
    else categoryCounts['Hazardous (300+)']++;
  });

  const categoryData = Object.entries(categoryCounts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => {
      const aqiValue = parseInt(name.match(/\d+/)?.[0] || '0');
      return {
        name,
        value,
        color: getColor(aqiValue)
      };
    });

  // Custom tooltip for pie charts
  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{payload[0].name}</p>
          <p className="tooltip-value" style={{ color: payload[0].payload.color }}>
            {`Count: ${payload[0].value}`}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`Time: ${data.time}`}</p>
          <p className="tooltip-value" style={{ color: getColor(data.aqi) }}>
            {`AQI: ${data.aqi}`}
          </p>
          <p className="tooltip-status">{`Status: ${data.status.replace(/_/g, ' ')}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="aqi-chart-container">
      <h2 className="chart-title">AQI History (Real-time)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
          <XAxis 
            dataKey="time" 
            stroke="rgba(255, 255, 255, 0.7)"
            style={{ fontSize: '0.75rem' }}
          />
          <YAxis 
            stroke="rgba(255, 255, 255, 0.7)"
            label={{ value: 'AQI', angle: -90, position: 'insideLeft', fill: 'rgba(255, 255, 255, 0.7)' }}
            style={{ fontSize: '0.75rem' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ color: 'rgba(255, 255, 255, 0.8)' }}
          />
          <Line 
            type="monotone" 
            dataKey="aqi" 
            stroke="#00CED1" 
            strokeWidth={2}
            dot={{ fill: '#00CED1', r: 4 }}
            activeDot={{ r: 6 }}
            name="AQI Value"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="pie-charts-container">
        <div className="pie-chart-card">
          <div className="pie-chart-header">
            <h3 className="pie-chart-title">Status Distribution</h3>
            <p className="pie-chart-description">Based on AQI category from real-time readings</p>
          </div>
          <div className="pie-chart-content">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    innerRadius={30}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<PieTooltip />}
                    cursor={{ fill: 'transparent' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-loading">No status data available</div>
            )}
          </div>
          <div className="pie-chart-footer">
            <div className="pie-chart-footer-text">
              Showing distribution of {history.length} readings
            </div>
          </div>
        </div>

        <div className="pie-chart-card">
          <div className="pie-chart-header">
            <h3 className="pie-chart-title">AQI Category Distribution</h3>
            <p className="pie-chart-description">Based on real-time AQI value ranges</p>
          </div>
          <div className="pie-chart-content">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    innerRadius={30}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={<PieTooltip />}
                    cursor={{ fill: 'transparent' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-loading">No category data available</div>
            )}
          </div>
          <div className="pie-chart-footer">
            <div className="pie-chart-footer-text">
              Showing distribution of {history.length} AQI readings
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AQIChart;

