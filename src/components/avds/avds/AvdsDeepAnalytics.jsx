/**
 * AvdsDeepAnalytics.jsx
 *
 * Reads from interval_data (12 M rows) via /api/avds/deep-analytics to surface
 * the richest possible traffic insight per sensor:
 *   • Per-lane volume / avg-speed / occupancy / congestion-mins
 *   • 24-hour hourly volume + speed heatmap
 *   • Congestion minutes (occ > 25 % or speed < 20 km/h)
 *   • Data-coverage percentage
 *   • Optional P85 speed (only if source table provides it)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid,
  Tooltip as ReTooltip, Cell,
} from 'recharts';
import {
  RefreshCw, AlertTriangle, Calendar, ChevronDown, ChevronUp,
  Activity, TrendingUp, Database, Info, Car, Gauge, Clock,
  Shield, BarChart3, TrendingDown,
} from 'lucide-react';
import { fetchWithAuth } from '../../services/http';
import config from '../../config';

// ── helpers ───────────────────────────────────────────────────────────────
const toDateInput = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayStr = () => toDateInput(new Date());
const daysAgo  = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toDateInput(d); };

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Today'  },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week',  label: '7 Days' },
  { key: 'month', label: '30 Days'},
  { key: 'custom',label: 'Custom' },
];

// ── colour helpers ─────────────────────────────────────────────────────────
const HEAT_STYLES = {
  1: { badge: 'bg-gray-500/20 border-gray-500/40 text-gray-400',         dot: '#6b7280', label: 'No Data'  },
  2: { badge: 'bg-green-500/20 border-green-500/40 text-green-400',       dot: '#22c55e', label: 'Normal'  },
  3: { badge: 'bg-amber-500/20 border-amber-500/40 text-amber-400',       dot: '#f59e0b', label: 'Slow'    },
  4: { badge: 'bg-red-500/20 border-red-500/40 text-red-400',             dot: '#ef4444', label: 'Critical'},
};

// Volume-intensity colour scale for the 24-h heatmap bars
const volumeColor = (v, maxV) => {
  if (!maxV || maxV === 0) return '#374151';
  const ratio = v / maxV;
  if (ratio < 0.2)  return '#1e3a5f';
  if (ratio < 0.4)  return '#1d4ed8';
  if (ratio < 0.6)  return '#2563eb';
  if (ratio < 0.75) return '#f59e0b';
  return '#ef4444';
};

const speedColor = (speed) => {
  if (speed == null) return '#4b5563';
  if (speed >= 80)   return '#22c55e';
  if (speed >= 60)   return '#84cc16';
  if (speed >= 40)   return '#f59e0b';
  if (speed >= 20)   return '#f97316';
  return '#ef4444';
};

const fmt = (v, dec = 1) => (v != null ? Number(v).toFixed(dec) : '—');

// ── Hourly trend mini chart ────────────────────────────────────────────────
function HourlyTrendChart({ data, peakHour }) {
  const maxVol = Math.max(...data.map(d => d.volume), 1);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
          24-Hour Volume Distribution
        </span>
        {peakHour != null && (
          <span className="text-[10px] text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
            Peak {String(peakHour).padStart(2, '0')}:00
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={data} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 9, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
            tickFormatter={h => (h % 4 === 0 ? `${String(h).padStart(2,'0')}h` : '')}
          />
          <YAxis hide />
          <ReTooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11, padding: '6px 10px' }}
            labelFormatter={h => `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`}
            formatter={(value, name) => {
              if (name === 'volume') return [value.toLocaleString(), 'Vehicles'];
              return [value, name];
            }}
          />
          <Bar dataKey="volume" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.hour}
                fill={d.hour === peakHour ? '#f59e0b' : volumeColor(d.volume, maxVol)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Volume + occupancy horizon below the chart */}
      <div className="flex mt-1 rounded overflow-hidden h-3">
        {data.map(d => (
          <div
            key={d.hour}
            title={`${String(d.hour).padStart(2,'0')}:00 — occ ${fmt(d.avg_occ)}%`}
            className="flex-1"
            style={{ backgroundColor: d.avg_occ != null
              ? d.avg_occ > 30 ? '#ef4444' : d.avg_occ > 15 ? '#f97316' : '#22c55e22'
              : '#1f2937'
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-0.5 text-[9px] text-gray-600">
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span>
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[9px] text-gray-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-blue-700" />Volume bar</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-amber-500" />Peak hour</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-green-500/30" />Low occupancy | </span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-orange-500" />Mod |</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-red-500" />High occupancy</span>
      </div>
    </div>
  );
}

// ── Lane breakdown table ───────────────────────────────────────────────────
function LaneTable({ lanes, expectedMinutes, hasP85Data }) {
  if (!lanes || lanes.length === 0) return (
    <p className="text-xs text-gray-500 italic mt-3">No lane data available for this period.</p>
  );
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-700/60">
            <th className="text-left py-1.5 pr-3 text-gray-500 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">Lane</th>
            <th className="text-right py-1.5 px-2 text-blue-400/70 font-semibold uppercase tracking-wider text-[10px]">Volume</th>
            <th className="text-right py-1.5 px-2 text-green-400/70 font-semibold uppercase tracking-wider text-[10px]">Avg Speed</th>
            <th className="text-right py-1.5 px-2 text-cyan-400/70 font-semibold uppercase tracking-wider text-[10px]">Min Speed</th>
            <th className="text-right py-1.5 px-2 text-indigo-300/70 font-semibold uppercase tracking-wider text-[10px]">Max Speed</th>
            {hasP85Data && (
              <th className="text-right py-1.5 px-2 text-indigo-400/70 font-semibold uppercase tracking-wider text-[10px]">P85 Speed</th>
            )}
            <th className="text-right py-1.5 px-2 text-orange-400/70 font-semibold uppercase tracking-wider text-[10px]">Avg Occ</th>
            <th className="text-right py-1.5 px-2 text-red-400/70 font-semibold uppercase tracking-wider text-[10px]">Cong. Mins</th>
            <th className="text-right py-1.5 pl-2 text-gray-500 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {lanes.map(lane => {
            const cov = expectedMinutes > 0
              ? Math.min(100, Math.round(lane.minute_count / expectedMinutes * 100))
              : 0;
            const speedGap = hasP85Data && lane.p85_speed > 0
              ? (lane.p85_speed - lane.avg_speed).toFixed(1)
              : null;
            return (
              <tr key={lane.lane_no} className="border-b border-gray-800/40 hover:bg-gray-700/10 transition-colors">
                <td className="py-2 pr-3 text-gray-200 font-medium whitespace-nowrap">
                  {lane.lane_name || `Lane ${lane.lane_no}`}
                </td>
                <td className="py-2 px-2 text-right text-blue-400 font-semibold">{lane.volume.toLocaleString()}</td>
                <td className="py-2 px-2 text-right">
                  <span style={{ color: speedColor(lane.avg_speed) }} className="font-semibold">
                    {fmt(lane.avg_speed)} <span className="text-gray-500 font-normal">km/h</span>
                  </span>
                </td>
                <td className="py-2 px-2 text-right">
                  <span className="text-cyan-400 font-semibold">{fmt(lane.min_speed)}</span>
                  <span className="text-gray-500"> km/h</span>
                </td>
                <td className="py-2 px-2 text-right">
                  <span className="text-indigo-300 font-semibold">{fmt(lane.max_speed)}</span>
                  <span className="text-gray-500"> km/h</span>
                </td>
                {hasP85Data && (
                  <td className="py-2 px-2 text-right">
                    <div>
                      <span className="text-indigo-400 font-semibold">{fmt(lane.p85_speed)}</span>
                      <span className="text-gray-500"> km/h</span>
                    </div>
                    {speedGap !== null && (
                      <div className="text-[10px] text-gray-500">
                        gap +{speedGap} km/h
                      </div>
                    )}
                  </td>
                )}
                <td className="py-2 px-2 text-right">
                  <span className={lane.avg_occupancy > 25 ? 'text-red-400 font-semibold' : lane.avg_occupancy > 15 ? 'text-orange-400 font-semibold' : 'text-green-400'}>
                    {fmt(lane.avg_occupancy)}%
                  </span>
                </td>
                <td className="py-2 px-2 text-right">
                  {lane.congestion_minutes > 0 ? (
                    <span className="text-red-400 font-semibold">{lane.congestion_minutes} min</span>
                  ) : (
                    <span className="text-green-400">0 min</span>
                  )}
                </td>
                <td className="py-2 pl-2 text-right">
                  <span className={cov < 70 ? 'text-red-400' : cov < 90 ? 'text-orange-400' : 'text-green-400'}>
                    {cov}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Single sensor expansion card ───────────────────────────────────────────
function SensorCard({ sensor, expectedMinutes, hasP85Data, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hs  = HEAT_STYLES[sensor.current_level] ?? HEAT_STYLES[1];
  const s   = sensor.stats;

  const p85Badge = s.speed_vs_p85_ratio != null
    ? s.speed_vs_p85_ratio < 75
      ? { label: 'High Spread', cls: 'bg-red-500/20 border-red-500/30 text-red-400' }
      : s.speed_vs_p85_ratio < 85
        ? { label: 'Moderate', cls: 'bg-orange-500/20 border-orange-500/30 text-orange-400' }
        : { label: 'Normal', cls: 'bg-green-500/20 border-green-500/30 text-green-400' }
    : null;

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
      {/* ── Card header ── */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-700/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Heat badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0 ${hs.badge}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hs.dot }} />
            {hs.label}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{sensor.name}</p>
            <p className="text-[11px] text-gray-500">
              {sensor.zone?.name && <span className="mr-2">{sensor.zone.name}</span>}
              {sensor.ip_address && <span className="font-mono text-gray-600">{sensor.ip_address}</span>}
            </p>
          </div>
        </div>

        {/* Quick stats (always visible) */}
        <div className="hidden sm:flex items-center gap-4 text-xs mr-4 flex-shrink-0">
          <span className="text-center">
            <div className="text-blue-400 font-bold">{s.total_volume.toLocaleString()}</div>
            <div className="text-gray-600 text-[10px]">vehicles</div>
          </span>
          <span className="text-center">
            <div style={{ color: speedColor(s.avg_speed) }} className="font-bold">{fmt(s.avg_speed)}</div>
            <div className="text-gray-600 text-[10px]">avg km/h</div>
          </span>
          <span className="text-center">
            <div className="text-indigo-400 font-bold">
              {hasP85Data ? fmt(s.p85_speed) : `${fmt(s.min_speed)} / ${fmt(s.max_speed)}`}
            </div>
            <div className="text-gray-600 text-[10px]">{hasP85Data ? 'P85 km/h' : 'min/max km/h'}</div>
          </span>
          <span className="text-center">
            <div className={s.congestion_minutes > 0 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
              {s.congestion_minutes}
            </div>
            <div className="text-gray-600 text-[10px]">cong. min</div>
          </span>
          {hasP85Data && p85Badge && (
            <span className={`hidden lg:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${p85Badge.cls}`}>
              {p85Badge.label}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700/40 pt-3 space-y-4">

          {/* ── KPI chips ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              {
                label: 'Total Volume', value: s.total_volume.toLocaleString(), unit: 'vehicles',
                cls: 'bg-blue-500/10 border-blue-500/30', valCls: 'text-blue-400',
              },
              {
                label: 'Avg Speed', value: fmt(s.avg_speed), unit: 'km/h',
                cls: 'bg-green-500/10 border-green-500/30', valCls: 'text-green-400',
              },
              ...(hasP85Data ? [{
                label: 'P85 Speed', value: fmt(s.p85_speed), unit: 'km/h',
                cls: 'bg-indigo-500/10 border-indigo-500/30', valCls: 'text-indigo-400',
                hint: 'Speed at or below which 85% of vehicles travel. Used for speed-limit studies.',
              }] : [{
                label: 'Min Speed', value: fmt(s.min_speed), unit: 'km/h',
                cls: 'bg-indigo-500/10 border-indigo-500/30', valCls: 'text-indigo-300',
              }, {
                label: 'Max Speed', value: fmt(s.max_speed), unit: 'km/h',
                cls: 'bg-indigo-500/10 border-indigo-500/30', valCls: 'text-indigo-400',
              }]),
              {
                label: 'Avg Occupancy', value: fmt(s.avg_occupancy), unit: '%',
                cls: s.avg_occupancy > 25 ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/10 border-orange-500/30',
                valCls: s.avg_occupancy > 25 ? 'text-red-400' : 'text-orange-400',
              },
              {
                label: 'Congestion', value: String(s.congestion_minutes), unit: 'minutes',
                cls: s.congestion_minutes > 10 ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-800/60 border-gray-700/50',
                valCls: s.congestion_minutes > 10 ? 'text-red-400' : 'text-gray-300',
                hint: 'Minutes where occupancy > 25% or speed < 20 km/h',
              },
              {
                label: 'Data Coverage', value: fmt(s.coverage_pct), unit: '%',
                cls: s.coverage_pct < 70 ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-800/60 border-gray-700/50',
                valCls: s.coverage_pct < 70 ? 'text-red-400' : s.coverage_pct < 90 ? 'text-orange-400' : 'text-green-400',
                hint: 'Percentage of expected minutes that have sensor readings',
              },
            ].map(chip => (
              <div key={chip.label} className={`border rounded-lg p-3 flex flex-col gap-0.5 ${chip.cls}`}>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{chip.label}</span>
                  {chip.hint && (
                    <span title={chip.hint} className="cursor-help">
                      <Info size={10} className="text-gray-600" />
                    </span>
                  )}
                </div>
                <span className={`text-xl font-bold leading-tight ${chip.valCls}`}>{chip.value}</span>
                <span className="text-[10px] text-gray-600">{chip.unit}</span>
              </div>
            ))}
          </div>

          {/* ── Speed-vs-P85 ratio explanation bar ──────────────────────── */}
          {hasP85Data && s.speed_vs_p85_ratio != null && (
            <div className="bg-gray-900/50 border border-gray-700/40 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Gauge size={13} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-gray-300">Speed Compliance Ratio (Avg / P85)</span>
                  <span title="Ratio of average speed to P85 speed. A ratio below 75% means most drivers are going much slower than the fastest 15% — indicating speed non-uniformity or incidents.">
                    <Info size={11} className="text-gray-600 cursor-help" />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{s.speed_vs_p85_ratio}%</span>
                  {p85Badge && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${p85Badge.cls}`}>
                      {p85Badge.label}
                    </span>
                  )}
                </div>
              </div>
              <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, s.speed_vs_p85_ratio)}%`,
                    backgroundColor: s.speed_vs_p85_ratio < 75 ? '#ef4444' : s.speed_vs_p85_ratio < 85 ? '#f97316' : '#22c55e',
                  }}
                />
                {/* threshold markers */}
                <div className="absolute h-full w-px bg-orange-500/60" style={{ left: '75%' }} />
                <div className="absolute h-full w-px bg-green-500/60"  style={{ left: '85%' }} />
              </div>
              <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                <span>0%</span>
                <span className="text-orange-500/60">75% — concern</span>
                <span className="text-green-500/60">85% — normal</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* ── Lane breakdown ──────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={13} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-300">Lane-by-Lane Breakdown</span>
              <span className="text-[10px] text-gray-600">
                — from raw interval_data{hasP85Data ? ' (incl. P85 speed per lane)' : ''}
              </span>
            </div>
            <LaneTable lanes={sensor.lanes} expectedMinutes={expectedMinutes} hasP85Data={hasP85Data} />
          </div>

          {/* ── Hourly trend ────────────────────────────────────────────── */}
          <div>
            <HourlyTrendChart data={sensor.hourly_trend} peakHour={sensor.peak_hour?.hour} />
          </div>

          {/* ── Additional metrics row ──────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 pt-1">
            {[
              { icon: Clock,    color: 'text-gray-400', label: 'Low-speed minutes (<20 km/h)', value: `${s.low_speed_minutes ?? 0} min` },
              { icon: TrendingDown, color: 'text-cyan-400', label: 'Min speed recorded',        value: `${fmt(s.min_speed)} km/h` },
              { icon: Activity, color: 'text-purple-400', label: 'Max occupancy recorded',       value: `${fmt(s.max_occupancy)}%` },
              { icon: TrendingUp, color: 'text-indigo-400', label: 'Max speed recorded',         value: `${fmt(s.max_speed)} km/h` },
              { icon: Database, color: 'text-gray-500',   label: 'Minute readings in DB',       value: s.data_minutes.toLocaleString() },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-2 bg-gray-900/40 border border-gray-700/30 rounded-lg px-3 py-2">
                <m.icon size={13} className={m.color} />
                <div>
                  <div className="text-[10px] text-gray-500">{m.label}</div>
                  <div className="text-xs font-semibold text-gray-200">{m.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export default function AvdsDeepAnalytics({ refreshTrigger }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [lastFetch,  setLastFetch]  = useState(null);

  const [period,     setPeriod]     = useState('today');
  const [dateFrom,   setDateFrom]   = useState(todayStr());
  const [dateTo,     setDateTo]     = useState(todayStr());
  const [showCustom, setShowCustom] = useState(false);
  const customRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (customRef.current && !customRef.current.contains(e.target)) setShowCustom(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let url = `${config.API_URL}/api/avds/deep-analytics?period=${period}`;
      if (period === 'custom') url += `&date_from=${dateFrom}&date_to=${dateTo}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`); }
      setData(await res.json());
      setLastFetch(new Date());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [period, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData, refreshTrigger]);
  useEffect(() => {
    if (period !== 'today') return;
    const t = setInterval(fetchData, 90_000);
    return () => clearInterval(t);
  }, [fetchData, period]);

  const handlePeriodChange = (key) => {
    if (key === 'custom') { setPeriod('custom'); setShowCustom(true); }
    else { setPeriod(key); setShowCustom(false); }
  };
  const applyCustomRange = () => { setShowCustom(false); fetchData(); };

  const periodLabel = () => {
    if (!data) return '';
    if (data.period === 'today')  return 'Today';
    if (data.period === 'yesterday') return 'Yesterday';
    if (data.period === 'week')   return 'Past 7 Days';
    if (data.period === 'month')  return 'Past 30 Days';
    if (data.period === 'custom' && data.range) return `${data.range.from} → ${data.range.to}`;
    return '';
  };

  // Expected minutes per sensor for coverage calc
  const expectedMinutes = useMemo(() => {
    if (!data?.range) return 1440; // default 1 day
    const from = new Date(data.range.from);
    const to   = new Date(data.range.to);
    return Math.max(1, Math.round((to - from) / 60000) + 1440); // +1 day bc end is inclusive
  }, [data]);

  // Aggregate KPIs across all sensors
  const hasP85Data = useMemo(() => {
    if (!data?.sensors?.length) return false;
    return data.sensors.some((sensor) =>
      sensor?.stats?.p85_speed != null ||
      sensor?.stats?.speed_vs_p85_ratio != null ||
      (sensor?.lanes || []).some((lane) => lane?.p85_speed != null)
    );
  }, [data]);

  const globalKpis = useMemo(() => {
    if (!data?.sensors?.length) return null;
    const sensors = data.sensors;
    const sensorsWithP85 = sensors.filter((sensor) => sensor?.stats?.p85_speed != null);
    const sensorsWithMin = sensors.filter((sensor) => sensor?.stats?.min_speed != null);

    return {
      total:   sensors.length,
      volume:  sensors.reduce((s, x) => s + x.stats.total_volume, 0),
      avgSpeed: (sensors.reduce((s, x) => s + (x.stats.avg_speed ?? 0), 0) / sensors.length).toFixed(1),
      avgP85:   sensorsWithP85.length
        ? (sensorsWithP85.reduce((sum, sensor) => sum + sensor.stats.p85_speed, 0) / sensorsWithP85.length).toFixed(1)
        : null,
      avgMinSpeed: sensorsWithMin.length
        ? (sensorsWithMin.reduce((sum, sensor) => sum + sensor.stats.min_speed, 0) / sensorsWithMin.length).toFixed(1)
        : null,
      avgMaxSpeed: (sensors.reduce((s, x) => s + (x.stats.max_speed ?? 0), 0) / sensors.length).toFixed(1),
      totalCongestionMins: sensors.reduce((s, x) => s + x.stats.congestion_minutes, 0),
      avgCoverage: (sensors.reduce((s, x) => s + x.stats.coverage_pct, 0) / sensors.length).toFixed(1),
    };
  }, [data]);

  // ── render ────────────────────────────────────────────────────────────────
  if (loading && !data) return (
    <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
      <RefreshCw size={20} className="animate-spin" />
      <span className="text-sm">Loading deep analytics from interval_data…</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-red-300 text-sm">
      <AlertTriangle size={18} />Failed to load deep analytics: {error}
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2 flex-1 min-w-0">
          <Database size={14} className="text-indigo-400 flex-shrink-0" />
          <span className="text-xs text-gray-300 font-medium">Source: interval_data (raw per-lane per-minute)</span>
          {loading && <RefreshCw size={13} className="text-gray-400 animate-spin ml-1 flex-shrink-0" />}
          {lastFetch && !loading && (
            <span className="ml-auto text-[11px] text-gray-600 flex-shrink-0">
              Updated {lastFetch.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Period picker */}
        <div className="flex items-center gap-1.5 bg-gray-900/60 border border-gray-700/50 rounded-lg p-1 flex-shrink-0">
          <Calendar size={13} className="text-gray-400 ml-1" />
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => handlePeriodChange(opt.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                period === opt.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700/60'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="relative flex-shrink-0" ref={customRef}>
            <button onClick={() => setShowCustom(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900/60 border border-gray-700/50 rounded-lg text-xs text-gray-300 hover:text-white">
              <span>{dateFrom} → {dateTo}</span><ChevronDown size={12} />
            </button>
            {showCustom && (
              <div className="absolute top-full mt-1 left-0 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 min-w-[280px]">
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
                    {[[3,'3 Days'],[7,'7 Days'],[14,'14 Days'],[30,'30 Days']].map(([n, lbl]) => (
                      <button key={n} onClick={() => { setDateFrom(daysAgo(n)); setDateTo(todayStr()); }}
                        className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-[10px] text-gray-300 hover:bg-gray-700">{lbl}</button>
                    ))}
                  </div>
                  <button onClick={applyCustomRange}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-1.5 rounded-lg transition-colors">Apply Range</button>
                </div>
              </div>
            )}
          </div>
        )}

        <button onClick={fetchData} title="Refresh"
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition-colors flex-shrink-0">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Global KPI banner ───────────────────────────────────────────── */}
      {globalKpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Sensors',     value: globalKpis.total,                                    unit: 'AVDS units',         valCls: 'text-white',          cls: 'bg-gray-800/60 border-gray-700/50' },
            { label: 'Network Volume',    value: Number(globalKpis.volume).toLocaleString(),          unit: `vehicles · ${periodLabel()}`, valCls: 'text-blue-400',  cls: 'bg-blue-500/10 border-blue-500/30' },
            { label: 'Avg Speed (all)',   value: `${globalKpis.avgSpeed} km/h`,                       unit: 'network average',    valCls: 'text-green-400',      cls: 'bg-green-500/10 border-green-500/30' },
            hasP85Data
              ? { label: 'Avg P85 Speed', value: `${globalKpis.avgP85} km/h`,                        unit: '85th percentile',    valCls: 'text-indigo-400',     cls: 'bg-indigo-500/10 border-indigo-500/30' }
              : { label: 'Min / Max Speed (all)', value: `${fmt(globalKpis.avgMinSpeed)} / ${globalKpis.avgMaxSpeed} km/h`, unit: 'network average', valCls: 'text-indigo-400', cls: 'bg-indigo-500/10 border-indigo-500/30' },
            { label: 'Congestion Total',  value: `${globalKpis.totalCongestionMins} min`,             unit: 'across all sensors', valCls: globalKpis.totalCongestionMins > 0 ? 'text-red-400' : 'text-green-400', cls: globalKpis.totalCongestionMins > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30' },
            { label: 'Avg Data Coverage', value: `${globalKpis.avgCoverage}%`,                       unit: 'sensor uptime',      valCls: Number(globalKpis.avgCoverage) < 80 ? 'text-orange-400' : 'text-green-400', cls: 'bg-gray-800/60 border-gray-700/50' },
          ].map(k => (
            <div key={k.label} className={`border rounded-xl p-4 flex flex-col gap-0.5 ${k.cls}`}>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{k.label}</span>
              <span className={`text-2xl font-bold leading-tight ${k.valCls}`}>{k.value}</span>
              <span className="text-[10px] text-gray-600">{k.unit}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── P85 explanation banner ──────────────────────────────────────── */}
      {hasP85Data && (
        <div className="flex items-start gap-3 bg-indigo-900/20 border border-indigo-700/30 rounded-xl px-4 py-3">
          <Info size={15} className="text-indigo-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-300/80 leading-relaxed">
            <span className="font-semibold text-indigo-300">P85 Speed</span> is the speed at or below which 85% of vehicles travel —
            the international standard metric for speed-limit studies, road-safety audits, and speed-camera placement.
            A large gap between avg speed and P85 speed indicates high speed dispersion (some vehicles going much
            faster), which correlates with higher crash risk.
            <span className="font-semibold"> Speed-vs-P85 Ratio below 75%</span> = investigate immediately.
          </p>
        </div>
      )}

      {/* ── Sensor cards ────────────────────────────────────────────────── */}
      {!data?.sensors?.length ? (
        <div className="text-gray-500 text-sm text-center py-12">
          No AVDS sensors with traffic data found for this period.
        </div>
      ) : (
        <div className="space-y-3">
          {data.sensors.map((sensor, i) => (
            <SensorCard
              key={sensor.id}
              sensor={sensor}
              expectedMinutes={expectedMinutes}
              hasP85Data={hasP85Data}
              defaultExpanded={i === 0}
            />
          ))}
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 bg-gray-900/40 border border-gray-700/30 rounded-xl px-4 py-3 text-[11px] text-gray-400">
        <span className="font-semibold text-gray-300">Legend:</span>
        <span title="Occ > 25% or Speed < 20 km/h per minute">Congestion = Occ &gt;25% OR Speed &lt;20 km/h</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Normal occupancy (&lt;15%)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />Moderate (15–25%)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />High occupancy (&gt;25%)</span>
        <span className="ml-auto text-gray-600">Data source: traffic.interval_data</span>
      </div>
    </div>
  );
}
