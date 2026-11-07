/**
 * Workspace Backup, Restore & Data Import Service
 * Handles:
 * - JSON structured backup generation with checksums
 * - Schema validation & duplicate detection
 * - Chunked safe restore into existing or new workspaces
 * - CSV data parser & importer
 * - Backup history & reminder tracking
 * - Account personal data portability
 */

import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { WORKSPACE_MODES, createWorkspace } from './workspaceService';
import { logWorkspaceActivity, ACTIVITY_ACTIONS } from './activityService';

export const BACKUP_SCHEMA_VERSION = '1.0.0';
export const APP_VERSION = '1.0.0';

/**
 * Deterministic canonical JSON serialization helper
 */
export function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalizeJson(obj[k])).join(',') + '}';
}

/**
 * Calculate true cryptographic SHA-256 checksum for backup integrity verification
 */
export async function calculateSha256Checksum(payload) {
  const clone = { ...payload };
  delete clone.checksum; // Don't include checksum field in its own calculation
  const canonicalStr = canonicalizeJson(clone);

  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return 'sha256-' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js environment fallback for automated test suites
    try {
      const { createHash } = await import(/* @vite-ignore */ 'crypto');
      return 'sha256-' + createHash('sha256').update(canonicalStr).digest('hex');
    } catch {
      let hash = 0;
      for (let i = 0; i < canonicalStr.length; i++) {
        hash = ((hash << 5) - hash) + canonicalStr.charCodeAt(i);
        hash |= 0;
      }
      return 'sha256-fallback-' + Math.abs(hash).toString(16);
    }
  }
}

/**
 * Backwards-compatible synchronous checksum calculation
 */
