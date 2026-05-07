/*
 * Sync architecture for future cloud providers.
 * The app remains fully local/offline unless a real adapter is configured.
 */
(function () {
  function readConfig() {
    return {
      supabaseUrl: window.NEXT_PUBLIC_SUPABASE_URL || window.TRUEVIEW_SUPABASE_URL || "",
      supabaseAnonKey: window.NEXT_PUBLIC_SUPABASE_ANON_KEY || window.TRUEVIEW_SUPABASE_ANON_KEY || ""
    };
  }

  function isConfigured() {
    const config = readConfig();
    return Boolean(config.supabaseUrl && config.supabaseAnonKey);
  }

  async function attemptSync() {
    const db = window.TrueViewOfflineDB;
    if (!db) {
      return { ok: false, status: "local-db-unavailable", message: "Local database unavailable." };
    }

    const summary = await db.getSyncSummary();
    if (!navigator.onLine) {
      return {
        ok: false,
        status: "offline",
        message: "Offline - saved locally",
        pending: summary.pending,
        failed: summary.failed,
        conflicts: summary.conflicts,
        lastSyncedAt: summary.lastSyncedAt
      };
    }

    if (!isConfigured()) {
      return {
        ok: false,
        status: "not-configured",
        message: "Cloud sync not configured",
        pending: summary.pending,
        failed: summary.failed,
        conflicts: summary.conflicts,
        lastSyncedAt: summary.lastSyncedAt
      };
    }

    return {
      ok: false,
      status: "adapter-pending",
      message: "Cloud adapter ready for Supabase credentials, but upload tables are not enabled yet",
      pending: summary.pending,
      failed: summary.failed,
      conflicts: summary.conflicts,
      lastSyncedAt: summary.lastSyncedAt
    };
  }

  function describeConflictStrategy() {
    return "Local newer records stay local and queue for sync. Remote newer records must be reviewed. If both changed, mark conflict and never overwrite silently.";
  }

  window.TrueViewSync = {
    readConfig,
    isConfigured,
    attemptSync,
    describeConflictStrategy
  };
})();
