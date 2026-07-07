/**
 * Export utility functions for generating CSV, PDF, and JSON exports
 */

import { EXPORT_TYPES } from '../constants/reportConstants';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generate timestamp for filenames
 * @returns {string} Formatted timestamp
 */
export const getTimestamp = () => {
  const now = new Date();
  return now.toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '')
    .replace('T', '_');
};

/**
 * Format date for display
 * @returns {string} Formatted date
 */
export const getFormattedDate = () => {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Convert data to CSV format
 * @param {Array} data - Array of objects to convert
 * @param {string} filename - Filename for the export
 */
export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert('No data available to export');
    return;
  }

  // Get headers from the first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  // Create and download the file
  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
  
  // Show success message
  console.log(`✅ Successfully exported ${filename}.csv`);
  // You could also show a toast notification here if you have a toast system
};

/**
 * Convert data to JSON format
 * @param {Object|Array} data - Data to export
 * @param {string} filename - Filename for the export
 */
export const exportToJSON = (data, filename) => {
  if (!data) {
    alert('No data available to export');
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
  
  // Show success message
  console.log(`✅ Successfully exported ${filename}.json`);
};

/**
 * Download file with given content
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 */
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
};

/**
 * Export asset status data
 * @param {Array} assetStatusData - Asset status chart data
 * @param {Object} filters - Current filter settings
 */
export const exportAssetStatus = (assetStatusData, filters = {}) => {
  if (!assetStatusData || assetStatusData.length === 0) {
    alert('No asset status data available to export');
    return;
  }

  // Flatten the data for CSV export
  const flatData = assetStatusData.map(item => ({
    'Asset Type': item.name,
    'online': item.active || 0,
    'Inactive': item.inactive || 0,
    'Warning': item.warning || 0,
    'Total': item.total || 0,
    'Active %': item.total > 0 ? Math.round((item.active / item.total) * 100) : 0
  }));

  const filename = `asset-status-report_${getTimestamp()}`;
  exportToCSV(flatData, filename);
};

/**
 * Export zone distribution data
 * @param {Array} zoneDistributionData - Zone distribution chart data
 * @param {Object} filters - Current filter settings
 */
export const exportZoneDistribution = (zoneDistributionData, filters = {}) => {
  if (!zoneDistributionData || zoneDistributionData.length === 0) {
    alert('No region distribution data available to export');
    return;
  }

  const flatData = zoneDistributionData.map(item => ({
    'Region': item.name,
    'Asset Count': item.value,
    'Percentage': Math.round((item.value / zoneDistributionData.reduce((sum, zone) => sum + zone.value, 0)) * 100)
  }));

  const filename = `region-distribution-report_${getTimestamp()}`;
  exportToCSV(flatData, filename);
};

/**
 * Export activity log data
 * @param {Array} activityData - Recent activity data
 * @param {Object} filters - Current filter settings
 */
export const exportActivityLog = (activityData, filters = {}) => {
  if (!activityData || activityData.length === 0) {
    alert('No activity data available to export');
    return;
  }

  const flatData = activityData.map(item => ({
    'Time': item.time,
    'Event': item.event,
    'Location': item.location,
    'Status': item.status
  }));

  const filename = `activity-log-report_${getTimestamp()}`;
  exportToCSV(flatData, filename);
};

/**
 * Export full report with all data
 * @param {Object} reportData - Complete report data
 * @param {Object} filters - Current filter settings
 */
export const exportFullReport = (reportData, filters = {}) => {
  const {
    stats,
    assets,
    assetStatusData,
    zoneDistributionData,
    recentActivity
  } = reportData;

  const fullReport = {
    metadata: {
      exportDate: new Date().toISOString(),
      filters: filters,
      dataSource: 'database'
    },
    summary: stats,
    assets: assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      status: asset.status,
      zone: asset.zone,
      latitude: asset.lat,
      longitude: asset.lng,
      description: asset.description
    })),
    assetStatusByType: assetStatusData,
    zoneDistribution: zoneDistributionData,
    recentActivity: recentActivity
  };

  const filename = `full-report_${getTimestamp()}`;
  exportToJSON(fullReport, filename);
};

/**
 * Main export handler
 * @param {string} exportType - Type of export
 * @param {Object} data - Data to export
 * @param {Object} filters - Current filter settings
 */