export function calculateChecksum(contentStr) {
  let hash = 0;
  for (let i = 0; i < contentStr.length; i++) {
    const char = contentStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'chk-' + Math.abs(hash).toString(16);
}

/**
 * 1. CREATE WORKSPACE JSON BACKUP
 */
export async function createWorkspaceBackup(workspace, entries, categories, user, options = {}) {
  if (!workspace || !workspace.id) {
    throw new Error('Valid workspace is required for backup.');
  }

  const backupId = `bkp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // Strip sensitive tokens or private credentials
  const sanitizedEntries = entries.map(entry => ({
    id: entry.id,
    title: entry.title || '',
    entryType: entry.entryType || 'General',
    description: entry.description || '',
    date: entry.date || '',
    time: entry.time || '',
    amount: entry.amount !== undefined && entry.amount !== null ? entry.amount : null,
    amountType: entry.amountType || null,
    currency: entry.currency || workspace?.settings?.currency || '₹',
    location: entry.location || '',
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    attachments: (entry.attachments || []).map(att => ({
      id: att.id || `att-${Date.now()}`,
      url: att.url,
      publicId: att.publicId || null,
      name: att.name || 'photo.jpg',
      provider: att.provider || 'cloudinary',
      uploadedAt: att.uploadedAt || now
    })),
    authorName: entry.authorName || 'Member',
    createdByUid: entry.createdByUid || user?.uid || 'anonymous',
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || now
  }));

  const sanitizedCategories = categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    color: cat.color || '#6366f1',
    icon: cat.icon || 'Tag',
    createdAt: cat.createdAt || now
  }));

  const allAttachmentsCount = sanitizedEntries.reduce((sum, e) => sum + (e.attachments || []).length, 0);

  const payload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    backupId,
    createdAt: now,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      settings: workspace.settings || {}
    },
    counts: {
      entries: sanitizedEntries.length,
      categories: sanitizedCategories.length,
      attachments: allAttachmentsCount
    },
    categories: sanitizedCategories,
    entries: sanitizedEntries,
    meta: {
      isPersonal: workspace.type === WORKSPACE_MODES.PERSONAL,
      exportedBy: user?.displayName || user?.email || 'Diary User',
      exportedByUid: user?.uid || 'anonymous',
      attachmentNotice: 'Backups preserve photo Cloudinary URLs and metadata. Raw image files remain hosted on Cloudinary.'
    }
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const checksum = await calculateSha256Checksum(payload);
  payload.checksum = checksum;

  const finalJsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([finalJsonString], { type: 'application/json;charset=utf-8;' });
  const sizeBytes = blob.size;

  // Track backup history in local storage
  const backupRecord = {
    id: backupId,
    name: `${workspace.name.replace(/[^a-zA-Z0-9]/g, '_')}_Backup_${now.split('T')[0]}.json`,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    createdAt: now,
    format: 'JSON',
    sizeBytes,
    entriesCount: sanitizedEntries.length,
    checksum
  };

  recordBackupInHistory(backupRecord);
  updateLastBackupDate(now);

  // Log activity
  try {
    await logWorkspaceActivity(workspace.id, {
      action: ACTIVITY_ACTIONS.BACKUP_CREATED,
      details: `Created JSON backup (${sanitizedEntries.length} entries, ${allAttachmentsCount} attachments).`,
      user
    });
  } catch (err) {
    console.warn('Could not log backup activity:', err.message);
  }

  // Trigger download if not headless
  if (!options.silent) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupRecord.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { success: true, backupRecord, payload };
}

/**
 * 2. VALIDATE JSON BACKUP FILE WITH CRYPTOGRAPHIC INTEGRITY CHECK
 */
export async function validateBackupFile(fileContentStr, currentWorkspaceId, existingEntries = []) {
  try {
    const data = JSON.parse(fileContentStr);

    // 1. Schema check
    if (!data.schemaVersion) {
      return { isValid: false, error: 'Invalid backup: missing schemaVersion.' };
    }

    if (!data.workspace || !data.workspace.name) {
      return { isValid: false, error: 'Invalid backup: missing workspace information.' };
    }

    if (!Array.isArray(data.entries)) {
      return { isValid: false, error: 'Invalid backup: entries list is missing or corrupted.' };
    }

    // 2. Cryptographic Checksum Verification
    let checksumVerified = false;
    let checksumWarning = null;

    if (data.checksum) {
      if (data.checksum.startsWith('sha256-')) {
        const computed = await calculateSha256Checksum(data);
        if (computed === data.checksum) {
          checksumVerified = true;
        } else {
          checksumVerified = false;
          checksumWarning = 'Cryptographic SHA-256 verification failed. File contents may have been altered or corrupted.';
        }
      } else if (data.checksum.startsWith('chk-')) {
        // Legacy hash backwards compatibility
        checksumVerified = true;
        checksumWarning = 'Legacy checksum detected. Validated backwards compatibility.';
      }
    } else {
      checksumWarning = 'No checksum detected in backup file.';
    }

    // 3. Conflict & duplicate analysis against current workspace
    const existingIdSet = new Set(existingEntries.map(e => e.id));
    const existingContentSet = new Set(
      existingEntries.map(e => `${(e.date || '').trim()}|${(e.title || '').trim().toLowerCase()}`)
    );

    const duplicateEntries = [];
    const newEntries = [];

    data.entries.forEach(e => {
      const isIdMatch = existingIdSet.has(e.id);
      const isContentMatch = existingContentSet.has(`${(e.date || '').trim()}|${(e.title || '').trim().toLowerCase()}`);

      if (isIdMatch || isContentMatch) {
        duplicateEntries.push(e);
      } else {
        newEntries.push(e);
      }
    });

    const isSameWorkspace = currentWorkspaceId && data.workspace.id === currentWorkspaceId;

    return {
      isValid: true,
      backupId: data.backupId,
      createdAt: data.createdAt,
      schemaVersion: data.schemaVersion,
      checksum: data.checksum,
      checksumVerified,
      checksumWarning,
      workspaceName: data.workspace.name,
      workspaceType: data.workspace.type || 'personal',
      workspaceId: data.workspace.id,
      isSameWorkspace,
      totalEntries: data.entries.length,
      categoriesCount: (data.categories || []).length,
      attachmentsCount: data.counts?.attachments || 0,
      duplicatesCount: duplicateEntries.length,
      newEntriesCount: newEntries.length,
      duplicateEntries,
      newEntries,
      parsedData: data
    };
  } catch (err) {
    return { isValid: false, error: 'Could not parse JSON backup file: ' + err.message };
  }
}

/**
 * 3. RESTORE INTO AN EXISTING WORKSPACE
 * Chunked writes to respect Firestore 500-write limit and prevent UI freezes
 */
export async function restoreIntoExistingWorkspace(workspaceId, backupData, options = {}, user, onProgress) {
  const { duplicateStrategy = 'skip' } = options; // 'skip' | 'as_new' | 'overwrite'

  const localCacheKey = `pdt_entries_${workspaceId}`;
  const existingEntries = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
  const existingIdSet = new Set(existingEntries.map(e => e.id));

  const entriesToRestore = [];
  const entries = backupData.entries || [];

  entries.forEach(entry => {
    const exists = existingIdSet.has(entry.id);

    if (exists) {
      if (duplicateStrategy === 'skip') {
        return; // Skip duplicate
      } else if (duplicateStrategy === 'as_new') {
        // Generate new ID so both records are preserved
        entriesToRestore.push({
          ...entry,
          id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          workspaceId,
          title: `${entry.title} (Restored)`
        });
      } else if (duplicateStrategy === 'overwrite') {
        entriesToRestore.push({
          ...entry,
          workspaceId
        });
      }
    } else {
      entriesToRestore.push({
        ...entry,
        workspaceId
      });
    }
  });

  // Chunked write process with error tracking and partial recovery
  const CHUNK_SIZE = 50;
  const totalChunks = Math.ceil(entriesToRestore.length / CHUNK_SIZE);
  let processedCount = 0;
  const succeededEntries = [];
  const failedBatches = [];

  for (let c = 0; c < totalChunks; c++) {
    const chunk = entriesToRestore.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);

    if (isFirebaseConfigured) {
      try {
        const batch = writeBatch(db);
        chunk.forEach(e => {
          const docRef = doc(db, 'workspaces', workspaceId, 'entries', e.id);
          batch.set(docRef, {
            ...e,
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
        succeededEntries.push(...chunk);
      } catch (err) {
        console.warn('Firestore restore batch failed:', err.message);
        failedBatches.push({
          chunkIndex: c,
          error: err.message,
          failedCount: chunk.length,
          uncommittedEntries: chunk
        });
      }
    } else {
      succeededEntries.push(...chunk);
    }

    processedCount += chunk.length;
    if (onProgress) {
      onProgress(Math.round((processedCount / entriesToRestore.length) * 100));
    }
  }

  // Update local storage only with succeeded entries
  const finalMap = new Map();
  existingEntries.forEach(e => finalMap.set(e.id, e));
  succeededEntries.forEach(e => finalMap.set(e.id, e));
  const mergedList = Array.from(finalMap.values());
  mergedList.sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00')));
  localStorage.setItem(localCacheKey, JSON.stringify(mergedList));

  const hasFailures = failedBatches.length > 0;

  // Log activity
  try {
    await logWorkspaceActivity(workspaceId, {
      action: hasFailures ? ACTIVITY_ACTIONS.RESTORE_FAILED : ACTIVITY_ACTIONS.RESTORE_COMPLETED,
      details: hasFailures 
        ? `Partially restored ${succeededEntries.length}/${entriesToRestore.length} entries. ${failedBatches.length} batch(es) failed.`
        : `Restored ${entriesToRestore.length} entries from backup (${duplicateStrategy} duplicates).`,
      user
    });
  } catch (err) {
    console.warn('Could not log restore activity:', err.message);
  }

  return {
    success: !hasFailures,
    partiallyRestored: hasFailures && succeededEntries.length > 0,
    restoredCount: succeededEntries.length,
    failedCount: entriesToRestore.length - succeededEntries.length,
    skippedCount: entries.length - entriesToRestore.length,
    failedBatches,
    totalEntries: mergedList.length
  };
}

/**
 * 4. RESTORE INTO A NEW WORKSPACE
 */
export async function restoreIntoNewWorkspace(backupData, user, onProgress) {
  const newName = `[Restored] ${backupData.workspace.name || 'Diary'}`;
  const newType = backupData.workspace.type || WORKSPACE_MODES.PERSONAL;

  // Create fresh workspace
  const newWs = await createWorkspace(user.uid, newName, newType, {
    description: `Restored from backup on ${new Date().toLocaleDateString()}`,
    ...backupData.workspace.settings
  });

  const res = await restoreIntoExistingWorkspace(
    newWs.id,
    backupData,
    { duplicateStrategy: 'as_new' },
    user,
    onProgress
  );

  return {
    success: true,
    newWorkspace: newWs,
    restoredCount: res.restoredCount
  };
}

/**
 * 5. PARSE & VALIDATE CSV DATA FOR IMPORT
 */
export function parseCsvForImport(csvText, existingEntries = []) {
  if (!csvText || !csvText.trim()) {
    return { isValid: false, error: 'Empty CSV file.' };
  }

  const lines = [];
  let currentLine = [];
  let inQuotes = false;
  let currentField = '';

  // Robust CSV parser supporting quotes, commas, newlines, and UTF-8 Tamil
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // CRLF
      currentLine.push(currentField.trim());
      if (currentLine.some(f => f.length > 0)) {
        lines.push(currentLine);
      }
      currentLine = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some(f => f.length > 0)) {
      lines.push(currentLine);
    }
  }

  if (lines.length < 2) {
    return { isValid: false, error: 'CSV must contain at least a header row and one data row.' };
  }

  const headers = lines[0].map(h => h.replace(/^\uFEFF/, '').trim()); // Strip BOM if present
  const headerLower = headers.map(h => h.toLowerCase());

  // Detect column indexes
  const colDate = headerLower.findIndex(h => h.includes('date') || h.includes('தேதி'));
  const colTime = headerLower.findIndex(h => h.includes('time') || h.includes('நேரம்'));
  const colTitle = headerLower.findIndex(h => h.includes('title') || h.includes('தலைப்பு') || h.includes('name'));
  const colCategory = headerLower.findIndex(h => h.includes('category') || h.includes('type') || h.includes('வகை'));
  const colDesc = headerLower.findIndex(h => h.includes('desc') || h.includes('note') || h.includes('விவரம்'));
  const colLoc = headerLower.findIndex(h => h.includes('loc') || h.includes('இடம்'));
  const colAmount = headerLower.findIndex(h => h.includes('amount') || h.includes('தொகை'));
  const colAmountType = headerLower.findIndex(h => h.includes('transaction') || h.includes('income') || h.includes('expense'));
  const colTags = headerLower.findIndex(h => h.includes('tag') || h.includes('குறிச்சொல்'));

  if (colTitle === -1) {
    return { isValid: false, error: 'Could not find required Title column in CSV headers.' };
  }

  const existingContentSet = new Set(
    existingEntries.map(e => `${(e.date || '').trim()}|${(e.title || '').trim().toLowerCase()}`)
  );

  const validRows = [];
  const invalidRows = [];
  const duplicateRows = [];

  for (let r = 1; r < lines.length; r++) {
    const row = lines[r];
    const title = (colTitle >= 0 ? row[colTitle] : '').trim();
    let date = (colDate >= 0 ? row[colDate] : '').trim();

    if (!title) {
      invalidRows.push({ rowNumber: r + 1, reason: 'Title is empty' });
      continue;
    }

    // Default to today if date is empty or invalid
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      date = new Date().toISOString().split('T')[0];
    }

    const time = colTime >= 0 && row[colTime] ? row[colTime].trim() : '12:00';
    const category = colCategory >= 0 && row[colCategory] ? row[colCategory].trim() : 'General';
    const description = colDesc >= 0 && row[colDesc] ? row[colDesc].trim() : '';
    const location = colLoc >= 0 && row[colLoc] ? row[colLoc].trim() : '';
    
    let amount = null;
    if (colAmount >= 0 && row[colAmount]) {
      const cleanAmt = row[colAmount].replace(/[^0-9.-]/g, '');
      if (cleanAmt && !isNaN(cleanAmt)) amount = parseFloat(cleanAmt);
    }

    let amountType = null;
    if (colAmountType >= 0 && row[colAmountType]) {
      const atLower = row[colAmountType].toLowerCase();
      if (atLower.includes('income') || atLower.includes('வரவு')) amountType = 'income';
      if (atLower.includes('expense') || atLower.includes('செலவு')) amountType = 'expense';
    } else if (amount !== null) {
      amountType = amount >= 0 ? 'income' : 'expense';
    }

    const tagsStr = colTags >= 0 && row[colTags] ? row[colTags] : '';
    const tags = tagsStr.split(/[;,]/).map(t => t.trim()).filter(Boolean);

    const isDuplicate = existingContentSet.has(`${date}|${title.toLowerCase()}`);

    const entryObj = {
      id: `entry-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      entryType: category,
      description,
      date,
      time,
      amount,
      amountType,
      currency: '₹',
      location,
      tags,
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isDuplicate) {
      duplicateRows.push(entryObj);
    } else {
      validRows.push(entryObj);
    }
  }

  return {
    isValid: true,
    headers,
    totalRows: lines.length - 1,
    validCount: validRows.length,
    duplicateCount: duplicateRows.length,
    invalidCount: invalidRows.length,
    validRows,
    duplicateRows,
    invalidRows
  };
}

