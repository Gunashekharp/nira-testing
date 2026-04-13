import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * Subscribe to realtime changes on a Supabase table.
 * Returns { data, loading, error }.
 */
export function useRealtimeTable(table, { filter, column, value, event = "*" } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initial fetch
    let query = supabase.from(table).select("*");
    if (filter) query = query.match(filter);
    if (column && value) query = query.eq(column, value);

    query.order("created_at", { ascending: false }).then(({ data: rows, error: err }) => {
      if (err) setError(err);
      else setData(rows || []);
      setLoading(false);
    });

    // Realtime subscription
    const channelFilter = column && value
      ? { event, schema: "public", table, filter: `${column}=eq.${value}` }
      : { event, schema: "public", table };

    const channel = supabase
      .channel(`${table}-realtime`)
      .on("postgres_changes", channelFilter, (payload) => {
        setData((prev) => {
          if (payload.eventType === "INSERT") return [payload.new, ...prev];
          if (payload.eventType === "UPDATE")
            return prev.map((r) => (r.id === payload.new.id ? payload.new : r));
          if (payload.eventType === "DELETE")
            return prev.filter((r) => r.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [table, column, value, event]);

  return { data, loading, error };
}

/**
 * Subscribe to the doctor queue — encounters with status planned/arrived/in-progress.
 */
export function useDoctorQueue(clinicId) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;

    supabase
      .from("encounters")
      .select("*, patients(id, user_id, phone), user_profiles!encounters_doctor_id_fkey(full_name)")
      .eq("clinic_id", clinicId)
      .in("status", ["planned", "arrived", "in-progress"])
      .order("scheduled_time", { ascending: true })
      .then(({ data }) => {
        setQueue(data || []);
        setLoading(false);
      });

    const channel = supabase
      .channel("doctor-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encounters", filter: `clinic_id=eq.${clinicId}` },
        (payload) => {
          setQueue((prev) => {
            const activeStatuses = ["planned", "arrived", "in-progress"];
            if (payload.eventType === "DELETE") return prev.filter((e) => e.id !== payload.old.id);
            if (!activeStatuses.includes(payload.new?.status))
              return prev.filter((e) => e.id !== payload.new.id);
            const exists = prev.find((e) => e.id === payload.new.id);
            if (exists) return prev.map((e) => (e.id === payload.new.id ? { ...e, ...payload.new } : e));
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [clinicId]);

  return { queue, loading };
}

/**
 * Subscribe to a patient's prescription updates.
 */
export function usePatientPrescriptions(patientId) {
  return useRealtimeTable("medication_requests", {
    column: "patient_id",
    value: patientId,
  });
}

/**
 * Presence tracking for multi-doctor queue sync.
 */
export function usePresence(channelName, userInfo) {
  const [members, setMembers] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!channelName || !userInfo) return;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: userInfo.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setMembers(Object.values(state).flat());
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(userInfo);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [channelName, userInfo?.id]);

  return members;
}

/**
 * Broadcast events (e.g. notifications).
 */
export function useBroadcast(channelName) {
  const channelRef = useRef(null);

  useEffect(() => {
    channelRef.current = supabase.channel(channelName).subscribe();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [channelName]);

  const send = useCallback(
    (event, payload) => {
      channelRef.current?.send({ type: "broadcast", event, payload });
    },
    []
  );

  const onMessage = useCallback(
    (event, callback) => {
      channelRef.current?.on("broadcast", { event }, ({ payload }) => callback(payload));
    },
    []
  );

  return { send, onMessage };
}
