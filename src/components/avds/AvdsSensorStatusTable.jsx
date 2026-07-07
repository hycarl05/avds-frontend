import React, { useState } from 'react';
import { Monitor, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * AvdsSensorStatusTable
 *
 * Collapsible live-status table for AVDS sensors.  Accepts a flat sensor
 * array from GET /api/avds/summary and renders each sensor's heat level,
 * current traffic volume, average speed, and road occupancy.
 *
 * Props:
 *   sensors – array of sensor objects:
 *     { id, name, zone: { id, name } | null, ip_address,
 *       current_level, volume, avg_speed, occupancy }
 */

const HEAT_LABELS = {
  1: 'No Data',
  2: 'Normal',
  3: 'Slow',
  4: 'Critical',
};

const HEAT_BADGE = {
  1: 'bg-gray-500/20   border-gray-500/40   text-gray-400',
  2: 'bg-green-500/20  border-green-500/40  text-green-400',
  3: 'bg-amber-500/20  border-amber-500/40  text-amber-400',
  4: 'bg-red-500/20    border-red-500/40    text-red-400',
};

const HEAT_DOT = {
  1: '#6b7280',
  2: '#22c55e',
  3: '#f59e0b',
  4: '#ef4444',
};

export default function AvdsSensorStatusTable({ sensors = [] }) {
  const [expanded, setExpanded] = useState(true);

  const criticalCount = sensors.filter(s => (s.current_level ?? 1) === 4).length;
  const slowCount     = sensors.filter(s => (s.current_level ?? 1) === 3).length;

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">

      {/* ── Collapsible header ──────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Monitor size={15} className="text-gray-400" />
          <span className="text-sm font-semibold text-white">Live Sensor Status</span>
          <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded-full">
            {sensors.length} sensor{sensors.length !== 1 ? 's' : ''}
          </span>

          {/* Alert badges */}
          {criticalCount > 0 && (
            <span className="text-xs text-red-400 bg-red-500/20 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold">
              {criticalCount} CRITICAL
            </span>
          )}
          {slowCount > 0 && (
            <span className="text-xs text-orange-400 bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 rounded-full font-semibold">
              {slowCount} SLOW
            </span>
          )}
        </div>

        {expanded
          ? <ChevronUp  size={16} className="text-gray-400" />
          : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="overflow-x-auto">
          {sensors.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">
              No AVDS sensors found.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-900/60 sticky top-0">
                <tr className="border-b border-gray-700/50">
                  <th className="text-left  px-4 py-2.5 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Sensor</th>
                  <th className="text-left  px-3 py-2.5 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Zone</th>
                  <th className="text-center px-3 py-2.5 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Heat Level</th>
                  <th className="text-right  px-3 py-2.5 text-blue-400/70   font-semibold uppercase tracking-wider text-[10px]">Volume</th>
                  <th className="text-right  px-3 py-2.5 text-green-400/70  font-semibold uppercase tracking-wider text-[10px]">Avg Speed</th>
                  <th className="text-right  px-4 py-2.5 text-orange-400/70 font-semibold uppercase tracking-wider text-[10px]">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map(sensor => {
                  const level = sensor.current_level ?? 1;
                  const badge = HEAT_BADGE[level] ?? HEAT_BADGE[1];
                  const dot   = HEAT_DOT[level]   ?? HEAT_DOT[1];

                  return (
                    <tr
                      key={sensor.id}
                      className="border-b border-gray-800/40 hover:bg-gray-700/20 transition-colors"
                    >
                      {/* Sensor name + IP */}
                      <td className="px-4 py-2.5">
                        <span className="text-gray-200 font-medium">{sensor.name}</span>
                        {sensor.ip_address && (
                          <div className="text-gray-600 text-[10px]">{sensor.ip_address}</div>
                        )}
                      </td>

                      {/* Zone */}
                      <td className="px-3 py-2.5 text-gray-400">
                        {sensor.zone?.name ?? '—'}
                      </td>

                      {/* Heat level badge */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge}`}>
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: dot }}
                          />
                          {HEAT_LABELS[level] ?? 'Unknown'}
                        </span>
                      </td>

                      {/* Traffic metrics */}
                      <td className="px-3 py-2.5 text-right">
                        {sensor.volume != null
                          ? <span className="text-blue-400 font-semibold">{Number(sensor.volume).toLocaleString()}</span>
                          : <span className="text-gray-600 italic">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {sensor.avg_speed != null && Number(sensor.avg_speed) > 0
                          ? <span className="text-green-400 font-semibold">{Number(sensor.avg_speed).toFixed(1)} km/h</span>
                          : <span className="text-gray-600 italic">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {sensor.occupancy != null
                          ? <span className="text-orange-400 font-semibold">{Number(sensor.occupancy).toFixed(1)}%</span>
                          : <span className="text-gray-600 italic">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
