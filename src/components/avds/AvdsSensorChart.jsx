import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchWithAuth } from '../../services/http';
import config from '../../config';
import { Activity, RefreshCw, AlertTriangle, TrendingUp, Calendar, ChevronDown } from 'lucide-react';

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Today'      },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week',  label: 'This Week'  },
  { key: 'month', label: 'This Month' },
  { key: 'custom',label: 'Custom'    },
];
const todayStr = () => { const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const daysAgo  = (n) => { const d = new Date(); d.setDate(d.getDate()-n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };

/**
 * AVDS Sensor Chart — Visualizes heat level trends over time
 * Shows multi-line chart with each sensor's heat level progression
 */

const LEVEL_COLORS = {
  1: '#6b7280', // gray-500   (No Data)
  2: '#10b981', // green-500  (Normal)
  3: '#f59e0b', // amber-500  (Slow Moving)
  4: '#ef4444', // red-500    (Critical)
};

const SENSOR_LINE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#f43f5e', '#22d3ee', '#facc15'
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-MY', { 
      month: 'short', 
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getLevelLabel = (level) => {
    if (level === 1) return 'No Data';
    if (level === 2) return 'Normal';
    if (level === 3) return 'Slow';
    if (level === 4) return 'Critical';
    return 'No Data';
  };

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="text-gray-300 text-xs font-semibold mb-2">{formatTime(label)}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-400">{entry.name}:</span>
            </div>
            <span 
              className="font-semibold px-2 py-0.5 rounded"
              style={{ 
                color: LEVEL_COLORS[entry.value] || '#9ca3af',
                backgroundColor: `${LEVEL_COLORS[entry.value] || '#9ca3af'}20`
              }}
            >
              {getLevelLabel(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AvdsSensorChart({ selectedSensors = [], refreshTrigger, height = 400 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [visibleSensors, setVisibleSensors] = useState([]);
  const [granularity, setGranularity] = useState('hourly');

  /* ── period ── */
  const [period,   setPeriod]   = useState('today');
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo,   setDateTo]   = useState(todayStr());
  const [showCustom, setShowCustom] = useState(false);
  const customRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (customRef.current && !customRef.current.contains(e.target)) setShowCustom(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${config.API_URL}/api/avds/heat-history?period=${period}`;
      if (period === 'custom') url += `&date_from=${dateFrom}&date_to=${dateTo}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setGranularity(json.granularity ?? 'hourly');
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo]);

  // Initial load + auto-refresh every 30s (today only)
  useEffect(() => { fetchHistory(); }, [fetchHistory, refreshTrigger]);
  useEffect(() => {
    if (period !== 'today') return;
    const t = setInterval(fetchHistory, 30_000);
    return () => clearInterval(t);
  }, [fetchHistory, period]);

  const handlePeriodChange = (key) => {
    if (key === 'custom') { setShowCustom(true); setPeriod('custom'); }
    else { setShowCustom(false); setPeriod(key); }
  };
  const applyCustomRange = () => { setShowCustom(false); fetchHistory(); };

  const periodLabel = () => {
    if (!data) return '';
    if (data.period === 'today')  return 'Today';
    if (data.period === 'yesterday') return 'Yesterday';
    if (data.period === 'week')   return 'Past 7 Days';
    if (data.period === 'month')  return 'Past 30 Days';
    if (data.period === 'custom' && data.range) return `${data.range.from} — ${data.range.to}`;
    return '';
  };

  // Transform data for Recharts when data changes
  useEffect(() => {
    if (!data || !data.sensors?.length || !data.hours?.length) {
      setChartData([]);
      setVisibleSensors([]);
      return;
    }

    const { hours, sensors, data: matrix } = data;

    // Determine which sensors to show
    let sensorsToShow = sensors;
    if (selectedSensors.length > 0) {
      sensorsToShow = sensors.filter(s => selectedSensors.includes(s.id));
    }

    // Limit to max 10 sensors for readability
    sensorsToShow = sensorsToShow.slice(0, 10);
    setVisibleSensors(sensorsToShow);

    // Transform to Recharts format: [{ time: "...", sensor1: level, sensor2: level, ... }, ...]
    const transformed = hours.map(hourSlot => {
      const point = { time: hourSlot };
      sensorsToShow.forEach(sensor => {
        const sensorData = matrix[String(sensor.id)] ?? {};
        point[sensor.name] = sensorData[hourSlot] ?? null;
      });
      return point;
    });

    setChartData(transformed);
  }, [data, selectedSensors]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 gap-3">
        <RefreshCw size={20} className="animate-spin" />
        <span>Loading AVDS sensor data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">
        <AlertTriangle size={18} />
        Failed to load AVDS sensor data: {error}
      </div>
    );
  }

  if (!data || !data.sensors?.length) {
    return (
      <div className="text-gray-500 text-sm text-center py-10">
        No AVDS sensors found.
      </div>
    );
  }

  if (chartData.length === 0 || visibleSensors.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-10">
        No sensor data available for charting.
      </div>
    );
  }

  const formatXAxis = (isoString) => {
    const d = new Date(isoString);
    if (granularity === 'daily')
      return d.toLocaleDateString('en-MY', { month: 'short', day: '2-digit' });
    return d.getHours().toString().padStart(2, '0') + ':00';
  };

  const formatYAxis = (value) => {
    if (value === 1) return 'No Data';
    if (value === 2) return 'Normal';
    if (value === 3) return 'Slow';
    if (value === 4) return 'Critical';
    return '';
  };

  return (
    <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-400" />
          <h3 className="text-white font-semibold text-sm">AVDS Heat Level Trends</h3>
          {loading && <RefreshCw size={14} className="text-gray-400 animate-spin" />}
        </div>

        <button 
          onClick={fetchHistory}
          className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          title="Refresh now"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Period row */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-700/30 bg-gray-800/40">
        <Calendar size={13} className="text-gray-400" />
        <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-700/50 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => handlePeriodChange(opt.key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                period === opt.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-700/60'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="relative" ref={customRef}>
            <button onClick={() => setShowCustom(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1 bg-gray-900/60 border border-gray-700/50 rounded-lg text-xs text-gray-300 hover:text-white transition-colors">
              <span>{dateFrom} — {dateTo}</span><ChevronDown size={12} />
            </button>
            {showCustom && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 min-w-[280px]">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1 font-medium">From</label>
                    <input type="date" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1 font-medium">To</label>
                    <input type="date" value={dateTo} min={dateFrom} max={todayStr()} onChange={e => setDateTo(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 outline-none" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[[3,'Last 3 Days'],[7,'Last 7 Days'],[14,'Last 14 Days'],[30,'Last 30 Days']].map(([n,lbl]) => (
                      <button key={n} onClick={() => { setDateFrom(daysAgo(n)); setDateTo(todayStr()); }}
                        className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-[10px] text-gray-300 hover:bg-gray-700 transition-colors">{lbl}</button>
                    ))}
                  </div>
                  <button onClick={applyCustomRange}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-1.5 rounded-lg transition-colors">Apply Range</button>
                </div>
              </div>
            )}
          </div>
        )}
        <span className="text-[11px] text-gray-500 ml-auto">
          {periodLabel()}{granularity && <span className="ml-1.5">({granularity})</span>}
        </span>
      </div>

      {lastFetch && (
        <p className="text-[11px] text-gray-500 px-4 py-1 border-b border-gray-700/30">
          Last updated: {lastFetch.toLocaleTimeString()}{period === 'today' && ' — auto-refreshes every 30 s'}
        </p>
      )}

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="time" 
              stroke="#9ca3af" 
              fontSize={11}
              tickFormatter={formatXAxis}
              tick={{ fill: '#9ca3af' }}
            />
            <YAxis 
              domain={[0, 5]}
              ticks={[1, 2, 3, 4]}
              stroke="#9ca3af"
              fontSize={11}
              tickFormatter={formatYAxis}
              tick={{ fill: '#9ca3af' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '11px' }}
              iconType="line"
              iconSize={12}
            />
            {visibleSensors.map((sensor, index) => (
              <Line
                key={sensor.id}
                type="monotone"
                dataKey={sensor.name}
                stroke={SENSOR_LINE_COLORS[index % SENSOR_LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Summary */}
      <div className="px-4 py-3 border-t border-gray-700/50 grid grid-cols-2 md:grid-cols-4 gap-3">
        {visibleSensors.map((sensor, index) => {
          const currentLevel = sensor.current_level ?? 1;
          const levelLabel = currentLevel === 1 ? 'No Data' : currentLevel === 2 ? 'Normal' : currentLevel === 3 ? 'Slow' : 'Critical';
          const levelColor = LEVEL_COLORS[currentLevel];
          
          return (
            <div key={sensor.id} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: SENSOR_LINE_COLORS[index % SENSOR_LINE_COLORS.length] }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 truncate">{sensor.name}</p>
                <p 
                  className="text-xs font-semibold"
                  style={{ color: levelColor }}
                >
                  {levelLabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-gray-700/50 text-[11px] text-gray-400">
        <span className="font-semibold text-gray-300">Status Levels:</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[1] }} />
          <span>No Data</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[2] }} />
          <span>Normal</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[3] }} />
          <span>Slow</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[4] }} />
          <span>Critical</span>
        </span>
      </div>
    </div>
  );
}