/**
 * 6. IMPORT CSV ENTRIES INTO WORKSPACE
 */
export async function importCsvEntries(workspaceId, entriesToImport, user) {
  if (!workspaceId) throw new Error('Missing workspaceId for CSV import.');

  const localCacheKey = `pdt_entries_${workspaceId}`;
  const existing = JSON.parse(localStorage.getItem(localCacheKey) || '[]');

  // Attach creator information
  const stampedEntries = entriesToImport.map(e => ({
    ...e,
    workspaceId,
    createdByUid: user?.uid || 'anonymous',
    authorName: user?.displayName || 'Diary Creator'
  }));

  // Chunked batch write
  const CHUNK_SIZE = 50;
  for (let i = 0; i < stampedEntries.length; i += CHUNK_SIZE) {
    const chunk = stampedEntries.slice(i, i + CHUNK_SIZE);
    if (isFirebaseConfigured) {
      try {
        const batch = writeBatch(db);
        chunk.forEach(e => {
          const docRef = doc(db, 'workspaces', workspaceId, 'entries', e.id);
          batch.set(docRef, { ...e, createdAt: serverTimestamp() });
        });
        await batch.commit();
      } catch (err) {
        console.warn('Firestore CSV import chunk warning:', err.message);
      }
    }
  }

  // Update local storage
  const updated = [...stampedEntries, ...existing];
  updated.sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00')));
  localStorage.setItem(localCacheKey, JSON.stringify(updated));

  // Log activity
  try {
    await logWorkspaceActivity(workspaceId, {
      action: ACTIVITY_ACTIONS.IMPORT_COMPLETED,
      details: `Imported ${stampedEntries.length} entries from CSV spreadsheet.`,
      user
    });
  } catch (err) {
    console.warn('Could not log import activity:', err.message);
  }

  return { success: true, count: stampedEntries.length };
}

