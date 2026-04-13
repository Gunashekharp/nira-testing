import { useCallback, useEffect, useRef, useState } from "react";
import { fetchQueueForDoctor } from "../services/gunaEmrBridge";

const DEFAULT_POLL_INTERVAL_MS = 10000;

export function useEmrQueueFeed(doctorName, options = {}) {
  const { enabled = true, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS } = options;
  const mountedRef = useRef(true);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !doctorName) {
      if (!mountedRef.current) return;
      setQueue([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const payload = await fetchQueueForDoctor(doctorName);
      if (!mountedRef.current) return;
      setQueue(Array.isArray(payload?.queue) ? payload.queue : []);
      setError("");
      setLastUpdatedAt(new Date().toISOString());
    } catch (nextError) {
      if (!mountedRef.current) return;
      setError(String(nextError?.message || nextError));
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }, [doctorName, enabled]);

  useEffect(() => {
    if (!enabled || !doctorName) return;

    refresh();
    const timer = window.setInterval(refresh, pollIntervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [doctorName, enabled, pollIntervalMs, refresh]);

  return {
    queue,
    loading,
    error,
    lastUpdatedAt,
    refresh
  };
}
