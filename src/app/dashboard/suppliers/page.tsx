"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Package,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/currency";
import Modal from "@/components/ui/Modal";

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  total_orders: number;
  total_spent: number;
  created_at: string;
}

export default function SuppliersPage() {
  const { token } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchSuppliers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers", { headers });
      const data = await res.json();
      setSuppliers(data.suppliers || []);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
    );
  }, [suppliers, search]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setPaymentTerms("");
    setNotes("");
    setModalOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setName(supplier.name);
    setContactName(supplier.contact_name || "");
    setEmail(supplier.email || "");
    setPhone(supplier.phone || "");
    setAddress(supplier.address || "");
    setPaymentTerms(supplier.payment_terms || "");
    setNotes(supplier.notes || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (contactName) body.contact_name = contactName;
      if (email) body.email = email;
      if (phone) body.phone = phone;
      if (address) body.address = address;
      if (paymentTerms) body.payment_terms = paymentTerms;
      if (notes) body.notes = notes;

      const url = editing
        ? `/api/suppliers?id=${editing.id}`
        : "/api/suppliers";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/suppliers?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteTarget(null);
      fetchSuppliers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete supplier");
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Suppliers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {suppliers.length} suppliers
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search suppliers..."
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
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Truck className="w-12 h-12 mx-auto mb-3" />
            <p className="font-medium">No suppliers found</p>
            <p className="text-sm mt-1">
              {search
                ? "Try a different search"
                : "Add your first supplier"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Supplier
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Contact
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Phone
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Payment Terms
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Orders
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Total Spent
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {supplier.name}
                      </p>
                      {supplier.address && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {supplier.address}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {supplier.contact_name || (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {supplier.phone ? (
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {supplier.phone}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {supplier.email ? (
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          {supplier.email}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {supplier.payment_terms || (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="flex items-center justify-end gap-1 text-gray-600">
                        <Package className="w-3.5 h-3.5 text-gray-400" />
                        {supplier.total_orders}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {supplier.total_spent
                        ? formatCurrency(supplier.total_spent)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(supplier)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(supplier)}
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
        title={editing ? "Edit Supplier" : "Add Supplier"}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. Acme Wholesale"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Person
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="John Smith"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="supplier@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="123 Market St, Freetown"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Terms
            </label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select terms</option>
              <option value="Cash on Delivery">Cash on Delivery</option>
              <option value="Net 7">Net 7 (7 days)</option>
              <option value="Net 15">Net 15 (15 days)</option>
              <option value="Net 30">Net 30 (30 days)</option>
              <option value="Net 60">Net 60 (60 days)</option>
              <option value="Prepaid">Prepaid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Additional notes about this supplier"
            />
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
        title="Delete Supplier"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>?
              This action cannot be undone.
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
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
