import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, RefreshCw, X } from 'lucide-react';
import { fetchWithAuth } from '../../services/http';
import config from '../../config';

/**
 * AvdsKpiBar
 *
 * Renders the 7 KPI cards for the AVDS Heat Report dashboard:
 *   Total Sensors · Normal · Slow · Critical
 *   Total Volume · Avg Speed · Avg Occupancy (each with an independent date filter)
 *
 * Props:
 *   summary – response from GET /api/avds/summary
 *   loading – boolean skeleton state
 */

// ─── Static config ────────────────────────────────────────────────────────────
const HEAT_CONFIG = {
  1: { label: 'Normal',   card: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', pctText: 'text-green-500/60' },
  2: { label: 'Slow',     card: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', pctText: 'text-amber-500/60' },
  3: { label: 'Critical', card: 'bg-red-500/10 border-red-500/30',     text: 'text-red-400',   pctText: 'text-red-500/60'   },
};

const PRESETS = [
  { id: 'today',      label: 'Today'        },
  { id: 'yesterday',  label: 'Yesterday'    },
  { id: 'week',       label: 'Last 7 Days'  },
  { id: 'this_month', label: 'This Month'   },
  { id: 'month',      label: 'Last 30 Days' },
  { id: 'custom',     label: 'Custom'       },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getFirstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function presetShortLabel(preset, from, to) {
  switch (preset) {
    case 'today':      return 'Today';
    case 'yesterday':  return 'Yesterday';
    case 'week':       return 'Last 7 Days';
    case 'this_month': return 'This Month';
    case 'month':      return 'Last 30 Days';
    case 'custom':     return (from && to) ? `${from} – ${to}` : 'Custom';
    default:           return '';
  }
}

function buildAnalyticsUrl(preset, from, to) {
  if (preset === 'this_month') {
    return `${config.API_URL}/api/avds/traffic-analytics?period=custom&date_from=${getFirstOfMonth()}&date_to=${getToday()}`;
  }
  if (preset === 'custom') {
    return `${config.API_URL}/api/avds/traffic-analytics?period=custom&date_from=${from}&date_to=${to}`;
  }
  return `${config.API_URL}/api/avds/traffic-analytics?period=${preset}`;
}

function extractMetric(json, metric) {
  const traffic = json.traffic ?? {};
  let totalVolume = 0, speedSum = 0, speedCnt = 0, occSum = 0, occCnt = 0;

  Object.values(traffic).forEach(sensorSlots => {
    Object.values(sensorSlots ?? {}).forEach(slot => {
      if (!slot) return;
      totalVolume += slot.volume ?? 0;
      if (slot.avg_speed != null && Number(slot.avg_speed) > 0) {
        speedSum += Number(slot.avg_speed); speedCnt++;
      }
      if (slot.occupancy != null) {
        occSum += Number(slot.occupancy); occCnt++;
      }
    });
  });

  switch (metric) {
    case 'volume':    return totalVolume;
    case 'speed':     return speedCnt > 0 ? (speedSum / speedCnt).toFixed(1) : null;
    case 'occupancy': return occCnt  > 0 ? (occSum  / occCnt ).toFixed(1) : null;
    default:          return null;
  }
}

// ─── Date filter popover ──────────────────────────────────────────────────────
function DateFilterPopover({ preset, from, to, today, onPreset, onFrom, onTo, onClose }) {
  return (
    <div className="absolute top-full right-0 mt-1 z-30 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-300">Filter Period</span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-2 gap-1 mb-2">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => { onPreset(p.id); if (p.id !== 'custom') onClose(); }}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
              preset === p.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date pickers */}
      {preset === 'custom' && (
        <div className="space-y-1.5 pt-2 border-t border-gray-700/50">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">From</label>
            <input
              type="date" value={from} max={to || today}
              onChange={e => onFrom(e.target.value)}
              className="w-full px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">To</label>
            <input
              type="date" value={to} min={from} max={today}
              onChange={e => onTo(e.target.value)}
              className="w-full px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Individual traffic metric card ──────────────────────────────────────────
function TrafficMetricCard({
  metric, title, subtitlePrefix,
  accentBg, accentBorder, accentText, accentSubtext,
  formatValue,
}) {
  const today = getToday();
  const [preset, setPreset]       = useState('this_month');
  const [from,   setFrom]         = useState(getFirstOfMonth);
  const [to,     setTo]           = useState(today);
  const [value,  setValue]        = useState(null);
  const [loading, setLoading]     = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const cardRef = useRef(null);

  // Fetch when filter changes
  const fetchData = useCallback(async () => {
    if (preset === 'custom' && (!from || !to || from > to)) return;
    setLoading(true);
    try {
      const url = buildAnalyticsUrl(preset, from, to);
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setValue(extractMetric(json, metric));
    } catch (e) {
      console.error(`AvdsKpiBar [${metric}] fetch error:`, e);
      setValue(null);
    } finally {
      setLoading(false);
    }
  }, [metric, preset, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close popover on outside click
  useEffect(() => {
    if (!showFilter) return;
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilter]);

  const label        = presetShortLabel(preset, from, to);
  const displayValue = loading ? '…' : (value != null ? formatValue(value) : '—');

  return (
    <div ref={cardRef} className={`relative ${accentBg} border ${accentBorder} rounded-xl p-4 flex flex-col gap-0.5`}>
      {/* Calendar toggle */}
      <button
        onClick={() => setShowFilter(v => !v)}
        title="Filter date range"
        className={`absolute top-2 right-2 p-1 rounded-md transition-colors ${
          showFilter
            ? 'bg-blue-600 text-white'
            : `${accentText} opacity-40 hover:opacity-100 hover:bg-gray-700/50`
        }`}
      >
        <Calendar className="w-3 h-3" />
      </button>

      {/* Popover */}
      {showFilter && (
        <DateFilterPopover
          preset={preset} from={from} to={to} today={today}
          onPreset={setPreset} onFrom={setFrom} onTo={setTo}
          onClose={() => setShowFilter(false)}
        />
      )}

      {/* Card content */}
      <span className={`text-[10px] uppercase tracking-wider font-semibold ${accentText}/80`}>{title}</span>
      <div className="flex items-end gap-1.5">
        <span className={`text-3xl font-bold leading-tight ${accentText}`}>{displayValue}</span>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-gray-500 mb-1" />}
      </div>
      <span className={`text-[10px] ${accentSubtext}`}>{subtitlePrefix} · {label}</span>
    </div>
  );
}

// ─── Main KPI bar ─────────────────────────────────────────────────────────────
export default function AvdsKpiBar({ summary, loading }) {
  // Loading skeleton
  if (loading && !summary) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const { total = 0, by_level = {} } = summary;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">

      {/* ── Total sensors ── */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col gap-0.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Sensors</span>
        <span className="text-3xl font-bold text-white leading-tight">{total}</span>
        <span className="text-[10px] text-gray-500">AVDS units</span>
      </div>

      {/* ── Heat level cards: Normal / Slow / Critical (live from summary) ── */}
      {[1, 2, 3].map(level => {
        const cfg = HEAT_CONFIG[level];
        const cnt = by_level[String(level)] ?? 0;
        const pct = total > 0 ? Math.round(cnt / total * 100) : 0;
        return (
          <div key={level} className={`border rounded-xl p-4 flex flex-col gap-0.5 ${cfg.card}`}>
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${cfg.text}/80`}>{cfg.label}</span>
            <span className={`text-3xl font-bold leading-tight ${cfg.text}`}>{cnt}</span>
            <span className={`text-[10px] ${cfg.pctText}`}>{pct}% of sensors</span>
          </div>
        );
      })}

      {/* ── Traffic metric cards (each with independent date filter, default: This Month) ── */}
      <TrafficMetricCard
        metric="volume"
        title="Total Volume"
        subtitlePrefix="vehicles"
        accentBg="bg-blue-500/10"
        accentBorder="border-blue-500/30"
        accentText="text-blue-400"
        accentSubtext="text-blue-500/60"
        formatValue={v => Number(v).toLocaleString()}
      />
      <TrafficMetricCard
        metric="speed"
        title="Avg Speed"
        subtitlePrefix="km/h"
        accentBg="bg-indigo-500/10"
        accentBorder="border-indigo-500/30"
        accentText="text-indigo-400"
        accentSubtext="text-indigo-500/60"
        formatValue={v => v}
      />
      <TrafficMetricCard
        metric="occupancy"
        title="Avg Occupancy"
        subtitlePrefix="road occupancy"
        accentBg="bg-purple-500/10"
        accentBorder="border-purple-500/30"
        accentText="text-purple-400"
        accentSubtext="text-purple-500/60"
        formatValue={v => `${v}%`}
      />

    </div>
  );
}