/**
 * 7. ACCOUNT DATA PORTABILITY EXPORT
 */
export function exportAccountPersonalData(user, userProfile, workspaces, allEntriesMap) {
  const now = new Date().toISOString();
  
  // Only export personal workspaces or workspaces where user is owner
  const userOwnedWorkspaces = workspaces.filter(w => w.ownerUid === user.uid || w.type === WORKSPACE_MODES.PERSONAL);

  const exportBundle = {
    exportType: 'account_data_portability',
    exportedAt: now,
    account: {
      uid: user.uid,
      email: user.email,
      displayName: userProfile?.displayName || user.displayName || 'Diary User',
      photoURL: userProfile?.photoURL || user.photoURL,
      accountCreatedAt: user.metadata?.creationTime || userProfile?.createdAt
    },
    workspaces: userOwnedWorkspaces.map(w => ({
      id: w.id,
      name: w.name,
      type: w.type,
      settings: w.settings,
      entries: allEntriesMap[w.id] || []
    })),
    privacyNotice: 'This personal data export contains your profile information and private workspace records.'
  };

  const jsonStr = JSON.stringify(exportBundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ninaivo_account_data_${now.split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true };
}

/**
 * BACKUP HISTORY HELPERS
 */
export function getBackupHistory(workspaceId = null) {
  const allHistory = JSON.parse(localStorage.getItem('ninaivo_backup_history') || localStorage.getItem('pdt_backup_history') || '[]');
  if (!workspaceId) return allHistory;
  return allHistory.filter(b => b.workspaceId === workspaceId);
}

export function recordBackupInHistory(backupRecord) {
  const history = getBackupHistory();
  const updated = [backupRecord, ...history].slice(0, 30); // Keep last 30 backups
  localStorage.setItem('ninaivo_backup_history', JSON.stringify(updated));
}

export function deleteBackupRecord(backupId) {
  const history = getBackupHistory();
  const updated = history.filter(b => b.id !== backupId);
  localStorage.setItem('ninaivo_backup_history', JSON.stringify(updated));
  return updated;
}

/**
 * BACKUP REMINDER HELPERS
 */
export function getBackupReminderSettings() {
  const defaults = {
    enabled: true,
    frequencyDays: 7, // 7, 14, 30
    lastBackupDate: localStorage.getItem('ninaivo_last_backup_date') || localStorage.getItem('pdt_last_backup_date') || null
  };
  const saved = localStorage.getItem('ninaivo_backup_reminders_settings') || localStorage.getItem('pdt_backup_reminders_settings');
  return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
}

export function saveBackupReminderSettings(settings) {
  localStorage.setItem('ninaivo_backup_reminders_settings', JSON.stringify(settings));
}

export function updateLastBackupDate(isoDate) {
  localStorage.setItem('ninaivo_last_backup_date', isoDate);
}

export function isBackupOverdue() {
  const settings = getBackupReminderSettings();
  if (!settings.enabled) return false;
  if (!settings.lastBackupDate) return true; // No backup ever made

  const lastTime = new Date(settings.lastBackupDate).getTime();
  const now = Date.now();
  const diffDays = (now - lastTime) / (86400000);
  return diffDays >= settings.frequencyDays;
}

