"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface QueuedOperation {
  id: string;
  type: "sale" | "inventory" | "held_order";
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

interface OfflineSyncResult {
  isOnline: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
  addToQueue: (op: Omit<QueuedOperation, "id" | "timestamp" | "retries">) => void;
  isSyncing: boolean;
  lastSyncTime: number | null;
  lastError: string | null;
}

const QUEUE_KEY = "peeap_pos_offline_queue";
const LAST_SYNC_KEY = "peeap_pos_last_sync";
const MAX_RETRIES = 5;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getQueue(): QueuedOperation[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedOperation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage might be full; silently fail
  }
}

function getApiEndpoint(type: QueuedOperation["type"]): string {
  switch (type) {
    case "sale":
      return "/api/sales";
    case "inventory":
      return "/api/inventory";
    case "held_order":
      return "/api/held-orders";
    default:
      return "/api/sales";
  }
}

export function useOfflineSync(token: string | null): OfflineSyncResult {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const tokenRef = useRef(token);

  // Keep token ref up to date
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Initialize online status and pending count
  useEffect(() => {
    try {
      setIsOnline(navigator.onLine);
    } catch {
      setIsOnline(true);
    }

    const queue = getQueue();
    setPendingCount(queue.length);

    // Load last sync time
    try {
      const stored = localStorage.getItem(LAST_SYNC_KEY);
      if (stored) setLastSyncTime(parseInt(stored, 10));
    } catch {
      // ignore
    }
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Process a single queued operation
  const processOperation = useCallback(
    async (op: QueuedOperation): Promise<boolean> => {
      const currentToken = tokenRef.current;
      if (!currentToken) return false;

      try {
        const endpoint = getApiEndpoint(op.type);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify(op.data),
        });

        if (res.ok) {
          return true;
        }

        // 4xx errors (except 429) mean the request is invalid; don't retry
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          console.error(
            `Offline sync: operation ${op.id} failed with ${res.status}, removing from queue`
          );
          return true; // Remove from queue
        }

        return false;
      } catch {
        return false;
      }
    },
    []
  );

  // Sync all queued operations sequentially
  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    if (!tokenRef.current) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    setLastError(null);

    let remaining = [...queue];
    let hasError = false;

    for (const op of queue) {
      // Check if we went offline during sync
      try {
        if (!navigator.onLine) {
          hasError = true;
          break;
        }
      } catch {
        // ignore
      }

      const success = await processOperation(op);

      if (success) {
        remaining = remaining.filter((o) => o.id !== op.id);
        saveQueue(remaining);
        setPendingCount(remaining.length);
      } else {
        // Increment retry count
        remaining = remaining.map((o) =>
          o.id === op.id ? { ...o, retries: o.retries + 1 } : o
        );

        // Remove operations that exceeded max retries
        const overRetried = remaining.find(
          (o) => o.id === op.id && o.retries >= MAX_RETRIES
        );
        if (overRetried) {
          console.error(
            `Offline sync: operation ${op.id} exceeded max retries, removing`
          );
          remaining = remaining.filter((o) => o.id !== op.id);
        }

        saveQueue(remaining);
        setPendingCount(remaining.length);
        hasError = true;
      }
    }

    if (hasError) {
      setLastError("Some operations could not be synced");
    }

    const now = Date.now();
    setLastSyncTime(now);
    try {
      localStorage.setItem(LAST_SYNC_KEY, now.toString());
    } catch {
      // ignore
    }

    syncingRef.current = false;
    setIsSyncing(false);
  }, [processOperation]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && token) {
      // Small delay to let connection stabilize
      const timeout = setTimeout(() => {
        syncNow();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, pendingCount, token, syncNow]);

  // Add operation to queue
  const addToQueue = useCallback(
    (op: Omit<QueuedOperation, "id" | "timestamp" | "retries">) => {
      try {
        const queue = getQueue();
        const newOp: QueuedOperation = {
          ...op,
          id: generateId(),
          timestamp: Date.now(),
          retries: 0,
        };
        const updated = [...queue, newOp];
        saveQueue(updated);
        setPendingCount(updated.length);
      } catch {
        // If localStorage is full, log but don't throw
        console.error("Failed to add operation to offline queue");
      }
    },
    []
  );

  return {
    isOnline,
    pendingCount,
    syncNow,
    addToQueue,
    isSyncing,
    lastSyncTime,
    lastError,
  };
}
