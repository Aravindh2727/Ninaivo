/**
 * Export Service for Ninaivo
 * Handles Excel (CSV with UTF-8 BOM) and Printable PDF export
 * Supports English and Tamil Unicode text natively
 */

/**
 * Clean text for CSV cells (escape quotes and handle newlines)
 */
function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export entries to Excel-compatible CSV with UTF-8 BOM
 */
export function exportToExcel(entries, workspace, options = {}) {
  const {
    dateRange = {},
    category = 'All',
    includeFinancials = true
  } = options;

  const currency = workspace?.settings?.currency || '₹';
  const wsName = workspace?.name || 'Workspace';

  // Filter entries
  const filtered = entries.filter(e => {
    if (category !== 'All' && e.entryType !== category) return false;
    if (dateRange.start && e.date < dateRange.start) return false;
    if (dateRange.end && e.date > dateRange.end) return false;
    return true;
  });

  // Sort chronologically
  filtered.sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00')));

  // CSV Headers
  const headers = [
    'Entry ID',
    'Date',
    'Time',
    'Title',
    'Category',
    'Description',
    'Location',
    'Creator',
    'Tags',
    'Attachments Count'
  ];

  if (includeFinancials) {
    headers.push('Transaction Type', `Amount (${currency})`);
  }

  const rows = [headers.map(escapeCsvCell).join(',')];

  filtered.forEach(entry => {
    const row = [
      entry.id,
      entry.date || '',
      entry.time || '',
      entry.title || '',
      entry.entryType || '',
      (entry.description || '').replace(/\r?\n/g, ' '),
      entry.location || '',
      entry.authorName || 'Member',
      (entry.tags || []).join('; '),
      (entry.attachments || []).length
    ];

    if (includeFinancials) {
      row.push(
        entry.amountType ? entry.amountType.toUpperCase() : 'NONE',
        entry.amount !== null && entry.amount !== undefined ? entry.amount : ''
      );
    }

    rows.push(row.map(escapeCsvCell).join(','));
  });

  const csvContent = rows.join('\r\n');
  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility with Tamil text
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const sanitizedWs = wsName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];

  a.href = url;
  a.download = `ninaivo_export_${sanitizedWs}_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, count: filtered.length };
}

/**
 * Generate a printable PDF / Print window report for diary entries
 */
export function exportToPrintablePdf(entries, workspace, options = {}) {
  const {
    dateRange = {},
    category = 'All',
    includeFinancials = true,
    language = 'en'
  } = options;

  const currency = workspace?.settings?.currency || '₹';
  const wsName = workspace?.name || 'Diary Workspace';
  const wsType = (workspace?.type || 'personal').toUpperCase();

  // Filter entries
  const filtered = entries.filter(e => {
    if (category !== 'All' && e.entryType !== category) return false;
    if (dateRange.start && e.date < dateRange.start) return false;
    if (dateRange.end && e.date > dateRange.end) return false;
    return true;
  });

  // Sort chronological
  filtered.sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00')));

  // Calculate financials
  let totalIncome = 0;
  let totalExpense = 0;
  filtered.forEach(e => {
    if (e.amount && !isNaN(e.amount)) {
      if (e.amountType === 'income') totalIncome += Number(e.amount);
      if (e.amountType === 'expense' || !e.amountType) totalExpense += Number(e.amount);
    }
  });
  const netBalance = totalIncome - totalExpense;

  const dateRangeText = dateRange.start || dateRange.end 
    ? `${dateRange.start || 'Beginning'} to ${dateRange.end || 'Present'}`
    : 'All Time History';

  const exportDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Open printable window
  const printWindow = window.open('', '_blank', 'width=900,height=750');
  if (!printWindow) {
    alert('Please allow popups for this site to generate the printable PDF report.');
    return { success: false, error: 'Popup blocked' };
  }

  const html = `
    <!DOCTYPE html>
    <html lang="${language}">
    <head>
      <meta charset="UTF-8">
      <title>Ninaivo Report - ${wsName}</title>
      <style>
        @page {
          size: A4;
          margin: 1.5cm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #1e293b;
          line-height: 1.5;
          margin: 0;
          padding: 24px;
        }
        .header {
          border-bottom: 2px solid #6366f1;
          padding-bottom: 14px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .title {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
        }
        .badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          background: #e0e7ff;
          color: #4338ca;
          text-transform: uppercase;
        }
        .meta {
          font-size: 12px;
          color: #64748b;
        }
        .summary-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px 18px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
        }
        .summary-stat {
          font-size: 12px;
          color: #64748b;
        }
        .summary-val {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .income-val { color: #10b981; }
        .expense-val { color: #ef4444; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 12px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid #cbd5e1;
        }
        td {
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }
        tr:nth-child(even) td {
          background: #fcfcfd;
        }
        .tag {
          font-size: 10px;
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          color: #475569;
          margin-right: 4px;
          display: inline-block;
        }
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 16px; display: flex; gap: 8px; justify-content: flex-end;">
        <button onclick="window.print()" style="padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          Print / Save PDF
        </button>
      </div>

      <div class="header">
        <div>
          <h1 class="title">${wsName}</h1>
          <div class="meta">
            <span class="badge">${wsType} WORKSPACE</span> &nbsp;|&nbsp; 
            <strong>Date Range:</strong> ${dateRangeText} &nbsp;|&nbsp;
            <strong>Category:</strong> ${category}
          </div>
        </div>
        <div class="meta" style="text-align: right;">
          <strong>Generated:</strong> ${exportDate}<br>
          <strong>Total Records:</strong> ${filtered.length}
        </div>
      </div>

      <div class="summary-box">
        <div>
          <div class="summary-stat">Total Diary Entries</div>
          <div class="summary-val">${filtered.length}</div>
        </div>
        ${includeFinancials && (totalIncome > 0 || totalExpense > 0) ? `
          <div>
            <div class="summary-stat">Total Income</div>
            <div class="summary-val income-val">+${currency}${totalIncome.toLocaleString()}</div>
          </div>
          <div>
            <div class="summary-stat">Total Expenses</div>
            <div class="summary-val expense-val">-${currency}${totalExpense.toLocaleString()}</div>
          </div>
          <div>
            <div class="summary-stat">Net Balance</div>
            <div class="summary-val" style="color: ${netBalance >= 0 ? '#10b981' : '#ef4444'}">
              ${netBalance >= 0 ? '+' : ''}${currency}${netBalance.toLocaleString()}
            </div>
          </div>
        ` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 15%;">Date & Time</th>
            <th style="width: 14%;">Category</th>
            <th style="width: 45%;">Entry Details</th>
            <th style="width: 13%;">Location / Author</th>
            ${includeFinancials ? '<th style="width: 13%; text-align: right;">Amount</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${filtered.map(e => `
            <tr>
              <td>
                <strong>${e.date || ''}</strong><br>
                <span style="color: #64748b; font-size: 11px;">${e.time || ''}</span>
              </td>
              <td>
                <span class="badge" style="font-size: 10px;">${e.entryType || 'General'}</span>
              </td>
              <td>
                <strong style="color: #0f172a; font-size: 13px;">${e.title || ''}</strong>
                ${e.description ? `<p style="margin: 4px 0 6px 0; color: #475569; white-space: pre-wrap;">${e.description}</p>` : ''}
                ${(e.tags || []).length > 0 ? `<div>${e.tags.map(t => `<span class="tag">#${t}</span>`).join('')}</div>` : ''}
                ${(e.attachments || []).length > 0 ? `<div style="font-size: 11px; color: #6366f1; margin-top: 4px;">📷 ${e.attachments.length} attachment(s)</div>` : ''}
              </td>
              <td>
                ${e.location ? `<div style="font-size: 11px; color: #0284c7;">📍 ${e.location}</div>` : ''}
                <div style="font-size: 11px; color: #64748b;">👤 ${e.authorName || 'Member'}</div>
              </td>
              ${includeFinancials ? `
                <td style="text-align: right; font-weight: 700; color: ${e.amountType === 'income' ? '#10b981' : e.amount ? '#ef4444' : '#94a3b8'}">
                  ${e.amount ? `${e.amountType === 'income' ? '+' : '-'}${currency}${Number(e.amount).toLocaleString()}` : '-'}
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <span>Ninaivo &bull; Confidential Workspace Records</span>
        <span>Page 1 of 1</span>
      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  return { success: true, count: filtered.length };
}

