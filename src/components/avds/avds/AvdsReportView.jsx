import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchWithAuth } from '../../services/http';
import config from '../../config';
import {
  FileBarChart2, RefreshCw, AlertTriangle, Clock, Calendar,
  ChevronDown, Download, TrendingUp, TrendingDown, Minus,
  Gauge, Car, Activity, Flame, FileDown,
} from 'lucide-react';

// ─── Heat level helpers ────────────────────────────────────────────────────
const LEVEL_LABEL = { 2: 'Normal', 3: 'Slow', 4: 'Jam', null: '—' };
const LEVEL_DOT   = {
  2: 'bg-green-500',
  3: 'bg-amber-400',
  4: 'bg-red-500',
  null: 'bg-gray-600',
};
const LEVEL_TEXT  = {
  2: 'text-green-400',
  3: 'text-amber-400',
  4: 'text-red-400',
  null: 'text-gray-500',
};
const LEVEL_BADGE = {
  2: 'bg-green-500/15 text-green-400 border border-green-600/40',
  3: 'bg-amber-500/15 text-amber-400 border border-amber-600/40',
  4: 'bg-red-500/15 text-red-400 border border-red-600/40',
  null: 'bg-gray-700/40 text-gray-500 border border-gray-600/40',
};

function LevelBadge({ level }) {
  const l = level ?? null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_BADGE[l] ?? LEVEL_BADGE[null]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[l] ?? 'bg-gray-600'}`} />
      {LEVEL_LABEL[l] ?? '—'}
    </span>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, unit, color = 'text-blue-400', sub }) {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-gray-700/60 flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-gray-500 uppercase tracking-wide truncate">{label}</div>
        <div className={`text-xl font-bold ${color} leading-tight`}>
          {value ?? '—'}
          {unit && value != null && <span className="text-xs font-normal text-gray-500 ml-1">{unit}</span>}
        </div>
        {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Tiny date utils ───────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysAgoStr = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── CSV export ───────────────────────────────────────────────────────────
function exportCsv(rows, mode) {
  let header, getRow;
  if (mode === 'hourly') {
    header  = 'Hour,Total Volume,Avg Speed (km/h),Avg Occupancy (%),Heat Normal,Heat Slow,Heat Jam,Dominant Level,Sample Count';
    getRow  = (r) => [
      r.slot, r.total_volume,
      r.avg_speed ?? '', r.avg_occupancy ?? '',
      r.heat_normal, r.heat_slow, r.heat_jam,
      LEVEL_LABEL[r.dominant_level] ?? '—', r.sample_count,
    ].join(',');
  } else {
    header  = 'Date,Day,Total Volume,Avg Speed (km/h),Avg Occupancy (%),Worst Level,Jam Hours,Sample Count';
    getRow  = (r) => [
      r.date, r.day_label, r.total_volume,
      r.avg_speed ?? '', r.avg_occupancy ?? '',
      LEVEL_LABEL[r.worst_level] ?? '—', r.jam_hours, r.sample_count,
    ].join(',');
  }
  const csv  = [header, ...rows.map(getRow)].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `avds_${mode}_report_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF export ───────────────────────────────────────────────────────────