export const handleExport = (exportType, data, filters = {}) => {
  try {
    switch (exportType) {
      case EXPORT_TYPES.ASSET_STATUS:
        exportAssetStatus(data.assetStatusData, filters);
        break;
      
      case EXPORT_TYPES.ZONE_DISTRIBUTION:
        exportZoneDistribution(data.zoneDistributionData, filters);
        break;
      
      case EXPORT_TYPES.ACTIVITY_LOG:
        exportActivityLog(data.recentActivity, filters);
        break;
      
      case EXPORT_TYPES.FULL_REPORT:
      case 'full-report':
        // Use backend API for JSON export
        exportToJSONBackend(filters);
        break;

      case 'pdf':
        // Use backend API for PDF export
        exportToPDFBackend(filters);
        break;

      case 'print':
        // Use backend API for print view
        openPrintViewBackend(filters);
        break;
      
      default:
        console.warn(`Unknown export type: ${exportType}`);
        alert(`Export type "${exportType}" is not supported`);
    }
  } catch (error) {
    console.error('Export failed:', error);
    alert('Export failed. Please try again.');
  }
};

/**
 * Export report to PDF using backend API
 * @param {Object} filters - Current filter settings
 */
export const exportToPDFBackend = async (filters = {}) => {
  try {
    console.log('📄 Exporting PDF via backend...', filters);
    
    // Get auth token
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Authentication required. Please login again.');
      window.location.href = '/login';
      return;
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (filters.zone && filters.zone !== 'all') params.append('zone', filters.zone);
    if (filters.assetType && filters.assetType !== 'all') params.append('type', filters.assetType);
    if (filters.timeRange) params.append('timeRange', filters.timeRange);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const url = `${API_URL}api/export/pdf${params.toString() ? '?' + params.toString() : ''}`;

    // Fetch PDF from backend
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`PDF export failed: ${response.status} ${response.statusText}`);
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `PLUS-CCS-Report-${getTimestamp()}.pdf`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Download the PDF
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    console.log(`✅ Successfully exported ${filename}`);
  } catch (error) {
    console.error('❌ PDF export failed:', error);
    alert('Failed to export PDF. Please try again.');
  }
};

/**
 * Export report to JSON using backend API
 * @param {Object} filters - Current filter settings
 */
export const exportToJSONBackend = async (filters = {}) => {
  try {
    console.log('📦 Exporting JSON via backend...', filters);
    
    // Get auth token
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Authentication required. Please login again.');
      window.location.href = '/login';
      return;
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (filters.zone && filters.zone !== 'all') params.append('zone', filters.zone);
    if (filters.assetType && filters.assetType !== 'all') params.append('type', filters.assetType);
    if (filters.timeRange) params.append('timeRange', filters.timeRange);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const url = `${API_URL}api/export/json${params.toString() ? '?' + params.toString() : ''}`;

    // Fetch JSON from backend
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`JSON export failed: ${response.status} ${response.statusText}`);
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `PLUS-CCS-Report-${getTimestamp()}.json`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Download the JSON
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    console.log(`✅ Successfully exported ${filename}`);
  } catch (error) {
    console.error('❌ JSON export failed:', error);
    alert('Failed to export JSON. Please try again.');
  }
};

/**
 * Open printable report in new window using backend API
 * @param {Object} filters - Current filter settings
 */
export const openPrintViewBackend = async (filters = {}) => {
  try {
    console.log('🖨️ Opening print view via backend...', filters);
    
    // Get auth token
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Authentication required. Please login again.');
      window.location.href = '/login';
      return;
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (filters.zone && filters.zone !== 'all') params.append('zone', filters.zone);
    if (filters.assetType && filters.assetType !== 'all') params.append('type', filters.assetType);
    if (filters.timeRange) params.append('timeRange', filters.timeRange);
    params.append('token', token); // Pass token as query param for new window

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const url = `${API_URL}api/export/print${params.toString() ? '?' + params.toString() : ''}`;

    // Open print view in new window
    const printWindow = window.open(url, '_blank', 'width=1024,height=768');
    
    if (!printWindow) {
      alert('Please allow popups to open the print view');
      return;
    }

    console.log('✅ Print view opened successfully');
  } catch (error) {
    console.error('❌ Failed to open print view:', error);
    alert('Failed to open print view. Please try again.');
  }
};

/**
 * Export report to PDF format
 * @param {Object} data - Report data
 * @param {Object} filters - Current filter settings
 */
