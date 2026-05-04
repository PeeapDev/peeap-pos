"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Smartphone,
  Plus,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Modal from "@/components/ui/Modal";

interface Device {
  device_sn: string;
  model: string | null;
  profile: string | null;
  terminal_label: string | null;
  status: string;
  claimed_by_user_id: string | null;
  claimed_at: string | null;
  last_seen_at: string | null;
  last_synced_at: string | null;
  cloud_state: any;
  created_at: string;
}

function relTime(iso: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function PosDevicesPage() {
  const { token } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [snInput, setSnInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/vendor/pos/devices", { headers });
      const data = await res.json();
      if (res.ok) setDevices(data.devices || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    setError(null);
    const sn = snInput.trim();
    if (sn.length < 4) {
      setError("Enter the device SN printed on the back of the unit.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/vendor/pos/devices", {
        method: "POST",
        headers,
        body: JSON.stringify({
          device_sn: sn,
          terminal_label: labelInput.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Could not add device.");
        return;
      }
      setAddOpen(false);
      setSnInput("");
      setLabelInput("");
      setToast(`Device ${sn} added to your store.`);
      load();
    } catch (e: any) {
      setError(e?.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-green-600" />
            Scan-to-Pay Devices
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            HEMI terminals paired to your store. Cashiers sign in to one device
            per shift.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Add Device
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed p-12 text-center">
          <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-900">No devices yet</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Pair your first HEMI terminal to start accepting scan-to-pay.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Add your first device
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Device</th>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Cashier</th>
                <th className="px-4 py-3 text-left">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {devices.map((d) => {
                const online =
                  d.last_seen_at &&
                  Date.now() - new Date(d.last_seen_at).getTime() < 5 * 60_000;
                return (
                  <tr key={d.device_sn} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">
                      {d.device_sn}
                      {d.model && (
                        <span className="ml-2 text-gray-400">({d.model})</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {d.terminal_label || (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                          online
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {online ? (
                          <Wifi className="w-3 h-3" />
                        ) : (
                          <WifiOff className="w-3 h-3" />
                        )}
                        {online ? "online" : "offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.claimed_by_user_id ? (
                        <span className="text-xs font-mono text-gray-600">
                          signed in
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">idle</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {relTime(d.last_seen_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setError(null);
        }}
        title="Add HEMI Device"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Type the SN printed on the back of the device. Power the device on
            and connect it to WiFi first so it shows up in your inventory.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Device SN
            </label>
            <input
              type="text"
              value={snInput}
              onChange={(e) => setSnInput(e.target.value)}
              placeholder="e.g. 2512230002"
              autoFocus
              className="w-full px-3 py-2 border rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (optional)
            </label>
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="e.g. Front Counter"
              maxLength={40}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setAddOpen(false)}
              className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={submitting || snInput.trim().length < 4}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Device"
              )}
            </button>
          </div>
        </div>
      </Modal>

      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">{toast}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 p-1 hover:bg-green-500 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