function exportPdf(rows, mode, summary, data) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Header ────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);              // slate-900
  doc.rect(0, 0, doc.internal.pageSize.width, 32, 'F');

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('AVDS Traffic Report', 14, 14);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);           // slate-400
  const subtitle = mode === 'hourly'
    ? `Mode: Hourly  |  Date: ${data.date}  |  Sensors: ${data.total_sensors}${ data.zone_id ? `  |  Region filtered` : '' }`
    : `Mode: Daily  |  ${data.date_from} → ${data.date_to}  |  Sensors: ${data.total_sensors}${ data.zone_id ? `  |  Region filtered` : '' }`;
  doc.text(subtitle, 14, 22);

  doc.setFontSize(7.5);
  const generated = `Generated: ${new Date().toLocaleString()}`;
  doc.text(generated, doc.internal.pageSize.width - 14, 22, { align: 'right' });

  // ── KPI summary row ───────────────────────────────────────────────────
  const kpiY = 38;
  const kpis = [
    { label: 'Total Volume',   value: summary.total_volume?.toLocaleString() ?? '—' },
    { label: 'Avg Speed',      value: summary.avg_speed != null ? `${summary.avg_speed} km/h` : '—' },
    { label: 'Avg Occupancy',  value: summary.avg_occupancy != null ? `${summary.avg_occupancy}%` : '—' },
    mode === 'hourly'
      ? { label: 'Jam Slots',  value: String(summary.jam_slots ?? 0) }
      : { label: 'Days',       value: String(summary.days ?? rows.length) },
    mode === 'hourly'
      ? { label: 'Peak Hour',  value: summary.peak_hour ?? '—' }
      : { label: 'Date Range', value: `${data.date_from} – ${data.date_to}` },
  ];
  const kpiW = (doc.internal.pageSize.width - 28) / kpis.length;
  kpis.forEach((kpi, i) => {
    const x = 14 + i * kpiW;
    doc.setFillColor(30, 41, 59);            // slate-800
    doc.roundedRect(x, kpiY - 5, kpiW - 3, 14, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);         // slate-500
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label.toUpperCase(), x + 3, kpiY + 1);
    doc.setFontSize(11);
    doc.setTextColor(226, 232, 240);         // slate-200
    doc.setFont('helvetica', 'bold');
    doc.text(kpi.value, x + 3, kpiY + 8);
  });

  // ── Table ─────────────────────────────────────────────────────────────
  let head, body, foot;
  if (mode === 'hourly') {
    head = [[
      { content: 'Hour',         styles: { halign: 'left'  } },
      { content: 'Volume',       styles: { halign: 'right' } },
      { content: 'Avg Speed',    styles: { halign: 'right' } },
      { content: 'Avg Occ %',    styles: { halign: 'right' } },
      { content: '● Normal',     styles: { halign: 'center', textColor: [34,197,94]  } },
      { content: '● Slow',       styles: { halign: 'center', textColor: [251,191,36] } },
      { content: '● Jam',        styles: { halign: 'center', textColor: [239,68,68]  } },
      { content: 'Condition',    styles: { halign: 'center' } },
      { content: 'Samples',      styles: { halign: 'right' } },
    ]];
    body = rows.map(r => [
      { content: r.slot,                                               styles: { fontStyle: 'bold', halign: 'left'  } },
      { content: r.total_volume > 0 ? r.total_volume.toLocaleString() : '—', styles: { halign: 'right' } },
      { content: r.avg_speed     != null ? `${r.avg_speed} km/h`  : '—', styles: { halign: 'right' } },
      { content: r.avg_occupancy != null ? `${r.avg_occupancy}%`  : '—', styles: { halign: 'right' } },
      { content: r.heat_normal > 0 ? String(r.heat_normal) : '—', styles: { halign: 'center', textColor: [21,128,61]  } },
      { content: r.heat_slow   > 0 ? String(r.heat_slow)   : '—', styles: { halign: 'center', textColor: [180,130,6]  } },
      { content: r.heat_jam    > 0 ? String(r.heat_jam)    : '—', styles: { halign: 'center', textColor: [185,28,28]  } },
      { content: LEVEL_LABEL[r.dominant_level] ?? '—',              styles: { halign: 'center', fontStyle: 'bold',
          textColor: r.dominant_level === 4 ? [185,28,28] : r.dominant_level === 3 ? [180,130,6] : r.dominant_level === 2 ? [21,128,61] : [100,116,139] } },
      { content: r.sample_count > 0 ? String(r.sample_count) : '—', styles: { halign: 'right', textColor: [100,116,139] } },
    ]);
    foot = [[
      { content: 'Total / Avg',                                   styles: { fontStyle: 'bold' } },
      { content: summary.total_volume?.toLocaleString() ?? '—',  styles: { halign: 'right', fontStyle: 'bold' } },
      { content: summary.avg_speed     ? `${summary.avg_speed} km/h`  : '—', styles: { halign: 'right' } },
      { content: summary.avg_occupancy ? `${summary.avg_occupancy}%`  : '—', styles: { halign: 'right' } },
      { content: '' }, { content: '' }, { content: '' },
      { content: `Peak: ${summary.peak_hour ?? '—'}`, styles: { halign: 'center', fontStyle: 'bold' } },
      { content: '' },
    ]];
  } else {
    head = [[
      { content: 'Date',         styles: { halign: 'left'  } },
      { content: 'Day',          styles: { halign: 'left'  } },
      { content: 'Total Volume', styles: { halign: 'right' } },
      { content: 'Avg Speed',    styles: { halign: 'right' } },
      { content: 'Avg Occ %',    styles: { halign: 'right' } },
      { content: 'Worst Level',  styles: { halign: 'center'} },
      { content: 'Jam Hours',    styles: { halign: 'center'} },
      { content: 'Samples',      styles: { halign: 'right' } },
    ]];
    body = rows.map(r => [
      { content: r.date,                                                          styles: { fontStyle: 'bold', halign: 'left' } },
      { content: r.day_label,                                                     styles: { halign: 'left'  } },
      { content: r.total_volume > 0 ? r.total_volume.toLocaleString() : '—',     styles: { halign: 'right' } },
      { content: r.avg_speed     != null ? `${r.avg_speed} km/h`  : '—',         styles: { halign: 'right' } },
      { content: r.avg_occupancy != null ? `${r.avg_occupancy}%`  : '—',         styles: { halign: 'right' } },
      { content: LEVEL_LABEL[r.worst_level] ?? '—', styles: { halign: 'center', fontStyle: 'bold',
          textColor: r.worst_level === 4 ? [185,28,28] : r.worst_level === 3 ? [180,130,6] : r.worst_level === 2 ? [21,128,61] : [100,116,139] } },
      { content: r.jam_hours > 0 ? `${r.jam_hours}h` : '—',                      styles: { halign: 'center', textColor: r.jam_hours > 0 ? [185,28,28] : [100,116,139] } },
      { content: r.sample_count > 0 ? String(r.sample_count) : '—',              styles: { halign: 'right', textColor: [100,116,139] } },
    ]);
    foot = [[
      { content: `${summary.days ?? rows.length} days`, styles: { fontStyle: 'bold' } },
      { content: '' },
      { content: summary.total_volume?.toLocaleString() ?? '—', styles: { halign: 'right', fontStyle: 'bold' } },
      { content: summary.avg_speed     ? `${summary.avg_speed} km/h`  : '—', styles: { halign: 'right' } },
      { content: summary.avg_occupancy ? `${summary.avg_occupancy}%`  : '—', styles: { halign: 'right' } },
      { content: '' }, { content: '' }, { content: '' },
    ]];
  }

  autoTable(doc, {
    startY:  kpiY + 12,
    head,
    body,
    foot,
    theme:   'grid',
    headStyles: {
      fillColor:  [30, 64, 175],   // blue-800
      textColor:  255,
      fontSize:   8,
      fontStyle:  'bold',
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
    footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5, textColor: [30,41,59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell(hookData) {
      if (hookData.section !== 'body') return;
      const r  = rows[hookData.row.index];
      const lv = mode === 'hourly' ? r?.dominant_level : r?.worst_level;
      if (lv === 4) hookData.cell.styles.fillColor = [254, 226, 226];  // red-100
      else if (lv === 3) hookData.cell.styles.fillColor = [254, 243, 199]; // amber-100
    },
    margin: { left: 14, right: 14 },
  });

  // ── Page footers ──────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `CCS AVDS Report  |  Page ${i} of ${pages}`,
      14, doc.internal.pageSize.height - 6,
    );
    doc.text(
      new Date().toLocaleString(),
      doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 6,
      { align: 'right' },
    );
  }

  doc.save(`avds_${mode}_report_${todayStr()}.pdf`);
}

