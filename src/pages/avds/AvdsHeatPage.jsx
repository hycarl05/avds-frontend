import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Navbar from '../../components/Navbar';
import AvdsKpiBar from '../../components/avds/AvdsKpiBar';
import AvdsSensorChart from '../../components/avds/AvdsSensorChart';
import AvdsTrafficChart from '../../components/avds/AvdsTrafficChart';
import AvdsDeepAnalytics from '../../components/avds/AvdsDeepAnalytics';
import AvdsSensorStatusTable from '../../components/avds/AvdsSensorStatusTable';
import { fetchWithAuth } from '../../services/http';
import config from '../../config';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import DataTable from 'react-data-table-component';
import {
  RefreshCw, Flame, LayoutGrid, BarChart3, Car, Activity,
  AlertTriangle, ChevronRight, Search, Download, WifiOff,
} from 'lucide-react';

// ═══════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════
// Backend heat levels: 1=No Data, 2=Normal, 3=Slow, 4=Jam/Critical
const HEAT_CFG = {
  1: {
    label:   'No Data',
    border:  'border-gray-500/40',
    bg:      'bg-gray-500/10',
    text:    'text-gray-400',
    badge:   'bg-gray-500/20 text-gray-400 border border-gray-500/30',
    dot:     '#6b7280',
    glow:    'shadow-gray-900/30',
  },
  2: {
    label:   'Normal',
    border:  'border-green-500/40',
    bg:      'bg-green-500/10',
    text:    'text-green-400',
    badge:   'bg-green-500/20 text-green-400 border border-green-500/30',
    dot:     '#22c55e',
    glow:    'shadow-green-900/30',
  },
  3: {
    label:   'Slow',
    border:  'border-orange-500/40',
    bg:      'bg-orange-500/10',
    text:    'text-orange-400',
    badge:   'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    dot:     '#f97316',
    glow:    'shadow-orange-900/30',
  },
  4: {
    label:   'Jam',
    border:  'border-red-500/50',
    bg:      'bg-red-500/15',
    text:    'text-red-400',
    badge:   'bg-red-500/20 text-red-400 border border-red-500/30',
    dot:     '#ef4444',
    glow:    'shadow-red-900/40',
  },
};

const VIEW_TABS = [
  { id: 'grid',    label: 'Grid',     icon: LayoutGrid },
  { id: 'traffic', label: 'Traffic',  icon: Car        },
  { id: 'chart',   label: 'Charts',   icon: BarChart3  },
  // { id: 'table',   label: 'History',  icon: Table      },
  { id: 'deep',    label: 'Analysis', icon: Activity   },
];

const REFRESH_INTERVAL_MS = 30_000;

