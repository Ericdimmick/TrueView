/*
 * TrueView offline database layer.
 * Vanilla JS is used to preserve the existing no-build architecture; JSDoc typedefs
 * keep the record shapes explicit and ready for a later TypeScript migration.
 */
(function () {
  const DB_NAME = "trueview.field.offline.v1";
  const DB_VERSION = 1;
  const DEVICE_KEY = "trueview.deviceId.v1";

  /**
   * @typedef {Object} SyncRecord
   * @property {string} localId
   * @property {string} [remoteId]
   * @property {string} entity
   * @property {string} entityLocalId
   * @property {string} mutationType
   * @property {"pending"|"syncing"|"synced"|"failed"|"conflict"} status
   * @property {number} attempts
   * @property {string} createdAt
   * @property {string} updatedAt
   * @property {string} deviceId
   */

  /**
   * @typedef {Object} OfflineReportRecord
   * @property {string} localId
   * @property {string} [remoteId]
   * @property {string} deviceId
   * @property {Object} report
   * @property {string} createdAt
   * @property {string} updatedAt
   * @property {"pending"|"synced"|"failed"|"conflict"} syncStatus
   */

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        createStore(db, "reports", "localId", ["remoteId", "updatedAt", "syncStatus"]);
        createStore(db, "clients", "localId", ["remoteId", "updatedAt"]);
        createStore(db, "properties", "localId", ["remoteId", "updatedAt"]);
        createStore(db, "reportSections", "localId", ["reportId", "sectionType", "sortOrder", "syncStatus"]);
        createStore(db, "sectionTemplates", "localId", ["sectionType"]);
        createStore(db, "inspectionItems", "localId", ["reportId", "sectionId", "syncStatus"]);
        createStore(db, "photos", "localId", ["reportId", "sectionId", "observationId", "syncStatus"]);
        createStore(db, "reportTemplates", "localId", ["updatedAt"]);
        createStore(db, "appSettings", "key", []);
        createStore(db, "syncQueue", "localId", ["entity", "entityLocalId", "status", "updatedAt"]);
        createStore(db, "syncMeta", "key", []);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  function createStore(db, name, keyPath, indexes) {
    if (db.objectStoreNames.contains(name)) return;
    const store = db.createObjectStore(name, { keyPath });
    indexes.forEach((index) => store.createIndex(index, index, { unique: false }));
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function put(storeName, value) {
    const db = await open();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    return txComplete(tx);
  }

  async function putMany(storeName, values) {
    if (!values.length) return;
    const db = await open();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    values.forEach((value) => store.put(value));
    return txComplete(tx);
  }

  async function getAll(storeName) {
    const db = await open();
    const tx = db.transaction(storeName, "readonly");
    return requestToPromise(tx.objectStore(storeName).getAll());
  }

  async function get(storeName, key) {
    const db = await open();
    const tx = db.transaction(storeName, "readonly");
    return requestToPromise(tx.objectStore(storeName).get(key));
  }

  async function remove(storeName, key) {
    const db = await open();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    return txComplete(tx);
  }

  function txComplete(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getDeviceId() {
    let deviceId = localStorage.getItem(DEVICE_KEY);
    if (deviceId) return deviceId;
    deviceId = `device-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    localStorage.setItem(DEVICE_KEY, deviceId);
    return deviceId;
  }

  async function loadLibrary() {
    if (!("indexedDB" in window)) return null;
    const records = await getAll("reports");
    if (!records.length) return null;
    const active = await get("appSettings", "activeReportId");
    const reports = records.map((record) => record.report).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    const activeReportId = reports.some((report) => report.id === active?.value) ? active.value : reports[0].id;
    return { activeReportId, reports };
  }

  async function saveLibrary(library, options = {}) {
    await put("appSettings", { key: "activeReportId", value: library.activeReportId, updatedAt: nowIso() });
    await Promise.all((library.reports || []).map((report) => saveReport(report, { ...options, queue: false })));
  }

  async function saveReport(report, options = {}) {
    if (!("indexedDB" in window)) return;
    const deviceId = getDeviceId();
    const savedAt = nowIso();
    const copy = clone(report);
    copy.deviceId = copy.deviceId || deviceId;
    copy.localId = copy.localId || copy.id;
    copy.syncStatus = copy.syncStatus || "pending";

    const reportRecord = {
      localId: copy.id,
      remoteId: copy.remoteId || "",
      deviceId,
      report: copy,
      createdAt: copy.createdAt || savedAt,
      updatedAt: copy.updatedAt || savedAt,
      syncStatus: copy.syncStatus
    };

    const sectionRecords = (copy.sections || []).map((section) => ({
      localId: section.id,
      remoteId: section.remoteId || "",
      reportId: copy.id,
      sectionType: section.sectionType || "",
      templateId: section.templateId || "",
      displayName: section.displayName || section.title || "",
      sortOrder: section.sortOrder || 0,
      isRequired: Boolean(section.isRequired),
      isApplicable: section.isApplicable !== false,
      isArchived: Boolean(section.isArchived),
      deletedAt: section.deletedAt || "",
      payload: section,
      createdAt: section.createdAt || savedAt,
      updatedAt: section.updatedAt || savedAt,
      syncStatus: "pending",
      deviceId
    }));

    const itemRecords = (copy.sections || []).flatMap((section) => (section.items || []).map((item) => ({
      localId: item.id,
      reportId: copy.id,
      sectionId: section.id,
      title: item.title,
      status: item.status || "",
      condition: item.condition || "",
      payload: item,
      updatedAt: copy.updatedAt || savedAt,
      syncStatus: "pending",
      deviceId
    })));

    await put("reports", reportRecord);
    await putMany("reportSections", sectionRecords);
    await putMany("inspectionItems", itemRecords);
    await savePropertyAndClientRecords(copy, deviceId, savedAt);

    if (options.queue !== false) {
      await enqueueMutation({
        localId: `${copy.id}:${options.mutationType || "report-upsert"}`,
        entity: "report",
        entityLocalId: copy.id,
        mutationType: options.mutationType || "report-upsert",
        status: "pending",
        attempts: 0,
        createdAt: savedAt,
        updatedAt: savedAt,
        deviceId
      });
    }
  }

  async function savePropertyAndClientRecords(report, deviceId, savedAt) {
    const inspection = report.inspection || {};
    await put("properties", {
      localId: `property:${report.id}`,
      reportId: report.id,
      address: inspection.propertyAddress || "",
      cityStateZip: inspection.cityStateZip || "",
      updatedAt: report.updatedAt || savedAt,
      deviceId
    });
    await put("clients", {
      localId: `client:${report.id}`,
      reportId: report.id,
      name: inspection.clientName || "",
      agentName: inspection.agentName || "",
      agentPhone: inspection.agentPhone || "",
      agentEmail: inspection.agentEmail || "",
      updatedAt: report.updatedAt || savedAt,
      deviceId
    });
  }

  async function saveSectionTemplates(templates) {
    const now = nowIso();
    await putMany("sectionTemplates", (templates || []).map((template) => ({
      localId: template.templateId,
      sectionType: template.sectionType,
      title: template.label,
      payload: template,
      updatedAt: now
    })));
  }

  async function savePhotoMetadata(photo) {
    const savedAt = nowIso();
    await put("photos", {
      localId: photo.id,
      reportId: photo.reportId || "",
      sectionId: photo.sectionId || "",
      itemId: photo.itemId || "",
      observationId: photo.observationId || "",
      usage: photo.usage || "inspection-photo",
      dataUrl: photo.dataUrl || "",
      syncStatus: "pending",
      createdAt: photo.createdAt || savedAt,
      updatedAt: savedAt,
      deviceId: getDeviceId()
    });
    await enqueueMutation({
      localId: `${photo.id}:photo-upsert`,
      entity: "photo",
      entityLocalId: photo.id,
      mutationType: "photo-upsert",
      status: "pending",
      attempts: 0,
      createdAt: savedAt,
      updatedAt: savedAt,
      deviceId: getDeviceId()
    });
  }

  async function deletePhotoMetadata(photoId) {
    await remove("photos", photoId);
  }

  async function enqueueMutation(record) {
    await put("syncQueue", record);
  }

  async function getSyncSummary() {
    const queue = await getAll("syncQueue");
    const meta = await get("syncMeta", "global");
    return {
      pending: queue.filter((record) => record.status === "pending").length,
      failed: queue.filter((record) => record.status === "failed").length,
      conflicts: queue.filter((record) => record.status === "conflict").length,
      syncing: queue.filter((record) => record.status === "syncing").length,
      lastSyncedAt: meta?.lastSyncedAt || "",
      queue
    };
  }

  async function deleteReport(reportId) {
    await remove("reports", reportId);
    const stores = ["reportSections", "inspectionItems", "photos", "syncQueue"];
    const recordsByStore = await Promise.all(stores.map((storeName) => getAll(storeName)));
    await Promise.all(recordsByStore.flatMap((records, index) => {
      const storeName = stores[index];
      return records
        .filter((record) => record.reportId === reportId || record.entityLocalId === reportId)
        .map((record) => remove(storeName, record.localId));
    }));
  }

  window.TrueViewOfflineDB = {
    open,
    getDeviceId,
    loadLibrary,
    saveLibrary,
    saveReport,
    deleteReport,
    saveSectionTemplates,
    savePhotoMetadata,
    deletePhotoMetadata,
    enqueueMutation,
    getSyncSummary
  };
})();