// ─── Main component ────────────────────────────────────────────────────────
export default function AvdsReportView({ refreshTrigger }) {
  const [mode,     setMode]     = useState('hourly');  // 'hourly' | 'daily'
  const [date,     setDate]     = useState(todayStr());
  const [dateFrom, setDateFrom] = useState(daysAgoStr(6));
  const [dateTo,   setDateTo]   = useState(todayStr());
  const [zoneId,   setZoneId]   = useState('');

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === 'hourly') {
        params.set('date', date);
      } else {
        params.set('date_from', dateFrom);
        params.set('date_to',   dateTo);
      }
      if (zoneId) params.set('zone_id', zoneId);

      const res  = await fetchWithAuth(`${config.API_URL}/api/avds/report?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mode, date, dateFrom, dateTo, zoneId]);

  useEffect(() => { fetchReport(); }, [fetchReport, refreshTrigger]);

  const rows    = data?.rows    ?? [];
  const summary = data?.summary ?? {};
  const zones   = data?.zones   ?? [];

  // ── Active rows (exclude fully empty hourly slots for cleaner view) ────
  const displayRows = mode === 'hourly'
    ? rows.filter(r => r.sample_count > 0 || r.heat_normal > 0 || r.heat_slow > 0 || r.heat_jam > 0)
    : rows;

  // ── Derive a simple trend arrow ────────────────────────────────────────
  function speedTrend(rowIdx) {
    if (mode !== 'hourly' || rowIdx === 0) return null;
    const prev = displayRows[rowIdx - 1]?.avg_speed;
    const curr = displayRows[rowIdx]?.avg_speed;
    if (prev == null || curr == null) return null;
    if (curr > prev + 2)  return 'up';
    if (curr < prev - 2)  return 'down';
    return 'flat';
  }

  return (
    <div className="space-y-5">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-gray-700/50 bg-gray-800/50">

        {/* Mode toggle */}
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">View</label>
          <div className="flex bg-gray-700/60 border border-gray-600/50 rounded-lg p-0.5">
            {[
              { key: 'hourly', label: 'Hourly', icon: Clock    },
              { key: 'daily',  label: 'Daily',  icon: Calendar },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  mode === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date controls */}
        {mode === 'hourly' ? (
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Date</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={e => setDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-gray-700/80 border border-gray-600/50 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">From</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-gray-700/80 border border-gray-600/50 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">To</label>
              <input
                type="date"
                value={dateTo}
                max={todayStr()}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-gray-700/80 border border-gray-600/50 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </>
        )}

        {/* Zone filter */}
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Zone</label>
          <div className="relative">
            <select
              value={zoneId}
              onChange={e => setZoneId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-gray-700/80 border border-gray-600/50 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none min-w-[140px]"
            >
              <option value="">All Regions</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Refresh + Export */}
        <div className="flex items-center gap-2 ml-auto">
          {lastFetch && (
            <span className="text-[10px] text-gray-600">
              Updated {lastFetch.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-600/60 disabled:opacity-50 text-sm text-gray-300 border border-gray-600/40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {data && rows.length > 0 && (
            <>
              <button
                onClick={() => exportCsv(rows, mode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700/30 hover:bg-green-700/50 text-sm text-green-400 border border-green-700/40 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={() => exportPdf(rows, mode, summary, data)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700/30 hover:bg-red-700/50 text-sm text-red-400 border border-red-700/40 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-600/40 bg-red-900/20 px-5 py-3 text-sm text-red-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      {!loading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            icon={Car}
            label="Total Volume"
            value={summary.total_volume ? summary.total_volume.toLocaleString() : '0'}
            color="text-blue-400"
            sub={`${data.total_sensors} sensor${data.total_sensors !== 1 ? 's' : ''}`}
          />
          <KpiCard
            icon={Gauge}
            label="Avg Speed"
            value={summary.avg_speed ?? '—'}
            unit="km/h"
            color={
              summary.avg_speed == null   ? 'text-gray-500'
              : summary.avg_speed >= 60   ? 'text-green-400'
              : summary.avg_speed >= 30   ? 'text-amber-400'
              : 'text-red-400'
            }
          />
          <KpiCard
            icon={Activity}
            label="Avg Occupancy"
            value={summary.avg_occupancy ?? '—'}
            unit="%"
            color={
              summary.avg_occupancy == null      ? 'text-gray-500'
              : summary.avg_occupancy <= 25      ? 'text-green-400'
              : summary.avg_occupancy <= 50      ? 'text-amber-400'
              : 'text-red-400'
            }
          />
          {mode === 'hourly' ? (
            <>
              <KpiCard
                icon={Flame}
                label="Jam Slots"
                value={summary.jam_slots ?? 0}
                color={summary.jam_slots > 0 ? 'text-red-400' : 'text-gray-400'}
                sub="hours with jam level"
              />
              <KpiCard
                icon={TrendingUp}
                label="Peak Hour"
                value={summary.peak_hour ?? '—'}
                color="text-purple-400"
                sub={summary.peak_volume ? `${summary.peak_volume.toLocaleString()} vehicles` : ''}
              />
            </>
          ) : (
            <KpiCard
              icon={Calendar}
              label="Days"
              value={summary.days ?? rows.length}
              color="text-purple-400"
            />
          )}
          <KpiCard
            icon={FileBarChart2}
            label="Mode"
            value={mode === 'hourly' ? '24-hr' : 'Daily'}
            color="text-cyan-400"
            sub={mode === 'hourly' ? data.date : `${data.date_from} → ${data.date_to}`}
          />
        </div>
      )}

      {/* ── Loading skeleton ───────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-800/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Data table ────────────────────────────────────────────────────── */}
      {!loading && data && (
        <>
          {displayRows.length === 0 ? (
            <div className="py-20 text-center text-gray-600">
              <FileBarChart2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No data for the selected period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-700/50">
              {/* ── Hourly table ── */}
              {mode === 'hourly' && (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-gray-700/60 bg-gray-800/80">
                      <th className="px-4 py-3 font-semibold text-gray-400 whitespace-nowrap">Hour</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-right whitespace-nowrap">Volume</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-right whitespace-nowrap">Avg Speed</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-right whitespace-nowrap">Avg Occ</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-center whitespace-nowrap" colSpan={2}>Traffic Mix &amp; Condition</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-right whitespace-nowrap">Samples</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/30">
                    {displayRows.map((row, idx) => {
                      const trend = speedTrend(idx);
                      const isJam = row.dominant_level === 4;
                      return (
                        <tr
                          key={row.hour}
                          className={`transition-colors hover:bg-gray-700/20 ${isJam ? 'bg-red-900/10' : ''}`}
                        >
                          {/* Hour */}
                          <td className="px-4 py-2.5 font-mono font-semibold text-white whitespace-nowrap">
                            {row.slot}
                            {row.hour >= 7 && row.hour <= 9   && <span className="ml-1.5 text-[9px] text-amber-400 font-bold">AM PEAK</span>}
                            {row.hour >= 17 && row.hour <= 19 && <span className="ml-1.5 text-[9px] text-orange-400 font-bold">PM PEAK</span>}
                          </td>
                          {/* Volume */}
                          <td className="px-4 py-2.5 text-right text-blue-300 font-semibold">
                            {row.total_volume > 0 ? row.total_volume.toLocaleString() : <span className="text-gray-600">—</span>}
                          </td>
                          {/* Speed */}
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {row.avg_speed != null ? (
                              <span className={`font-semibold ${
                                row.avg_speed >= 60 ? 'text-green-400'
                                : row.avg_speed >= 30 ? 'text-amber-400'
                                : 'text-red-400'
                              }`}>
                                {row.avg_speed}
                                <span className="text-gray-600 text-[10px] ml-0.5">km/h</span>
                              </span>
                            ) : <span className="text-gray-600">—</span>}
                            {trend === 'up'   && <TrendingUp   className="inline ml-1 w-3 h-3 text-green-400" />}
                            {trend === 'down' && <TrendingDown className="inline ml-1 w-3 h-3 text-red-400"   />}
                            {trend === 'flat' && <Minus        className="inline ml-1 w-3 h-3 text-gray-500"  />}
                          </td>
                          {/* Occupancy */}
                          <td className="px-4 py-2.5 text-right">
                            {row.avg_occupancy != null ? (
                              <span className={`font-semibold ${
                                row.avg_occupancy <= 25 ? 'text-green-400'
                                : row.avg_occupancy <= 50 ? 'text-amber-400'
                                : 'text-red-400'
                              }`}>
                                {row.avg_occupancy}
                                <span className="text-gray-600 text-[10px] ml-0.5">%</span>
                              </span>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                          {/* Traffic mix bar */}
                          <td className="px-3 py-2.5" style={{minWidth: 120}}>
                            {(() => {
                              const total = (row.heat_normal || 0) + (row.heat_slow || 0) + (row.heat_jam || 0);
                              if (!total) return <span className="text-gray-700 text-xs">—</span>;
                              const pctN = Math.round((row.heat_normal / total) * 100);
                              const pctS = Math.round((row.heat_slow   / total) * 100);
                              const pctJ = 100 - pctN - pctS;
                              return (
                                <div className="space-y-1">
                                  <div className="flex h-3 rounded-full overflow-hidden gap-px">
                                    {pctN > 0 && <div className="bg-green-500" style={{width:`${pctN}%`}} title={`Normal: ${row.heat_normal}`} />}
                                    {pctS > 0 && <div className="bg-amber-400" style={{width:`${pctS}%`}} title={`Slow: ${row.heat_slow}`} />}
                                    {pctJ > 0 && <div className="bg-red-500"   style={{width:`${pctJ}%`}} title={`Jam: ${row.heat_jam}`} />}
                                  </div>
                                  <div className="flex gap-2 text-[9px]">
                                    {row.heat_normal > 0 && <span className="text-green-400">{row.heat_normal}N</span>}
                                    {row.heat_slow   > 0 && <span className="text-amber-400">{row.heat_slow}S</span>}
                                    {row.heat_jam    > 0 && <span className="text-red-400 font-bold">{row.heat_jam}J</span>}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          {/* Dominant condition */}
                          <td className="px-3 py-2.5 text-center">
                            <LevelBadge level={row.dominant_level} />
                          </td>
                          {/* Samples */}
                          <td className="px-4 py-2.5 text-right text-gray-500">
                            {row.sample_count > 0 ? row.sample_count : <span className="text-gray-700">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr className="border-t border-gray-700/60 bg-gray-800/80 font-semibold">
                      <td className="px-4 py-2.5 text-gray-300">Total / Avg</td>
                      <td className="px-4 py-2.5 text-right text-blue-300">
                        {summary.total_volume?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300">
                        {summary.avg_speed ? `${summary.avg_speed} km/h` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300">
                        {summary.avg_occupancy ? `${summary.avg_occupancy}%` : '—'}
                      </td>
                      <td colSpan={2} className="px-3 py-2.5 text-[10px] text-gray-500">
                        <span className="text-green-400 font-semibold">{displayRows.reduce((s,r)=>s+r.heat_normal,0)}</span>N &nbsp;
                        <span className="text-amber-400 font-semibold">{displayRows.reduce((s,r)=>s+r.heat_slow,0)}</span>S &nbsp;
                        <span className="text-red-400 font-bold">{displayRows.reduce((s,r)=>s+r.heat_jam,0)}</span>J
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-[10px]">
                        Peak: {summary.peak_hour ?? '—'}
                        {summary.peak_volume ? ` (${summary.peak_volume.toLocaleString()} veh)` : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* ── Daily table ── */}
              {mode === 'daily' && (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-gray-700/60 bg-gray-800/80">
                      <th className="px-4 py-3 font-semibold text-gray-400 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-right whitespace-nowrap">Total Volume</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-right whitespace-nowrap">Avg Speed</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-right whitespace-nowrap">Avg Occupancy</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-center whitespace-nowrap">Worst Condition</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-center whitespace-nowrap">Jam Hours</th>
                      <th className="px-4 py-3 font-semibold text-gray-400 text-right whitespace-nowrap">Samples</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/30">
                    {displayRows.map((row) => {
                      const isJamDay = row.worst_level === 4;
                      const isToday  = row.date === todayStr();
                      return (
                        <tr
                          key={row.date}
                          className={`transition-colors hover:bg-gray-700/20 ${isJamDay ? 'bg-red-900/10' : ''}`}
                        >
                          {/* Date */}
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className="font-semibold text-white">{row.day_label}</div>
                            {isToday && (
                              <span className="text-[9px] text-blue-400 font-bold">TODAY</span>
                            )}
                          </td>
                          {/* Volume */}
                          <td className="px-4 py-2.5 text-right text-blue-300 font-semibold">
                            {row.total_volume > 0
                              ? row.total_volume.toLocaleString()
                              : <span className="text-gray-600">—</span>}
                          </td>
                          {/* Speed */}
                          <td className="px-4 py-2.5 text-right">
                            {row.avg_speed != null ? (
                              <span className={`font-semibold ${
                                row.avg_speed >= 60 ? 'text-green-400'
                                : row.avg_speed >= 30 ? 'text-amber-400'
                                : 'text-red-400'
                              }`}>
                                {row.avg_speed} <span className="text-gray-600 text-[10px]">km/h</span>
                              </span>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                          {/* Occupancy */}
                          <td className="px-4 py-2.5 text-right">
                            {row.avg_occupancy != null ? (
                              <span className={`font-semibold ${
                                row.avg_occupancy <= 25 ? 'text-green-400'
                                : row.avg_occupancy <= 50 ? 'text-amber-400'
                                : 'text-red-400'
                              }`}>
                                {row.avg_occupancy} <span className="text-gray-600 text-[10px]">%</span>
                              </span>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                          {/* Worst condition */}
                          <td className="px-4 py-2.5 text-center">
                            <LevelBadge level={row.worst_level} />
                          </td>
                          {/* Jam hours */}
                          <td className="px-4 py-2.5 text-center">
                            {row.jam_hours > 0
                              ? <span className="text-red-400 font-bold">{row.jam_hours}h</span>
                              : <span className="text-gray-600">—</span>}
                          </td>
                          {/* Samples */}
                          <td className="px-4 py-2.5 text-right text-gray-500">
                            {row.sample_count > 0 ? row.sample_count : <span className="text-gray-700">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr className="border-t border-gray-700/60 bg-gray-800/80 font-semibold">
                      <td className="px-4 py-2.5 text-gray-300">{summary.days ?? rows.length} days</td>
                      <td className="px-4 py-2.5 text-right text-blue-300">
                        {summary.total_volume?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300">
                        {summary.avg_speed ? `${summary.avg_speed} km/h` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300">
                        {summary.avg_occupancy ? `${summary.avg_occupancy}%` : '—'}
                      </td>
                      <td colSpan={3} className="px-4 py-2.5 text-right text-gray-600 text-[10px]">
                        {data.zone_id ? `Region filtered` : `All ${data.total_sensors} sensors`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-[10px] text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Normal (≥60 km/h, ≤25% occ)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Slow (30–59 km/h)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> Jam (&lt;30 km/h)</span>
            <span className="ml-auto">Heat counts = number of sensor readings at that level in the slot</span>
          </div>
        </>
      )}
    </div>
  );
}
