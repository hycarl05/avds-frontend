import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { fetchWithAuth } from '../../services/http';
import config from '../../config';
import { 
  RefreshCw, AlertTriangle, TrendingUp, Car, Gauge, 
  PieChart, Calendar, ChevronDown, Search, CheckSquare, Square,
  X as IconX, SlidersHorizontal, Clock
} from 'lucide-react';

const SENSOR_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
  '#14b8a6','#f43f5e','#a855f7','#0ea5e9','#22c55e',
  '#eab308','#64748b','#d946ef','#fb923c','#38bdf8',
];

const PERIOD_OPTIONS = [
  { key: 'today',  label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week',   label: 'This Week' },
  { key: 'month',  label: 'This Month' },
  { key: 'custom', label: 'Custom Range' },
];

const MAX_CHART_SENSORS = 10; // more than 10 lines gets unreadable
function CustomTooltip({ active, payload, label, granularity }) {
  if (!active || !payload?.length) return null;
  const formatTime = (iso) => {
    const d = new Date(iso);
    if (granularity === 'daily')
      return d.toLocaleDateString('en-MY', { month: 'short', day: '2-digit', year: 'numeric' });
    return d.toLocaleTimeString('en-MY', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true });
  };
  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm max-w-xs">
      <p className="text-gray-300 text-xs font-semibold mb-2">{formatTime(label)}</p>
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-400 truncate">{entry.name}:</span>
            </div>
            <span className="font-semibold text-white whitespace-nowrap">
              {entry.value != null ? entry.value : ''}
              {entry.name.includes('Speed') && ' km/h'}
              {entry.name.includes('Occ') && '%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
function toDateInput(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const todayStr  = ()  => toDateInput(new Date());
const daysAgo   = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toDateInput(d); };

function SensorPicker({ sensors, picked, onChange }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const filtered = sensors.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.ip_address || '').includes(search)
  );

  const toggle = (id) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  const selectAll   = () => onChange(new Set(filtered.map(s => s.id)));
  const clearAll    = () => onChange(new Set());

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/60 border border-gray-700/50 rounded-lg
          text-xs text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
      >
        <SlidersHorizontal size={13} />
        <span>Sensors</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
          picked.size === 0    ? 'bg-gray-700 text-gray-400' :
          picked.size > MAX_CHART_SENSORS ? 'bg-orange-500/80 text-white' : 'bg-indigo-600 text-white'
        }`}>
          {picked.size === 0 ? `All (${sensors.length})` : `${picked.size} / ${sensors.length}`}
        </span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 bg-gray-900 border border-gray-700 rounded-xl
          shadow-2xl w-72 flex flex-col" style={{ maxHeight: '420px' }}>
          {/* header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-300">Select Sensors</span>
            <div className="flex items-center gap-2">
              <button onClick={selectAll}  className="text-[10px] text-indigo-400 hover:text-indigo-300">All</button>
              <span className="text-gray-700">|</span>
              <button onClick={clearAll}   className="text-[10px] text-gray-400 hover:text-gray-300">Clear</button>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white ml-1">
                <IconX size={13} />
              </button>
            </div>
          </div>
          {/* search */}
          <div className="px-3 py-2 border-b border-gray-800">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or IP¦"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 bg-gray-800 border border-gray-700/50 rounded-lg text-xs text-white
                  placeholder-gray-600 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
          {/* note when too many selected */}
          {picked.size > MAX_CHART_SENSORS && (
            <div className="px-3 py-1.5 bg-orange-500/10 border-b border-orange-700/30 text-[10px] text-orange-400">
              Chart shows first {MAX_CHART_SENSORS} of {picked.size} selected (for readability)
            </div>
          )}
          {/* list */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: '280px' }}>
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">No sensors match</p>
            ) : (
              filtered.map(s => {
                const on = picked.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left
                      hover:bg-gray-800/70 transition-colors border-b border-gray-800/30 last:border-0
                      ${on ? 'bg-indigo-900/20' : ''}`}
                  >
                    {on
                      ? <CheckSquare size={14} className="text-indigo-400 flex-shrink-0" />
                      : <Square      size={14} className="text-gray-600    flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-200 truncate">{s.name}</p>
                      {s.ip_address && <p className="text-[10px] text-gray-500">{s.ip_address}</p>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AvdsTrafficChart({ refreshTrigger, height = 380 }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [activeMetric, setActiveMetric] = useState('volume');

  const [pickedIds, setPickedIds] = useState(new Set()); // empty = all

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

  const fetchAnalytics = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let url = `${config.API_URL}/api/avds/traffic-analytics?period=${period}`;
      if (period === 'custom') url += `&date_from=${dateFrom}&date_to=${dateTo}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`); }
      setData(await res.json());
      setLastFetch(new Date());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [period, dateFrom, dateTo]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics, refreshTrigger]);
  useEffect(() => {
    if (period !== 'today') return;
    const t = setInterval(fetchAnalytics, 60_000);
    return () => clearInterval(t);
  }, [fetchAnalytics, period]);

  const allSensors = data?.sensors ?? [];

  const displaySensors = useMemo(() => {
    if (!allSensors.length) return [];
    if (pickedIds.size === 0) return allSensors; // "all" mode
    return allSensors.filter(s => pickedIds.has(s.id));
  }, [allSensors, pickedIds]);

  // Chart limited to MAX_CHART_SENSORS
  const chartSensors = useMemo(() => displaySensors.slice(0, MAX_CHART_SENSORS), [displaySensors]);

  const chartData = useMemo(() => {
    const slots = data?.slots ?? [];
    if (!slots.length || !chartSensors.length) return [];
    return slots.map(slot => {
      const point = { time: slot };
      chartSensors.forEach(sensor => {
        const t = data.traffic[String(sensor.id)]?.[slot] ?? { volume: 0, avg_speed: 0, occupancy: 0 };
        point[`${sensor.id}_volume`]    = t.volume;
        point[`${sensor.id}_speed`]     = t.avg_speed;
        point[`${sensor.id}_occupancy`] = t.occupancy;
      });
      return point;
    });
  }, [data, chartSensors, activeMetric]);

  const handlePeriodChange = (key) => {
    if (key === 'custom') { setShowCustom(true); setPeriod('custom'); }
    else { setShowCustom(false); setPeriod(key); }
  };
  const applyCustomRange = () => { setShowCustom(false); fetchAnalytics(); };

  const formatXAxis = (iso) => {
    const d = new Date(iso);
    if (data?.granularity === 'daily') return d.toLocaleDateString('en-MY', { month: 'short', day: '2-digit' });
    return d.getHours().toString().padStart(2, '0') + ':00';
  };

  const periodLabel = () => {
    if (!data) return '';
    if (data.period === 'today')  return 'Today';
    if (data.period === 'yesterday') return 'Yesterday';
    if (data.period === 'week')   return 'Past 7 Days';
    if (data.period === 'month')  return 'Past 30 Days';
    if (data.period === 'custom' && data.range) return `${data.range.from} to ${data.range.to}`;
    return '';
  };

  if (loading && !data) return (
    <div className="flex items-center justify-center py-12 text-gray-400 gap-3">
      <RefreshCw size={20} className="animate-spin" /><span>Loading traffic analytics¦</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">
      <AlertTriangle size={18} />Failed to load traffic analytics: {error}
    </div>
  );

  if (!data || !allSensors.length) return (
    <div className="text-gray-500 text-sm text-center py-10">No AVDS sensors with IP addresses found.</div>
  );

  const latestSlot = data.slots?.[data.slots.length - 1];

  return (
    <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-400" />
          <h3 className="text-white font-semibold text-sm">AVDS Traffic Analytics</h3>
          {loading && <RefreshCw size={14} className="text-gray-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Metric buttons */}
          <div className="flex items-center gap-1 bg-gray-900/60 border border-gray-700/50 rounded-lg p-1">
            {[
              { key: 'volume',    label: 'Volume',    Icon: Car,      active: 'bg-blue-600' },
              { key: 'speed',     label: 'Speed',     Icon: Gauge,    active: 'bg-green-600' },
              { key: 'occupancy', label: 'Occupancy', Icon: PieChart, active: 'bg-orange-600' },
            ].map(({ key, label, Icon, active }) => (
              <button key={key} onClick={() => setActiveMetric(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  activeMetric === key ? `${active} text-white` : 'text-gray-400 hover:text-white hover:bg-gray-700/60'
                }`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
          {/* Sensor picker */}
          <SensorPicker sensors={allSensors} picked={pickedIds} onChange={setPickedIds} />
          <button onClick={fetchAnalytics}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700 transition-colors" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

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
              <span>{dateFrom} to {dateTo}</span><ChevronDown size={12} />
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
          {periodLabel()}{data?.granularity && <span className="ml-1.5">({data.granularity})</span>}
        </span>
      </div>

      {lastFetch && (
        <p className="text-[11px] text-gray-500 px-4 py-1 border-b border-gray-700/30">
          Last updated: {lastFetch.toLocaleTimeString()}{period === 'today' && ' auto-refreshes every 60 s'}
          <span className="ml-3 text-gray-600">Showing {displaySensors.length} of {allSensors.length} sensors</span>
        </p>
      )}

      {data?.data_stale && data?.data_note && (
        <div className="mx-4 mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5">
          <Clock size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-400">Showing historical data</p>
            <p className="text-[11px] text-amber-300/70 mt-0.5">{data.data_note}</p>
          </div>
        </div>
      )}

      {displaySensors.length > MAX_CHART_SENSORS && (
        <div className="mx-4 mt-3 px-3 py-1.5 bg-orange-500/10 border border-orange-700/30 rounded-lg text-[11px] text-orange-400">
          Chart shows first {MAX_CHART_SENSORS} of {displaySensors.length} selected sensors. Use the Sensors picker to narrow down.
        </div>
      )}

      <div className="p-4">
        {chartData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-gray-500 text-sm">No time slots in range.</div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {activeMetric === 'volume' ? (
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} tickFormatter={formatXAxis} tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }}
                  label={{ value: 'Vehicles', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 11 } }} />
                <Tooltip content={<CustomTooltip granularity={data?.granularity} />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} iconType="rect" iconSize={12} />
                {chartSensors.map((sensor, i) => (
                  <Bar key={sensor.id} dataKey={`${sensor.id}_volume`}
                    fill={SENSOR_COLORS[i % SENSOR_COLORS.length]}
                    name={sensor.name} stackId="a" />
                ))}
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} tickFormatter={formatXAxis} tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }}
                  label={{ value: activeMetric === 'speed' ? 'km/h' : '%', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 11 } }} />
                <Tooltip content={<CustomTooltip granularity={data?.granularity} />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} iconType="line" iconSize={12} />
                {chartSensors.map((sensor, i) => (
                  <Line key={sensor.id} type="monotone"
                    dataKey={`${sensor.id}_${activeMetric === 'speed' ? 'speed' : 'occupancy'}`}
                    stroke={SENSOR_COLORS[i % SENSOR_COLORS.length]}
                    strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}
                    name={sensor.name} connectNulls />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {displaySensors.length > 0 && latestSlot && (
        <div className="border-t border-gray-700/50">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300">Sensor Stats Latest Slot</span>
            <span className="text-[10px] text-gray-500">{displaySensors.length} sensors</span>
          </div>
          <div className="overflow-auto" style={{ maxHeight: '260px' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-900/80 backdrop-blur-sm">
                <tr className="border-b border-gray-700/50">
                  <th className="text-left px-4 py-2 text-gray-500 font-medium uppercase tracking-wider text-[10px]">Sensor</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium uppercase tracking-wider text-[10px]">IP</th>
                  <th className="text-right px-3 py-2 text-blue-400/70 font-medium uppercase tracking-wider text-[10px]">Volume</th>
                  <th className="text-right px-3 py-2 text-green-400/70 font-medium uppercase tracking-wider text-[10px]">Avg Speed</th>
                  <th className="text-right px-4 py-2 text-orange-400/70 font-medium uppercase tracking-wider text-[10px]">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {displaySensors.map((sensor, i) => {
                  const t = data.traffic[String(sensor.id)]?.[latestSlot];
                  const hasData = !!t && (t.volume > 0 || t.avg_speed > 0 || t.occupancy > 0);
                  return (
                    <tr key={sensor.id}
                      className="border-b border-gray-800/40 hover:bg-gray-700/20 transition-colors">
                      <td className="px-4 py-2.5 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: i < MAX_CHART_SENSORS ? SENSOR_COLORS[i % SENSOR_COLORS.length] : '#4b5563' }} />
                        <span className="text-gray-200 truncate max-w-[180px]">{sensor.name}</span>
                        {i >= MAX_CHART_SENSORS && (
                          <span className="text-[9px] text-gray-600 border border-gray-700 rounded px-1">not in chart</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">{sensor.ip_address || ''}</td>
                      {hasData ? (
                        <>
                          <td className="px-3 py-2.5 text-right text-blue-400 font-semibold">{t.volume}</td>
                          <td className="px-3 py-2.5 text-right text-green-400 font-semibold">{t.avg_speed} km/h</td>
                          <td className="px-4 py-2.5 text-right text-orange-400 font-semibold">{t.occupancy}%</td>
                        </>
                      ) : (
                        <td colSpan={3} className="px-3 py-2.5 text-right text-gray-600 italic">No data available</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-gray-700/30 text-[11px] text-gray-400">
        <span className="font-semibold text-gray-300">Metrics:</span>
        <span className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-blue-400" />Volume (vehicles)</span>
        <span className="flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-green-400" />Avg Speed (km/h)</span>
        <span className="flex items-center gap-1.5"><PieChart className="w-3.5 h-3.5 text-orange-400" />Occupancy (%)</span>
      </div>
    </div>
  );
}

