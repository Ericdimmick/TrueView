/*
 * Supabase sync adapter for TrueView.
 * Local IndexedDB remains the source of truth while field work is happening.
 */
(function () {
  const REPORT_TABLE = "trueview_reports";
  const PHOTO_TABLE = "trueview_photos";

  function readConfig() {
    const env = window.TrueViewEnv || {};
    return {
      supabaseUrl: trimTrailingSlash(env.NEXT_PUBLIC_SUPABASE_URL || window.NEXT_PUBLIC_SUPABASE_URL || window.TRUEVIEW_SUPABASE_URL || ""),
      supabaseKey:
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        window.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        window.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        window.TRUEVIEW_SUPABASE_ANON_KEY ||
        "",
      syncSpaceId: env.NEXT_PUBLIC_TRUEVIEW_SYNC_SPACE_ID || window.NEXT_PUBLIC_TRUEVIEW_SYNC_SPACE_ID || "default"
    };
  }

  function trimTrailingSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function isConfigured() {
    const config = readConfig();
    return Boolean(config.supabaseUrl && config.supabaseKey);
  }

  function supabaseHeaders(prefer) {
    const config = readConfig();
    return {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      "Content-Type": "application/json",
      "x-trueview-sync-space-id": config.syncSpaceId,
      ...(prefer ? { Prefer: prefer } : {})
    };
  }

  function tableUrl(table, query = "") {
    const config = readConfig();
    return `${config.supabaseUrl}/rest/v1/${table}${query}`;
  }

  async function attemptSync() {
    const db = window.TrueViewOfflineDB;
    if (!db) {
      return { ok: false, status: "local-db-unavailable", message: "Local database unavailable." };
    }

    const summary = await db.getSyncSummary();
    if (!navigator.onLine) {
      return summaryResult(summary, "offline", "Offline - saved locally", false);
    }

    if (!isConfigured()) {
      return summaryResult(summary, "not-configured", "Cloud sync not configured", false);
    }

    try {
      const [reportResult, photoResult] = await Promise.all([
        syncReports(db, summary.queue || []),
        syncPhotos(db, summary.queue || [])
      ]);
      await db.setSyncMeta({ lastSyncedAt: new Date().toISOString() });
      const nextSummary = await db.getSyncSummary();
      return {
        ...summaryResult(nextSummary, "synced", "Synced", true),
        pulledReports: reportResult.pulledReports,
        deletedReportIds: reportResult.deletedReportIds,
        pulledPhotos: photoResult.pulledPhotos,
        conflicts: nextSummary.conflicts + reportResult.conflicts + photoResult.conflicts
      };
    } catch (error) {
      console.warn(error);
      const nextSummary = await db.getSyncSummary();
      return summaryResult(nextSummary, "failed", error.message || "Cloud sync failed", false);
    }
  }

  async function syncLibrary(library, options = {}) {
    const summary = {
      pending: (library?.reports || []).filter((report) => report.syncStatus === "pending").length,
      failed: (library?.reports || []).filter((report) => report.syncStatus === "failed").length,
      conflicts: (library?.reports || []).filter((report) => report.syncStatus === "conflict").length,
      lastSyncedAt: ""
    };

    if (!navigator.onLine) {
      return summaryResult(summary, "offline", "Offline - saved locally", false);
    }

    if (!isConfigured()) {
      return summaryResult(summary, "not-configured", "Cloud sync not configured", false);
    }

    try {
      const result = await syncLibraryReports(library, options);
      return {
        ...summaryResult({ pending: 0, failed: 0, conflicts: result.conflicts, lastSyncedAt: new Date().toISOString() }, "synced", "Synced", true),
        pulledReports: result.pulledReports,
        deletedReportIds: result.deletedReportIds,
        pulledPhotos: []
      };
    } catch (error) {
      console.warn(error);
      return summaryResult(summary, "failed", error.message || "Cloud sync failed", false);
    }
  }

  async function syncLibraryReports(library, options = {}) {
    const localReports = (library?.reports || []).filter((report) => report && report.id);
    const remoteRows = await fetchRemoteReports();
    const remoteByLocalId = new Map(remoteRows.map((row) => [row.local_id, row]));
    const localIds = new Set(localReports.map((report) => report.id));
    const pulledReports = [];
    const deletedReportIds = [];
    let conflicts = 0;

    for (const report of localReports) {
      const remote = remoteByLocalId.get(report.id);
      const localUpdated = timeValue(report.updatedAt || report.lastSavedAt || report.createdAt);
      const remoteUpdated = remote ? remoteReportTime(remote) : 0;
      const hasPendingLocal = report.syncStatus === "pending" || !remote;

      if (remote?.deleted_at && !hasPendingLocal && remoteUpdated >= localUpdated) {
        deletedReportIds.push(report.id);
        continue;
      }

      if (remote && remoteUpdated > localUpdated && hasPendingLocal && remote.device_id && remote.device_id !== (report.deviceId || options.deviceId || "")) {
        report.syncStatus = "conflict";
        report.reportStatus = "Conflict";
        conflicts += 1;
        continue;
      }

      if (remote && remoteUpdated > localUpdated && !hasPendingLocal) {
        pulledReports.push(normalizeRemoteReport(remote));
        continue;
      }

      if (!remote && isBlankStarterReport(report)) {
        continue;
      }

      if (!remote || localUpdated >= remoteUpdated || hasPendingLocal) {
        const saved = await upsertReport({
          localId: report.id,
          deviceId: options.deviceId || report.deviceId || "",
          updatedAt: report.updatedAt || report.lastSavedAt || new Date().toISOString(),
          report: {
            ...report,
            deviceId: options.deviceId || report.deviceId || ""
          }
        });
        report.remoteId = saved.remote_id || report.remoteId || "";
        report.syncStatus = "synced";
      }
    }

    for (const remote of remoteRows) {
      if (localIds.has(remote.local_id)) continue;
      if (remote.deleted_at) {
        deletedReportIds.push(remote.local_id);
        continue;
      }
      pulledReports.push(normalizeRemoteReport(remote));
    }

    return { pulledReports, deletedReportIds, conflicts };
  }

  async function syncReports(db, queue) {
    const localRecords = await db.getReportRecords();
    const deletedRecords = db.getDeletedReportRecords ? await db.getDeletedReportRecords() : [];
    const remoteRows = await fetchRemoteReports();
    const remoteByLocalId = new Map(remoteRows.map((row) => [row.local_id, row]));
    const deletedIds = new Set(deletedRecords.map((record) => record.localId));
    const queuedReportIds = new Set(queue.filter((entry) => entry.entity === "report" && entry.mutationType !== "report-delete" && ["pending", "failed"].includes(entry.status)).map((entry) => entry.entityLocalId));
    const queuedDeleteIds = new Set(queue.filter((entry) => entry.entity === "report" && entry.mutationType === "report-delete" && ["pending", "failed"].includes(entry.status)).map((entry) => entry.entityLocalId));
    const pulledReports = [];
    const deletedReportIds = [];
    let conflicts = 0;

    for (const deletedRecord of deletedRecords) {
      const localId = deletedRecord.localId;
      const remote = remoteByLocalId.get(localId);
      if (!queuedDeleteIds.has(localId) && deletedRecord.syncStatus === "synced") continue;
      try {
        const saved = await upsertReportDeletion(deletedRecord, remote);
        await db.markReportDeleteSynced(localId, saved.remote_id || remote?.remote_id || "");
      } catch (error) {
        await db.markEntityFailed(localId, "report", error.message);
      }
    }

    for (const localRecord of localRecords) {
      const localReport = localRecord.report || {};
      const localId = localRecord.localId || localReport.id;
      if (deletedIds.has(localId)) continue;
      const remote = remoteByLocalId.get(localId);
      const localUpdated = timeValue(localReport.updatedAt || localRecord.updatedAt);
      const remoteUpdated = remote ? remoteReportTime(remote) : 0;
      const hasPendingLocal = queuedReportIds.has(localId);

      if (remote?.deleted_at && !hasPendingLocal && remoteUpdated >= localUpdated) {
        await db.saveRemoteDeletedReport(normalizeRemoteDeletedReport(remote));
        deletedReportIds.push(localId);
        continue;
      }

      if (remote && remoteUpdated > localUpdated && hasPendingLocal && remote.device_id !== localRecord.deviceId) {
        await db.markEntityConflict(localId, "report");
        conflicts += 1;
        continue;
      }

      if (remote && remoteUpdated > localUpdated && !hasPendingLocal) {
        const pulled = normalizeRemoteReport(remote);
        await db.saveRemoteReport(pulled, remote.remote_id);
        pulledReports.push(pulled);
        continue;
      }

      if (!remote || hasPendingLocal) {
        try {
          const saved = await upsertReport(localRecord);
          await db.markReportSynced(localId, saved.remote_id || remote?.remote_id || "");
        } catch (error) {
          await db.markEntityFailed(localId, "report", error.message);
        }
      }
    }

    for (const remote of remoteRows) {
      if (localRecords.some((record) => (record.localId || record.report?.id) === remote.local_id)) continue;
      if (deletedIds.has(remote.local_id)) continue;
      if (remote.deleted_at) {
        await db.saveRemoteDeletedReport(normalizeRemoteDeletedReport(remote));
        deletedReportIds.push(remote.local_id);
        continue;
      }
      const pulled = normalizeRemoteReport(remote);
      await db.saveRemoteReport(pulled, remote.remote_id);
      pulledReports.push(pulled);
    }

    return { pulledReports, deletedReportIds, conflicts };
  }

  async function syncPhotos(db, queue) {
    const localPhotos = await db.getPhotoRecords();
    const remoteRows = await fetchRemotePhotos();
    const remoteByLocalId = new Map(remoteRows.map((row) => [row.local_id, row]));
    const queuedPhotoIds = new Set(queue.filter((entry) => entry.entity === "photo" && ["pending", "failed"].includes(entry.status)).map((entry) => entry.entityLocalId));
    const pulledPhotos = [];
    let conflicts = 0;

    for (const localPhoto of localPhotos) {
      const localId = localPhoto.localId;
      const remote = remoteByLocalId.get(localId);
      const localUpdated = timeValue(localPhoto.updatedAt || localPhoto.createdAt);
      const remoteUpdated = remote ? timeValue(remote.local_updated_at || remote.updated_at) : 0;
      const hasPendingLocal = queuedPhotoIds.has(localId);

      if (remote && remoteUpdated > localUpdated && hasPendingLocal && remote.device_id !== localPhoto.deviceId) {
        await db.markEntityConflict(localId, "photo");
        conflicts += 1;
        continue;
      }

      if (remote && remoteUpdated > localUpdated && !hasPendingLocal) {
        const pulled = normalizeRemotePhoto(remote);
        await db.saveRemotePhoto(pulled, remote.remote_id);
        pulledPhotos.push(pulled);
        continue;
      }

      if (!remote || hasPendingLocal) {
        try {
          const saved = await upsertPhoto(localPhoto);
          await db.markPhotoSynced(localId, saved.remote_id || remote?.remote_id || "");
        } catch (error) {
          await db.markEntityFailed(localId, "photo", error.message);
        }
      }
    }

    for (const remote of remoteRows) {
      if (localPhotos.some((photo) => photo.localId === remote.local_id)) continue;
      const pulled = normalizeRemotePhoto(remote);
      await db.saveRemotePhoto(pulled, remote.remote_id);
      pulledPhotos.push(pulled);
    }

    return { pulledPhotos, conflicts };
  }

  async function fetchRemoteReports() {
    const config = readConfig();
    const query = `?sync_space_id=eq.${encodeURIComponent(config.syncSpaceId)}&select=*`;
    const response = await fetch(tableUrl(REPORT_TABLE, query), {
      headers: supabaseHeaders()
    });
    return readSupabaseJson(response);
  }

  async function fetchRemotePhotos() {
    const config = readConfig();
    const query = `?sync_space_id=eq.${encodeURIComponent(config.syncSpaceId)}&select=*`;
    const response = await fetch(tableUrl(PHOTO_TABLE, query), {
      headers: supabaseHeaders()
    });
    return readSupabaseJson(response);
  }

  async function upsertReport(localRecord) {
    const report = localRecord.report || {};
    const inspection = report.inspection || {};
    const payload = {
      sync_space_id: readConfig().syncSpaceId,
      local_id: localRecord.localId || report.id,
      device_id: localRecord.deviceId || report.deviceId || "",
      report,
      property_address: inspection.propertyAddress || "",
      client_name: inspection.clientName || "",
      inspection_date: inspection.inspectionDate || null,
      report_status: report.reportStatus || "Draft",
      local_updated_at: report.updatedAt || localRecord.updatedAt || new Date().toISOString(),
      deleted_at: null
    };
    const response = await fetch(tableUrl(REPORT_TABLE, "?on_conflict=sync_space_id,local_id"), {
      method: "POST",
      headers: supabaseHeaders("resolution=merge-duplicates,return=representation"),
      body: JSON.stringify(payload)
    });
    const rows = await readSupabaseJson(response);
    return rows[0] || payload;
  }

  async function upsertReportDeletion(deletedRecord, remote) {
    const report = deletedRecord.report || remote?.report || { id: deletedRecord.localId };
    const inspection = report.inspection || {};
    const deletedAt = deletedRecord.deletedAt || new Date().toISOString();
    const payload = {
      sync_space_id: readConfig().syncSpaceId,
      local_id: deletedRecord.localId,
      device_id: deletedRecord.deviceId || "",
      report: {
        ...report,
        id: report.id || deletedRecord.localId,
        deletedAt,
        syncStatus: "synced"
      },
      property_address: deletedRecord.propertyAddress || inspection.propertyAddress || remote?.property_address || "",
      client_name: inspection.clientName || remote?.client_name || "",
      inspection_date: inspection.inspectionDate || remote?.inspection_date || null,
      report_status: "Deleted",
      local_updated_at: deletedAt,
      deleted_at: deletedAt
    };
    const response = await fetch(tableUrl(REPORT_TABLE, "?on_conflict=sync_space_id,local_id"), {
      method: "POST",
      headers: supabaseHeaders("resolution=merge-duplicates,return=representation"),
      body: JSON.stringify(payload)
    });
    const rows = await readSupabaseJson(response);
    return rows[0] || payload;
  }

  async function upsertPhoto(localPhoto) {
    const payload = {
      sync_space_id: readConfig().syncSpaceId,
      local_id: localPhoto.localId,
      report_local_id: localPhoto.reportId || "",
      section_id: localPhoto.sectionId || "",
      item_id: localPhoto.itemId || "",
      observation_id: localPhoto.observationId || "",
      usage: localPhoto.usage || "inspection-photo",
      data_url: localPhoto.dataUrl || "",
      storage_path: localPhoto.storagePath || "",
      device_id: localPhoto.deviceId || "",
      local_updated_at: localPhoto.updatedAt || localPhoto.createdAt || new Date().toISOString()
    };
    const response = await fetch(tableUrl(PHOTO_TABLE, "?on_conflict=sync_space_id,local_id"), {
      method: "POST",
      headers: supabaseHeaders("resolution=merge-duplicates,return=representation"),
      body: JSON.stringify(payload)
    });
    const rows = await readSupabaseJson(response);
    return rows[0] || payload;
  }

  async function readSupabaseJson(response) {
    const text = await response.text();
    const data = text ? JSON.parse(text) : [];
    if (!response.ok) {
      const message = data?.message || data?.error_description || data?.error || response.statusText;
      throw new Error(message);
    }
    return data;
  }

  function normalizeRemoteReport(row) {
    const report = row.report || {};
    return {
      ...report,
      id: report.id || row.local_id,
      remoteId: row.remote_id || report.remoteId || "",
      syncStatus: "synced",
      updatedAt: report.updatedAt || row.local_updated_at || row.updated_at
    };
  }

  function normalizeRemoteDeletedReport(row) {
    return {
      localId: row.local_id,
      id: row.local_id,
      remoteId: row.remote_id || "",
      report: row.report || null,
      propertyAddress: row.property_address || "",
      deletedAt: row.deleted_at || row.local_updated_at || row.updated_at,
      deviceId: row.device_id || ""
    };
  }

  function remoteReportTime(row) {
    return Math.max(
      timeValue(row.local_updated_at),
      timeValue(row.deleted_at),
      timeValue(row.updated_at)
    );
  }

  function normalizeRemotePhoto(row) {
    return {
      id: row.local_id,
      localId: row.local_id,
      remoteId: row.remote_id || "",
      reportId: row.report_local_id || "",
      sectionId: row.section_id || "",
      itemId: row.item_id || "",
      observationId: row.observation_id || "",
      usage: row.usage || "inspection-photo",
      dataUrl: row.data_url || "",
      storagePath: row.storage_path || "",
      syncStatus: "synced",
      updatedAt: row.local_updated_at || row.updated_at,
      deviceId: row.device_id || ""
    };
  }

  function isBlankStarterReport(report) {
    if (!report || report.remoteId || report.exportedAt || report.exportFolder || report.exportPdfPath) return false;

    const ignoredInspectionKeys = new Set(["inspectionDate", "companyName"]);
    const inspectionHasContent = Object.entries(report.inspection || {}).some(([key, value]) => {
      if (ignoredInspectionKeys.has(key)) return false;
      return String(value || "").trim().length > 0;
    });
    if (inspectionHasContent) return false;

    const sections = report.sections || [];
    return sections.every((section, index) => {
      if (section.isArchived || section.isApplicable === false || section.deletedAt) return false;
      if (Number.isFinite(Number(section.sortOrder)) && Number(section.sortOrder) !== index + 1) return false;
      return (section.items || []).every((item) => {
        const hasObservations = Array.isArray(item.observations) && item.observations.length > 0;
        const hasStatus = String(item.status || "").trim().length > 0;
        const changedCondition = item.condition && item.condition !== "satisfactory";
        return !hasObservations && !hasStatus && !changedCondition;
      });
    });
  }

  function timeValue(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function summaryResult(summary, status, message, ok) {
    return {
      ok,
      status,
      message,
      pending: summary.pending,
      failed: summary.failed,
      conflicts: summary.conflicts,
      lastSyncedAt: summary.lastSyncedAt
    };
  }

  function describeConflictStrategy() {
    return "Local data saves first. During sync, newer remote data is pulled only when there is no pending local edit. If both local and remote changed, TrueView marks a conflict and does not overwrite silently.";
  }

  window.TrueViewSync = {
    readConfig,
    isConfigured,
    attemptSync,
    syncLibrary,
    describeConflictStrategy
  };
})();