export const exportToPDF = (data, filters = {}) => {
  const { stats, assetStatusData, zoneDistributionData, recentActivity } = data;
  
  // Create new PDF document
  const doc = new jsPDF();
  
  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PLUS CCS Monitoring System Report', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${getFormattedDate()}`, pageWidth / 2, yPos, { align: 'center' });
  
  // Filter information
  yPos += 10;
  doc.setFontSize(9);
  doc.setTextColor(100);
  const filterText = `Filters: Region: ${filters.zone || 'All'} | Type: ${filters.assetType || 'All'} | Period: ${filters.timeRange || '7 days'}`;
  doc.text(filterText, pageWidth / 2, yPos, { align: 'center' });
  doc.setTextColor(0);
  
  yPos += 15;

  // Summary Statistics
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary Statistics', 14, yPos);
  
  yPos += 8;
  doc.autoTable({
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Total Assets', stats.totalAssets?.toString() || '0'],
      ['Online Assets', stats.activeAssets?.toString() || '0'],
      ['Offline Assets', stats.inactiveAssets?.toString() || '0'],
      ['Warning Status', stats.warningAssets?.toString() || '0'],
      ['Average Uptime', `${stats.avgUptime?.toFixed(1) || '0'}%`],
      ['Total Incidents', stats.totalIncidents?.toString() || '0'],
      ['Resolved Incidents', stats.resolvedIncidents?.toString() || '0'],
      ['Pending Incidents', stats.pendingIncidents?.toString() || '0']
    ],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold' } }
  });
  
  yPos = doc.lastAutoTable.finalY + 15;

  // Asset Status by Type
  if (assetStatusData && assetStatusData.length > 0) {
    // Check if we need a new page
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Asset Status by Type', 14, yPos);
    
    yPos += 8;
    doc.autoTable({
      startY: yPos,
      head: [['Asset Type', 'Online', 'Offline', 'Warning', 'Total', 'Uptime %']],
      body: assetStatusData.map(item => [
        item.name || 'Unknown',
        (item.active || 0).toString(),
        (item.inactive || 0).toString(),
        (item.warning || 0).toString(),
        (item.total || 0).toString(),
        item.total > 0 ? `${Math.round((item.active / item.total) * 100)}%` : '0%'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;
  }

  // Zone Distribution
  if (zoneDistributionData && zoneDistributionData.length > 0) {
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Region Distribution', 14, yPos);
    
    yPos += 8;
    const total = zoneDistributionData.reduce((sum, zone) => sum + (zone.value || 0), 0);
    doc.autoTable({
      startY: yPos,
      head: [['Region', 'Asset Count', 'Percentage']],
      body: zoneDistributionData.map(item => [
        item.name || 'Unknown',
        (item.value || 0).toString(),
        total > 0 ? `${Math.round((item.value / total) * 100)}%` : '0%'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;
  }

  // Recent Activity (First 15 entries)
  if (recentActivity && recentActivity.length > 0) {
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Recent Activity (Last 15 Events)', 14, yPos);
    
    yPos += 8;
    doc.autoTable({
      startY: yPos,
      head: [['Time', 'Event', 'Location', 'Status']],
      body: recentActivity.slice(0, 15).map(item => [
        item.time || '',
        item.event || '',
        item.location || '',
        item.status || ''
      ]),
      theme: 'grid',
      headStyles: { fillColor: [231, 76, 60], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 
        0: { cellWidth: 30 },
        1: { cellWidth: 60 },
        2: { cellWidth: 50 },
        3: { cellWidth: 30 }
      }
    });
  }

  // Footer on all pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount} | PLUS CCS Monitoring System | ${getFormattedDate()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const filename = `PLUS-CCS-Report_${getTimestamp()}.pdf`;
  doc.save(filename);
  console.log(`✅ Successfully exported ${filename}`);
};

/**
 * Generate printable HTML report
 * @param {Object} data - Report data
 * @param {Object} filters - Current filter settings
 */
export const generatePrintableReport = (data, filters = {}) => {
  const { stats, assetStatusData, zoneDistributionData, recentActivity } = data;
  
  // Create a new window for the printable report
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (!printWindow) {
    alert('Please allow popups to generate printable report');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PLUS CCS Monitoring Report</title>
      <style>
        @media print {
          @page { margin: 0.5in; }
          .no-print { display: none; }
          .page-break { page-break-after: always; }
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background: #fff;
          padding: 20px;
        }
        
        .header {
          text-align: center;
          border-bottom: 3px solid #2c3e50;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        
        .header h1 {
          color: #2c3e50;
          font-size: 28px;
          margin-bottom: 10px;
        }
        
        .header .subtitle {
          color: #7f8c8d;
          font-size: 14px;
        }
        
        .filters {
          background: #ecf0f1;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 30px;
          text-align: center;
          font-size: 13px;
        }
        
        .section {
          margin-bottom: 30px;
        }
        
        .section-title {
          color: #2c3e50;
          font-size: 20px;
          border-bottom: 2px solid #3498db;
          padding-bottom: 8px;
          margin-bottom: 15px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        
        table th {
          background: #3498db;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
        }
        
        table td {
          padding: 10px;
          border-bottom: 1px solid #ddd;
        }
        
        table tr:nth-child(even) {
          background: #f8f9fa;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 30px;
        }
        
        .stat-card {
          background: #fff;
          border: 2px solid #e1e4e8;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
        }
        
        .stat-label {
          font-size: 12px;
          color: #7f8c8d;
          margin-bottom: 5px;
        }
        
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #2c3e50;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #ecf0f1;
          text-align: center;
          color: #95a5a6;
          font-size: 12px;
        }
        
        .print-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 12px 30px;
          font-size: 16px;
          border-radius: 5px;
          cursor: pointer;
          margin: 20px 0;
        }
        
        .print-btn:hover {
          background: #2980b9;
        }
      </style>
    </head>
    <body>
      <button class="print-btn no-print" onclick="window.print()">🖨️ Print Report</button>
      
      <div class="header">
        <h1>PLUS CCS Monitoring System Report</h1>
        <div class="subtitle">Comprehensive Asset Monitoring and Status Report</div>
        <div class="subtitle">Generated on: ${getFormattedDate()}</div>
      </div>
      
      <div class="filters">
        <strong>Applied Filters:</strong> 
        Region: ${filters.zone || 'All'} | 
        Asset Type: ${filters.assetType || 'All'} | 
        Time Period: ${filters.timeRange || '7 days'}
      </div>
      
      <div class="section">
        <h2 class="section-title">Summary Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Assets</div>
            <div class="stat-value">${stats.totalAssets || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Online</div>
            <div class="stat-value" style="color: #27ae60;">${stats.activeAssets || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Offline</div>
            <div class="stat-value" style="color: #e74c3c;">${stats.inactiveAssets || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Warning</div>
            <div class="stat-value" style="color: #f39c12;">${stats.warningAssets || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Avg Uptime</div>
            <div class="stat-value">${stats.avgUptime?.toFixed(1) || 0}%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Incidents</div>
            <div class="stat-value">${stats.totalIncidents || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Resolved</div>
            <div class="stat-value" style="color: #27ae60;">${stats.resolvedIncidents || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Pending</div>
            <div class="stat-value" style="color: #e67e22;">${stats.pendingIncidents || 0}</div>
          </div>
        </div>
      </div>
      
      ${assetStatusData && assetStatusData.length > 0 ? `
      <div class="section page-break">
        <h2 class="section-title">Asset Status by Type</h2>
        <table>
          <thead>
            <tr>
              <th>Asset Type</th>
              <th>Online</th>
              <th>Offline</th>
              <th>Warning</th>
              <th>Total</th>
              <th>Uptime %</th>
            </tr>
          </thead>
          <tbody>
            ${assetStatusData.map(item => `
              <tr>
                <td><strong>${item.name || 'Unknown'}</strong></td>
                <td style="color: #27ae60;">${item.active || 0}</td>
                <td style="color: #e74c3c;">${item.inactive || 0}</td>
                <td style="color: #f39c12;">${item.warning || 0}</td>
                <td><strong>${item.total || 0}</strong></td>
                <td>${item.total > 0 ? Math.round((item.active / item.total) * 100) : 0}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${zoneDistributionData && zoneDistributionData.length > 0 ? `
      <div class="section">
        <h2 class="section-title">Region Distribution</h2>
        <table>
          <thead>
            <tr>
              <th>Region</th>
              <th>Asset Count</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const total = zoneDistributionData.reduce((sum, zone) => sum + (zone.value || 0), 0);
              return zoneDistributionData.map(item => `
                <tr>
                  <td><strong>${item.name || 'Unknown'}</strong></td>
                  <td>${item.value || 0}</td>
                  <td>${total > 0 ? Math.round((item.value / total) * 100) : 0}%</td>
                </tr>
              `).join('');
            })()}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${recentActivity && recentActivity.length > 0 ? `
      <div class="section page-break">
        <h2 class="section-title">Recent Activity (Last 20 Events)</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${recentActivity.slice(0, 20).map(item => `
              <tr>
                <td>${item.time || ''}</td>
                <td>${item.event || ''}</td>
                <td>${item.location || ''}</td>
                <td><strong>${item.status || ''}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      <div class="footer">
        <p><strong>PLUS CCS Monitoring System</strong></p>
        <p>Asset Management & Monitoring Report</p>
        <p>This report contains confidential information. Distribution is restricted.</p>
      </div>
    </body>
    </html>
  `;
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  console.log('✅ Printable report generated successfully');
};