// ═══════════════════════════════════════════════════
// CSV / PDF helpers
// ═══════════════════════════════════════════════════
function exportToCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const keys   = Object.keys(rows[0]);
  const escape = val => {
    const str = String(val ?? '').replace(/"/g, '""');
    return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
  };
  const csv  = [keys.join(','), ...rows.map(row => keys.map(k => escape(row[k])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function formatTimelineSlot(slot, granularity) {
  const d = new Date(slot);
  if (Number.isNaN(d.getTime())) return slot;
  return granularity === 'hourly'
    ? d.toLocaleString('en-MY', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-MY', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function buildTimelineCsvRows(slots, sensors, data, granularity, zoneLookup = {}) {
  const rows = [];

  slots.forEach(slot => {
    const slotLabel = formatTimelineSlot(slot, granularity);
    sensors.forEach(sensor => {
      const sid = String(sensor.id);
      const point = data?.[sid]?.[slot] ?? {};
      // Zone: prefer live allSensors lookup (has zone), fall back to API sensor data
      const zoneRef = zoneLookup[sensor.name] ?? zoneLookup[String(sensor.id)];
      const zoneName = zoneRef?.zone?.name ?? sensor.zone?.name ?? '—';
      // Sanitize occupancy: values > 100 are sensor overflow errors
      const rawOcc = point.occupancy;
      const occ = rawOcc != null ? (rawOcc > 100 ? 'SENSOR_ERR' : rawOcc) : '—';
      rows.push({
        Slot: slotLabel,
        Sensor: sensor.name ?? '',
        IP: sensor.ip_address ?? '—',
        Volume: point.volume ?? '—',
        'Avg Speed (km/h)': 0,
        'Occupancy (%)': occ,
      });
    });
  });

  return rows;
}

const METRIC_COLOR = {
  volume: (v) => {
    if (v == null) return { fill: [245,245,247], text: [170,170,175] };
    if (v < 50)   return { fill: [220,252,231], text: [21,128,61]   };
    if (v < 150)  return { fill: [254,243,199], text: [146,64,14]   };
    return               { fill: [254,226,226], text: [185,28,28]   };
  },
  speed: (v) => {
    if (v == null) return { fill: [245,245,247], text: [170,170,175] };
    if (v >= 60)  return { fill: [220,252,231], text: [21,128,61]   };
    if (v >= 30)  return { fill: [254,243,199], text: [146,64,14]   };
    return               { fill: [254,226,226], text: [185,28,28]   };
  },
  occupancy: (v) => {
    if (v == null) return { fill: [245,245,247], text: [170,170,175] };
    if (v < 30)   return { fill: [220,252,231], text: [21,128,61]   };
    if (v <= 70)  return { fill: [254,243,199], text: [146,64,14]   };
    return               { fill: [254,226,226], text: [185,28,28]   };
  },
};

function buildHeatPdf(doc, title, subtitle, slots, sensors, data, granularity) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, W, 5, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 5, W, 50, 'F');
  doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(15, 23, 42);
  doc.text(title, 36, 28);
  doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(100, 116, 139);
  doc.text(subtitle, 36, 42);
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4); doc.line(0, 55, W, 55);

  const legendY = 70;
  const legendItems = [
    { fill: [245,245,247], text: [170,170,175], label: 'No Data'  },
    { fill: [220,252,231], text: [21,128,61],   label: 'Good'     },
    { fill: [254,243,199], text: [146,64,14],   label: 'Moderate' },
    { fill: [254,226,226], text: [185,28,28],   label: 'Critical' },
  ];
  let lx = 36;
  legendItems.forEach(({ fill, text, label }) => {
    doc.setFillColor(...fill);
    doc.roundedRect(lx, legendY - 8, 10, 10, 1.5, 1.5, 'F');
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
    doc.roundedRect(lx, legendY - 8, 10, 10, 1.5, 1.5, 'S');
    doc.setFont(undefined, 'normal'); doc.setFontSize(7.5); doc.setTextColor(60, 60, 70);
    doc.text(label, lx + 14, legendY);
    lx += doc.getTextWidth(label) + 28;
  });

  const slotLabels = slots.map(slot => {
    const d = new Date(slot);
    return granularity === 'hourly'
      ? `${d.getHours().toString().padStart(2, '0')}:00`
      : d.toLocaleDateString('en-MY', { month: 'short', day: '2-digit' });
  });
  const colStyles = { 0: { halign: 'left', cellWidth: 'auto', minCellWidth: 130 } };
  if (granularity === 'hourly') for (let i = 1; i <= slots.length; i++) colStyles[i] = { cellWidth: 24, halign: 'center' };

  const sharedOpts = {
    margin: { left: 36, right: 36 }, tableWidth: 'auto',
    styles: { fontSize: 7, cellPadding: 2.8, halign: 'center', valign: 'middle', textColor: [50,60,80], fillColor: [255,255,255], lineColor: [220,225,235], lineWidth: 0.3, overflow: 'hidden' },
    alternateRowStyles: { fillColor: [248,250,252] },
    headStyles: { fillColor: [241,245,249], textColor: [30,41,59], fontSize: 7, fontStyle: 'bold', halign: 'center', cellPadding: 3.5, lineColor: [203,213,225], lineWidth: 0.5 },
    columnStyles: colStyles,
  };

  const renderMetric = (startY, sectionTitle, getVal, colorFn) => {
    doc.setFillColor(241,245,249);
    doc.rect(36, startY, W - 72, 17, 'F');
    doc.setDrawColor(203,213,225); doc.setLineWidth(0.4);
    doc.rect(36, startY, W - 72, 17, 'S');
    doc.setFont(undefined, 'bold'); doc.setFontSize(8.5); doc.setTextColor(30,64,175);
    doc.text(sectionTitle, 42, startY + 12);
    const head = [['Sensor', ...slotLabels]];
    const body = sensors.map(sensor => {
      const sid = String(sensor.id);
      const row = [sensor.name ?? ''];
      slots.forEach(slot => { const d = data[sid]?.[slot]; row.push(d != null ? getVal(d) : '—'); });
      return row;
    });
    autoTable(doc, { ...sharedOpts, head, body, startY: startY + 21,
      didParseCell: (hook) => {
        if (hook.section !== 'body') return;
        if (hook.column.index === 0) { hook.cell.styles.textColor = [15,23,60]; hook.cell.styles.fontStyle = 'bold'; hook.cell.styles.fontSize = 7.5; }
        else {
          const raw = hook.cell.raw;
          if (raw === '—') { hook.cell.styles.fillColor = [245,245,247]; hook.cell.styles.textColor = [170,170,175]; }
          else { const { fill, text } = colorFn(parseFloat(raw)); hook.cell.styles.fillColor = fill; hook.cell.styles.textColor = text; hook.cell.styles.fontStyle = 'bold'; }
        }
      },
    });
    return doc.lastAutoTable.finalY;
  };

  let y = legendY + 16;
  y = renderMetric(y, 'Volume  (vehicles / interval)', d => d.volume != null ? String(d.volume) : '—', METRIC_COLOR.volume) + 24;
  y = renderMetric(y, 'Average Speed  (km/h)', d => {
    const speed = d?.speed ?? d?.avg_speed;
    return speed != null ? Number(speed).toFixed(1) : '—';
  }, METRIC_COLOR.speed) + 24;
  renderMetric(y, 'Occupancy  (%)', d => d.occupancy != null ? d.occupancy.toFixed(1) + '%' : '—', METRIC_COLOR.occupancy);
}

// ═══════════════════════════════════════════════════
// Dark DataTable styles
// ═══════════════════════════════════════════════════
const dtStyles = {
  table: { style: { backgroundColor: 'transparent' } },
  headCells: { style: { fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '16px', paddingRight: '16px', backgroundColor: 'transparent' } },
  rows: { style: { backgroundColor: 'transparent', borderBottom: '1px solid rgba(55,65,81,0.5)', minHeight: '52px', '&:hover': { backgroundColor: 'rgba(55,65,81,0.2)' } } },
  cells: { style: { fontSize: '13px', color: '#F3F4F6', paddingLeft: '16px', paddingRight: '16px' } },
  pagination: { style: { backgroundColor: 'transparent', borderTop: '1px solid rgba(55,65,81,0.5)', color: '#9CA3AF' }, pageButtonsStyle: { color: '#9CA3AF', fill: '#9CA3AF', '&:hover:not(:disabled)': { backgroundColor: 'rgba(59,130,246,0.2)' } } },
  noData: { style: { backgroundColor: 'transparent', color: '#9CA3AF', padding: '40px' } },
};

// ═══════════════════════════════════════════════════
// Sensor Export Table
// ═══════════════════════════════════════════════════
const SENSOR_HEAT_LABEL = { 1: 'No Data', 2: 'Normal', 3: 'Slow', 4: 'Jam', null: 'No Data' };

function exportSensorsToPdf(rows, today) {
  if (!rows || rows.length === 0) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, W, 5, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 5, W, 45, 'F');
  doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.setTextColor(15, 23, 42);
  doc.text('AVDS Sensor Data Snapshot', 36, 25);
  doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString('en-MY')}  ·  ${rows.length} sensors`, 36, 40);
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4); doc.line(0, 50, W, 50);

  autoTable(doc, {
    startY: 62,
    margin: { left: 36, right: 36 },
    head: [['Sensor', 'Region', 'IP', 'Heat Level', 'Volume', 'Lanes', 'Avg Speed (km/h)', 'Occupancy (%)']],
    body: rows.map(r => [r.Sensor, r.Zone, r.IP, r['Heat Level'], r.Volume, r.Lanes, r['Avg Speed (km/h)'], r['Occupancy (%)']]),
    styles: { fontSize: 7.5, cellPadding: 3, textColor: [50, 60, 80], lineColor: [220, 225, 235], lineWidth: 0.3 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold', cellPadding: 4 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (hook) => {
      if (hook.section !== 'body' || hook.column.index !== 3) return;
      const v = hook.cell.raw;
      if (v === 'Normal')   { hook.cell.styles.textColor = [21, 128, 61];   hook.cell.styles.fontStyle = 'bold'; }
      else if (v === 'Slow')     { hook.cell.styles.textColor = [146, 64, 14];  hook.cell.styles.fontStyle = 'bold'; }
      else if (v === 'Critical') { hook.cell.styles.textColor = [185, 28, 28];  hook.cell.styles.fontStyle = 'bold'; }
      else                       { hook.cell.styles.textColor = [120, 120, 130]; }
    },
  });
  doc.save(`avds-sensors-${today}.pdf`);
}

function AvdsSensorExportTable({ sensors = [], loading = false }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return sensors;
    const q = search.toLowerCase();
    return sensors.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.ip_address?.toLowerCase().includes(q) ||
      s.zone?.name?.toLowerCase().includes(q)
    );
  }, [sensors, search]);

  const getLevel = s => {
    const v = s.current_level ?? null;
    return [1,2,3,4].includes(Number(v)) ? Number(v) : null;
  };

  const LEVEL_STYLE = {
    1:    'bg-gray-500/20 border-gray-500/40 text-gray-400',
    2:    'bg-green-500/20 border-green-500/40 text-green-400',
    3:    'bg-orange-500/20 border-orange-500/40 text-orange-400',
    4:    'bg-red-500/20 border-red-500/40 text-red-400',
    null: 'bg-gray-500/20 border-gray-500/40 text-gray-400',
  };

  const columns = [
    { name: 'Sensor', selector: r => r.name, sortable: true, grow: 2,
      cell: r => <div><div className="font-medium text-white text-sm">{r.name}</div>{r.ip_address && <div className="text-xs text-gray-500">{r.ip_address}</div>}</div> },
    { name: 'Region', selector: r => r.zone?.name, sortable: true,
      cell: r => <span className="text-xs text-gray-400">{r.zone?.name || '—'}</span> },
    { name: 'Status', selector: r => r.is_online, sortable: true, center: true, width: '90px',
      cell: r => (
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${
          r.is_online ? 'text-emerald-400' : 'text-red-400'
        }`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            r.is_online ? 'bg-emerald-400' : 'bg-red-500'
          }`} />
          {r.is_online ? 'Online' : 'Offline'}
        </span>
      ) },
    { name: 'Heat Level', selector: r => getLevel(r), sortable: true, center: true,
      cell: r => { const lv = getLevel(r); return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${LEVEL_STYLE[lv] ?? LEVEL_STYLE[null]}`}>{SENSOR_HEAT_LABEL[lv] ?? 'No Data'}</span>; } },
    { name: 'Volume', selector: r => r.volume, sortable: true, center: true,
      cell: r => <span className="text-xs text-blue-400">{r.volume != null ? Number(r.volume).toLocaleString() : '—'}</span> },
    { name: 'Lanes', selector: r => r.lane_count, sortable: true, center: true,
      cell: r => <span className="text-xs text-cyan-400 font-semibold">{r.lane_count != null ? r.lane_count : '—'}</span> },
    { name: 'Avg Speed (km/h)', selector: r => r.avg_speed, sortable: true, center: true,
      cell: r => <span className="text-xs text-gray-300">{r.avg_speed != null ? Number(r.avg_speed).toFixed(1) : '—'}</span> },
    { name: 'Occupancy (%)', selector: r => r.occupancy, sortable: true, center: true,
      cell: r => {
        const occ = r.occupancy;
        if (occ == null) return <span className="text-xs text-gray-600">—</span>;
        if (occ > 100)   return <span className="text-xs text-yellow-500 font-semibold" title="Sensor error">⚠ ERR</span>;
        return <span className="text-xs text-orange-400">{Number(occ).toFixed(1)}%</span>;
      } },
  ];

  const today = new Date().toISOString().slice(0, 10);
  const exportRows = filtered.map(s => ({
    Sensor: s.name || '', IP: s.ip_address || '—',
    Status: s.is_online ? 'Online' : 'Offline',
    'Heat Level': SENSOR_HEAT_LABEL[getLevel(s)] ?? 'No Data',
    Volume: s.volume ?? '—',
    Lanes: s.lane_count ?? '—',
    'Avg Speed (km/h)': 0,
    'Occupancy (%)':    s.occupancy  != null ? Number(s.occupancy).toFixed(1)  : '—',
  }));

  return (
    <div className="rounded-2xl border border-gray-700/50 bg-gray-800/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-700/50 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-white">Sensor Data</h2>
          <p className="text-xs text-gray-500 mt-0.5">{filtered.length} of {sensors.length} sensors</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input type="text" placeholder="Search sensor…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-gray-700/80 border border-gray-600/50 text-sm text-white w-44 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button onClick={() => exportToCsv(`avds-sensors-${today}.csv`, exportRows)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700/70 hover:bg-emerald-600 text-white transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => exportSensorsToPdf(exportRows, today)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-700/70 hover:bg-red-600 text-white transition-colors">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>
      <DataTable columns={columns} data={filtered} customStyles={dtStyles} pagination paginationPerPage={15}
        paginationRowsPerPageOptions={[10, 15, 25, 50]} progressPending={loading}
        noDataComponent={<div className="py-10 text-gray-500 text-center">No sensor data available.</div>} />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Sensor Card (grid tile)
// ═══════════════════════════════════════════════════
function SensorCard({ sensor }) {
  const online = sensor.is_online;
  const lanes  = Array.isArray(sensor.lanes) && sensor.lanes.length > 0
    ? sensor.lanes.filter(l => Number(l?.lane_no) > 0).slice(0, 4)
    : Array.from({ length: Math.min(Math.max(Number(sensor.lane_count) || 0, 0), 4) }, (_, idx) => ({
        lane_no: idx + 1,
        speed: null,
      }));

  const cardBorder = online ? 'border-green-500/50'  : 'border-red-500/40';
  const cardBg     = online ? 'bg-green-500/5'        : 'bg-red-500/5';
  const stripColor = online ? '#22c55e'               : '#ef4444';

  return (
    <div
      className={`
        relative rounded-xl border ${cardBorder} ${cardBg}
        p-3 flex flex-col gap-2
        shadow-md hover:brightness-110 transition-all duration-200
        select-none
      `}
    >
      {/* ── Status indicator strip ── */}
      <div
        className="absolute top-0 left-0 w-full h-0.5 rounded-t-xl"
        style={{ backgroundColor: stripColor }}
      />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <div className="text-white text-sm font-bold leading-tight truncate">{sensor.name}</div>
          <div className="text-[10px] text-gray-500 truncate">{sensor.zone?.name ?? '—'}</div>
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 border ${
          online
            ? 'bg-green-500/15 text-green-400 border-green-500/30'
            : 'bg-red-500/15 text-red-400 border-red-500/30'
        }`}>
          {online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      {/* ── Flow data: plain labeled rows ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Speed</span>
          <span className="text-gray-200 font-medium">
            {sensor.avg_speed != null ? `${Number(sensor.avg_speed).toFixed(0)} km/h` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Volume</span>
          <span className="text-gray-200 font-medium">
            {sensor.volume != null ? `${Number(sensor.volume).toLocaleString()} vph` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-500">Occupancy</span>
          <span className="text-gray-200 font-medium">
            {sensor.occupancy == null ? '—'
              : sensor.occupancy > 100 ? <span className="text-yellow-500" title="Sensor error">⚠ ERR</span>
              : `${Number(sensor.occupancy).toFixed(0)}%`}
          </span>
        </div>
      </div>

      {/* ── Lane speeds ── */}
      {lanes.length > 0 && (
        <div className="space-y-0.5 border-t border-gray-700/30 pt-1.5">
          {lanes.map((lane, idx) => {
            const speed = lane?.speed;
            return (
              <div key={`${sensor.id}-lane-${lane.lane_no ?? idx}`} className="flex items-center justify-between text-[10px]">
                <span className="text-gray-600">Lane {lane.lane_no ?? idx + 1}</span>
                <span className="text-gray-400">
                  {speed != null ? `${Number(speed).toFixed(0)} km/h` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer: IP + lane count ── */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-700/30 gap-1">
        <span className="text-[9px] text-gray-600 font-mono truncate flex-1 min-w-0">{sensor.ip_address ?? '—'}</span>
        {sensor.lane_count != null && (
          <span className="text-[9px] text-gray-500 flex-shrink-0">{sensor.lane_count} lanes</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Grid skeleton
// ═══════════════════════════════════════════════════
function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-700/40 bg-gray-800/40 h-[180px] animate-pulse"
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════
export default function AvdsHeatPage() {
  const [summary,         setSummary]         = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [lastUpdated,     setLastUpdated]     = useState(null);
  const [countdown,       setCountdown]       = useState(REFRESH_INTERVAL_MS / 1000);
  const [viewMode,        setViewMode]        = useState('grid');
  const [zoneFilter,      setZoneFilter]      = useState('all');
  const [search,          setSearch]          = useState('');
  const [refreshKey,      setRefreshKey]      = useState(0);
  const [hourlyPdfLoading,setHourlyPdfLoading]= useState(false);
  const [dailyPdfLoading, setDailyPdfLoading] = useState(false);
  const [hourlyCsvLoading,setHourlyCsvLoading]= useState(false);
  const [dailyCsvLoading, setDailyCsvLoading] = useState(false);
  const todayStr   = new Date().toISOString().slice(0, 10);
  const weekAgoStr = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [pdfDate,     setPdfDate]     = useState(todayStr);
  const [pdfDateFrom, setPdfDateFrom] = useState(weekAgoStr);
  const [pdfDateTo,   setPdfDateTo]   = useState(todayStr);
  const timerRef = useRef(null);

  // ── Fetch summary from authenticated endpoint ─────────────────────────
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetchWithAuth(`${config.API_URL}/api/avds/summary`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSummary(json);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // ── Auto-refresh + countdown ──────────────────────────────────────────
  useEffect(() => {
    setCountdown(REFRESH_INTERVAL_MS / 1000);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchSummary();
          setRefreshKey(k => k + 1);
          return REFRESH_INTERVAL_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [fetchSummary]);

  const handleRefresh = () => {
    clearInterval(timerRef.current);
    fetchSummary();
    setRefreshKey(k => k + 1);
    setCountdown(REFRESH_INTERVAL_MS / 1000);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchSummary();
          setRefreshKey(k => k + 1);
          return REFRESH_INTERVAL_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── PDF generation ────────────────────────────────────────────────────
  const generateHourlyPdf = useCallback(async () => {
    setHourlyPdfLoading(true);
    try {
      const now = new Date();
      const url = `${config.API_URL}/api/avds/traffic-analytics?period=custom&date_from=${pdfDate}&date_to=${pdfDate}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const slots = json.slots ?? json.hours ?? [];
      const sens  = json.sensors ?? [];
      const data  = json.traffic ?? json.data ?? {};
      const doc   = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      buildHeatPdf(doc, 'AVDS Hourly Heat Timeline',
        `Date: ${pdfDate}  ·  Each column = 1 hour  ·  Generated: ${now.toLocaleTimeString('en-MY')}  ·  ${sens.length} sensors`,
        slots, sens, data, 'hourly');
      doc.save(`avds-hourly-${pdfDate}.pdf`);
    } catch (err) { alert(`Failed to generate PDF: ${err.message}`); }
    finally { setHourlyPdfLoading(false); }
  }, [pdfDate]);

  const generateDailyPdf = useCallback(async () => {
    if (pdfDateFrom > pdfDateTo) { alert('"From" date must be before or equal to "To" date.'); return; }
    setDailyPdfLoading(true);
    try {
      const now = new Date();
      const url = `${config.API_URL}/api/avds/traffic-analytics?period=custom&date_from=${pdfDateFrom}&date_to=${pdfDateTo}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const slots = json.slots ?? json.hours ?? [];
      const sens  = json.sensors ?? [];
      const data  = json.traffic ?? json.data ?? {};
      const doc   = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      buildHeatPdf(doc, 'AVDS Daily Heat Timeline',
        `Range: ${pdfDateFrom} to ${pdfDateTo}  ·  Each column = 1 day  ·  Generated: ${now.toLocaleString('en-MY')}  ·  ${sens.length} sensors`,
        slots, sens, data, 'daily');
      doc.save(`avds-daily-${pdfDateFrom}_${pdfDateTo}.pdf`);
    } catch (err) { alert(`Failed to generate PDF: ${err.message}`); }
    finally { setDailyPdfLoading(false); }
  }, [pdfDateFrom, pdfDateTo]);

  const generateHourlyCsv = useCallback(async () => {
    setHourlyCsvLoading(true);
    try {
      const url = `${config.API_URL}/api/avds/traffic-analytics?period=custom&date_from=${pdfDate}&date_to=${pdfDate}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const slots = json.slots ?? json.hours ?? [];
      const sens  = json.sensors ?? [];
      const data  = json.traffic ?? json.data ?? {};
      const zoneByKey = {};
      allSensors.forEach(s => { if (s.name) zoneByKey[s.name] = s; if (s.id) zoneByKey[String(s.id)] = s; });
      const rows  = buildTimelineCsvRows(slots, sens, data, 'hourly', zoneByKey);
      exportToCsv(`avds-hourly-${pdfDate}.csv`, rows);
    } catch (err) { alert(`Failed to generate CSV: ${err.message}`); }
    finally { setHourlyCsvLoading(false); }
  }, [pdfDate]);

  const generateDailyCsv = useCallback(async () => {
    if (pdfDateFrom > pdfDateTo) { alert('"From" date must be before or equal to "To" date.'); return; }
    setDailyCsvLoading(true);
    try {
      const url = `${config.API_URL}/api/avds/traffic-analytics?period=custom&date_from=${pdfDateFrom}&date_to=${pdfDateTo}`;
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const slots = json.slots ?? json.hours ?? [];
      const sens  = json.sensors ?? [];
      const data  = json.traffic ?? json.data ?? {};
      const zoneByKey = {};
      allSensors.forEach(s => { if (s.name) zoneByKey[s.name] = s; if (s.id) zoneByKey[String(s.id)] = s; });
      const rows  = buildTimelineCsvRows(slots, sens, data, 'daily', zoneByKey);
      exportToCsv(`avds-daily-${pdfDateFrom}_${pdfDateTo}.csv`, rows);
    } catch (err) { alert(`Failed to generate CSV: ${err.message}`); }
    finally { setDailyCsvLoading(false); }
  }, [pdfDateFrom, pdfDateTo]);

  // ── Derive zone list + filtered sensors ──────────────────────────────
  const allSensors = summary?.sensors ?? [];

  const zones = React.useMemo(() => {
    const seen = {};
    allSensors.forEach(s => {
      if (s.zone) seen[s.zone.id] = s.zone.name;
    });
    return Object.entries(seen).map(([id, name]) => ({ id: Number(id), name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allSensors]);

  const filteredSensors = React.useMemo(() => {
    let list = allSensors;
    if (zoneFilter !== 'all') {
      list = list.filter(s => s.zone?.id === Number(zoneFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.ip_address?.toLowerCase().includes(q) ||
        s.zone?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allSensors, zoneFilter, search]);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <Navbar />

      {/* ── Sticky header: breadcrumb + refresh only ────────────────── */}
      <div className="border-b border-gray-700/50 bg-gray-900/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Left: breadcrumb + status badges */}
          <div className="flex items-center gap-2 text-sm">
            <Flame className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span className="text-white font-semibold">AVDS Heat Monitor</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-orange-400 font-medium">
              {summary ? `${summary.total} Sensors` : '—'}
            </span>
            {summary && (() => {
              const onlineCnt  = (summary.sensors ?? []).filter(s => s.is_online).length;
              const offlineCnt = (summary.sensors ?? []).length - onlineCnt;
              return (
                <>
                  {onlineCnt > 0 && (
                    <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold">
                      {onlineCnt} Online
                    </span>
                  )}
                  {offlineCnt > 0 && (
                    <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold">
                      {offlineCnt} Offline
                    </span>
                  )}
                </>
              );
            })()}
          </div>

          {/* Right: refresh */}
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-500 hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString('en-MY')} · next in {countdown}s
              </span>
            )}
            <button onClick={handleRefresh} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-600/60 disabled:opacity-50 text-gray-300 transition-colors border border-gray-600/40 text-xs font-medium">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Page body ──────────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto w-full px-4 py-6 space-y-5">

        {/* KPI bar */}
        <AvdsKpiBar summary={summary} loading={loading} />

        {/* ── PDF Export card ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-700/50 bg-gray-800/60 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Download className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Export PDF Report</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hourly */}
            <div className="rounded-xl border border-blue-700/30 bg-blue-900/10 p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-0.5">Hourly Heat Timeline</p>
                <p className="text-xs text-gray-500">One PDF per hour for a single day</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Date</label>
                <input type="date" value={pdfDate} max={todayStr} onChange={e => setPdfDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-900/80 border border-gray-600/60 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={generateHourlyPdf} disabled={hourlyPdfLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                  {hourlyPdfLoading
                    ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                    : <><Download size={14} /> Hourly PDF</>}
                </button>
                <button onClick={generateHourlyCsv} disabled={hourlyCsvLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                  {hourlyCsvLoading
                    ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                    : <><Download size={14} /> Hourly CSV</>}
                </button>
              </div>
            </div>

            {/* Daily */}
            <div className="rounded-xl border border-indigo-700/30 bg-indigo-900/10 p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-0.5">Daily Heat Timeline</p>
                <p className="text-xs text-gray-500">One column per day over a date range</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From</label>
                  <input type="date" value={pdfDateFrom} max={pdfDateTo} onChange={e => setPdfDateFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-900/80 border border-gray-600/60 text-sm text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">To</label>
                  <input type="date" value={pdfDateTo} min={pdfDateFrom} max={todayStr} onChange={e => setPdfDateTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-900/80 border border-gray-600/60 text-sm text-white focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={generateDailyPdf} disabled={dailyPdfLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                  {dailyPdfLoading
                    ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                    : <><Download size={14} /> Daily PDF</>}
                </button>
                <button onClick={generateDailyCsv} disabled={dailyCsvLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                  {dailyCsvLoading
                    ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                    : <><Download size={14} /> Daily CSV</>}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-600/40 bg-red-900/20 px-5 py-3 text-sm text-red-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Toolbar: zone pills + search + view tabs ─────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">

          {/* Zone filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setZoneFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                zoneFilter === 'all'
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800/60 border-gray-700/40 text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              All Regions
              {summary && (
                <span className="ml-1.5 opacity-70">{summary.total}</span>
              )}
            </button>
            {zones.map(z => {
              const cnt = allSensors.filter(s => s.zone?.id === z.id).length;
              return (
                <button
                  key={z.id}
                  onClick={() => setZoneFilter(String(z.id))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    zoneFilter === String(z.id)
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800/60 border-gray-700/40 text-gray-400 hover:text-white hover:border-gray-500'
                  }`}
                >
                  {z.name}
                  <span className="ml-1.5 opacity-70">{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* Search + view toggle (only shows on grid tab) */}
          <div className="flex items-center gap-2">
            {viewMode === 'grid' && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search sensor…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-gray-700/80 border border-gray-600/50 text-sm text-white w-44 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}

            {/* View mode tabs */}
            <div className="flex items-center bg-gray-800/60 border border-gray-700/50 rounded-lg p-0.5">
              {VIEW_TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setViewMode(tab.id)}
                    title={tab.label}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      viewMode === tab.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Filtered counts when zone/search active ────────────────── */}
        {(zoneFilter !== 'all' || search) && !loading && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Showing {filteredSensors.length} of {allSensors.length} sensors</span>
            <span className="text-green-400 font-semibold">{filteredSensors.filter(s => s.is_online).length} Online</span>
            <span className="text-red-400 font-semibold">{filteredSensors.filter(s => !s.is_online).length} Offline</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW: Grid
        ══════════════════════════════════════════════════════════════ */}
        {viewMode === 'grid' && (
          <>
            {loading && !summary ? (
              <GridSkeleton />
            ) : filteredSensors.length === 0 ? (
              <div className="text-center py-24 text-gray-600">
                <WifiOff className="w-10 h-10 mx-auto mb-3 opacity-40 text-gray-500" />
                <p className="text-sm font-medium text-gray-500">No sensors match your filter.</p>
                <p className="text-xs text-gray-700 mt-1">Try changing the zone or search term.</p>
              </div>
            ) : (
              <>
                {/* ── Online / Offline group sections ── */}
                {[true, false].map(online => {
                  const sensors = filteredSensors.filter(s => !!s.is_online === online);
                  if (sensors.length === 0) return null;
                  return (
                    <div key={String(online)} className="space-y-3">
                      {/* Section header */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            online ? 'bg-emerald-400' : 'bg-red-500'
                          }`}
                        />
                        <span className={`text-sm font-bold ${
                          online ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {online ? 'Online' : 'Offline'}
                        </span>
                        <span className="text-xs text-gray-600">
                          {sensors.length} sensor{sensors.length !== 1 ? 's' : ''}
                        </span>
                        <div className="flex-1 h-px bg-gray-700/40" />
                      </div>

                      {/* Sensor cards grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                        {sensors.map(sensor => (
                          <SensorCard key={sensor.id} sensor={sensor} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Summary footer */}
            {!loading && summary && (() => {
              const sensors    = summary.sensors ?? [];
              const onlineCnt  = sensors.filter(s => s.is_online).length;
              const offlineCnt = sensors.length - onlineCnt;
              return (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-600 pt-2 border-t border-gray-800/50">
                  <span>
                    <span className="text-emerald-400 font-semibold">{onlineCnt}</span> Online
                  </span>
                  <span>
                    <span className="text-red-400 font-semibold">{offlineCnt}</span> Offline
                  </span>
                  <span className="ml-auto">
                    {summary.updated_at
                      ? `Data as of ${new Date(summary.updated_at).toLocaleString('en-MY')}`
                      : ''}
                  </span>
                </div>
              );
            })()}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VIEW: Sub-component tabs (Traffic / Charts / History / Deep)
        ══════════════════════════════════════════════════════════════ */}
        {viewMode === 'traffic' && <AvdsTrafficChart refreshTrigger={refreshKey} height={450} />}
        {viewMode === 'chart'   && <AvdsSensorChart  refreshTrigger={refreshKey} height={450} />}
        {viewMode === 'table'   && <>
          <AvdsSensorStatusTable sensors={allSensors} />
        </>}
        {viewMode === 'deep'    && <AvdsDeepAnalytics refreshTrigger={refreshKey} />}

        {/* ── Sensor data table + CSV export (shown on every tab) ── */}
        <AvdsSensorExportTable sensors={allSensors} loading={loading} />

      </div>
    </div>
  );
}
