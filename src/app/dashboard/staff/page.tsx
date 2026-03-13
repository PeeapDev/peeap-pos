"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  UserCog,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  Phone,
  Mail,
  Shield,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Modal from "@/components/ui/Modal";

interface Staff {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "manager" | "cashier";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ROLE_BADGES = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  cashier: "bg-green-100 text-green-700",
};

const PERMISSIONS = {
  Sales: ["create_sales", "view_sales", "refund_sales", "apply_discounts"],
  Products: ["view_products", "create_products", "edit_products", "delete_products"],
  Reports: ["view_reports", "export_reports"],
  Settings: ["view_settings", "edit_settings"],
  Staff: ["view_staff", "manage_staff"],
};

const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: Object.values(PERMISSIONS).flat(),
  manager: [
    "create_sales",
    "view_sales",
    "refund_sales",
    "apply_discounts",
    "view_products",
    "create_products",
    "edit_products",
    "view_reports",
    "export_reports",
    "view_settings",
    "view_staff",
  ],
  cashier: [
    "create_sales",
    "view_sales",
    "apply_discounts",
    "view_products",
  ],
};

export default function StaffPage() {
  const { token } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "cashier">("cashier");
  const [pin, setPin] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchStaff = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/staff?active=false", { headers });
      const data = await res.json();
      setStaff(data.staff || []);
    } catch (err) {
      console.error("Failed to load staff:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staff;
    const q = search.toLowerCase();
    return staff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
    );
  }, [staff, search]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setRole("cashier");
    setPin("");
    setPermissions(ROLE_DEFAULTS.cashier);
    setModalOpen(true);
  };

  const openEdit = (member: Staff) => {
    setEditing(member);
    setName(member.name);
    setEmail(member.email || "");
    setPhone(member.phone || "");
    setRole(member.role);
    setPin("");
    setPermissions(ROLE_DEFAULTS[member.role] || []);
    setModalOpen(true);
  };

  const handleRoleChange = (newRole: "admin" | "manager" | "cashier") => {
    setRole(newRole);
    setPermissions(ROLE_DEFAULTS[newRole] || []);
  };

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        role,
      };
      if (email) body.email = email;
      if (phone) body.phone = phone;
      if (pin && /^\d{4,6}$/.test(pin)) body.pin = pin;

      const url = editing ? `/api/staff?id=${editing.id}` : "/api/staff";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setModalOpen(false);
      fetchStaff();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save staff member");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: Staff) => {
    try {
      const res = await fetch(`/api/staff?id=${member.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ is_active: !member.is_active }),
      });
      if (!res.ok) throw new Error("Update failed");
      fetchStaff();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to update staff status"
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/staff?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteTarget(null);
      fetchStaff();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to delete staff member"
      );
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="w-6 h-6" />
            Staff Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {staff.length} staff members
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <UserCog className="w-12 h-12 mx-auto mb-3" />
            <p className="font-medium">No staff members found</p>
            <p className="text-sm mt-1">
              {search
                ? "Try a different search"
                : "Add your first staff member"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Phone
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStaff.map((member) => (
                  <tr
                    key={member.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      !member.is_active ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {member.name}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          ROLE_BADGES[member.role]
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {member.role.charAt(0).toUpperCase() +
                          member.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {member.email ? (
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          {member.email}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {member.phone ? (
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {member.phone}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(member)}
                        className="inline-flex items-center gap-1"
                        title={
                          member.is_active ? "Deactivate" : "Activate"
                        }
                      >
                        {member.is_active ? (
                          <ToggleRight className="w-6 h-6 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(member)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(member)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Staff Member" : "Add Staff Member"}
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) =>
                  handleRoleChange(
                    e.target.value as "admin" | "manager" | "cashier"
                  )
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="+232 XX XXX XXX"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PIN (4-6 digits)
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setPin(val);
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder={editing ? "Leave blank to keep current PIN" : "1234"}
              maxLength={6}
            />
            <p className="text-xs text-gray-400 mt-1">
              Used for POS terminal authentication
            </p>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Permissions
            </label>
            <div className="space-y-4">
              {Object.entries(PERMISSIONS).map(([group, perms]) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {group}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {perms.map((perm) => (
                      <label
                        key={perm}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                          permissions.includes(perm)
                            ? "bg-green-50 border-green-300 text-green-700"
                            : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={permissions.includes(perm)}
                          onChange={() => togglePermission(perm)}
                          className="sr-only"
                        />
                        {perm
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-6 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Staff Member"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              Are you sure you want to deactivate{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>?
              They will no longer be able to access the POS system.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Deactivate
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
