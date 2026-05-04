"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Plus,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Trash2,
  Crown,
  Briefcase,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Modal from "@/components/ui/Modal";

type Role = "owner" | "manager" | "cashier";

interface Staff {
  id: string;
  user_id: string;
  role: Role;
  status: string;
  invited_at: string | null;
  joined_at: string | null;
  invited_via: string | null;
  user: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  } | null;
}

const ROLE_BADGE: Record<Role, string> = {
  owner: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  cashier: "bg-green-100 text-green-700",
};

const ROLE_ICON: Record<Role, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  manager: Briefcase,
  cashier: ShoppingBag,
};

export default function PosStaffPage() {
  const { token, user } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [roleInput, setRoleInput] = useState<Role>("cashier");
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
      const res = await fetch("/api/vendor/pos/staff", { headers });
      const data = await res.json();
      if (res.ok) setStaff(data.staff || []);
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
    const phone = phoneInput.trim();
    if (!phone) {
      setError("Enter a Peeap phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/vendor/pos/staff", {
        method: "POST",
        headers,
        body: JSON.stringify({ phone, role: roleInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Could not add staff.");
        return;
      }
      setAddOpen(false);
      setPhoneInput("");
      setRoleInput("cashier");
      const name =
        [data.staff?.user?.first_name, data.staff?.user?.last_name]
          .filter(Boolean)
          .join(" ") || phone;
      setToast(`${name} added as ${data.staff?.role}.`);
      load();
    } catch (e: any) {
      setError(e?.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (id: string, role: Role) => {
    try {
      const res = await fetch(`/api/vendor/pos/staff/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setStaff((prev) =>
          prev.map((s) => (s.id === id ? { ...s, role } : s))
        );
      }
    } catch {
      // ignore
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this staff member? Their open shift will be closed.")) {
      return;
    }
    try {
      const res = await fetch(`/api/vendor/pos/staff/${id}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        setStaff((prev) => prev.filter((s) => s.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Could not remove.");
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-green-600" />
            POS Cashiers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            People who can sign in to your scan-to-pay devices and run charges.
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
            Invite by Phone
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-900">No cashiers yet</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Invite people by their Peeap phone number — they'll be able to sign
            in to a device and run charges.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Invite first cashier
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Cashier</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((s) => {
                const isMe = user?.id === s.user_id;
                const Icon = ROLE_ICON[s.role] || ShoppingBag;
                const fullName =
                  [s.user?.first_name, s.user?.last_name]
                    .filter(Boolean)
                    .join(" ") || "—";
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {fullName}
                      {isMe && (
                        <span className="ml-2 text-xs text-gray-400">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.user?.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={s.role}
                        onChange={(e) =>
                          handleRoleChange(s.id, e.target.value as Role)
                        }
                        disabled={isMe || s.role === "owner"}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer disabled:cursor-not-allowed ${
                          ROLE_BADGE[s.role]
                        }`}
                      >
                        <option value="owner">owner</option>
                        <option value="manager">manager</option>
                        <option value="cashier">cashier</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.status === "approved"
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isMe && s.role !== "owner" && (
                        <button
                          onClick={() => handleRemove(s.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
        title="Invite Cashier"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            They need a Peeap account already. We'll add them by their phone
            number — they sign in on the device with their existing Peeap
            credentials.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone number
            </label>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="076123456 or +23276123456"
              autoFocus
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value as Role)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="cashier">Cashier — can charge</option>
              <option value="manager">Manager — can charge + close shifts</option>
            </select>
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
              disabled={submitting || !phoneInput.trim()}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Inviting...
                </>
              ) : (
                "Invite"
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
