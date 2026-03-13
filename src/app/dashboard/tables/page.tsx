"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutGrid,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Users,
  AlertTriangle,
  Check,
  X,
  Armchair,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/utils/currency";
import Modal from "@/components/ui/Modal";

interface Section {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  section_id: string | null;
  shape: string;
  status: "available" | "occupied" | "reserved";
  current_order_id: string | null;
  current_guests: number | null;
  current_order_total?: number;
}

const STATUS_COLORS = {
  available: "bg-green-50 border-green-300 hover:border-green-400",
  occupied: "bg-red-50 border-red-300 hover:border-red-400",
  reserved: "bg-blue-50 border-blue-300 hover:border-blue-400",
};

const STATUS_BADGES = {
  available: "bg-green-100 text-green-700",
  occupied: "bg-red-100 text-red-700",
  reserved: "bg-blue-100 text-blue-700",
};

export default function TablesPage() {
  const { token } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Table modal state
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [tableNumber, setTableNumber] = useState("");
  const [tableCapacity, setTableCapacity] = useState("4");
  const [tableSectionId, setTableSectionId] = useState("");
  const [tableShape, setTableShape] = useState("square");
  const [saving, setSaving] = useState(false);

  // Section modal state
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");

  // Action modal state
  const [actionTable, setActionTable] = useState<Table | null>(null);
  const [guestCount, setGuestCount] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: "table" | "section";
    name: string;
  } | null>(null);

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tables", { headers });
      const data = await res.json();
      setSections(data.sections || []);
      setTables(data.tables || []);
    } catch (err) {
      console.error("Failed to load tables:", err);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter tables by selected section
  const filteredTables = useMemo(() => {
    if (!activeSection) return tables;
    return tables.filter((t) => t.section_id === activeSection);
  }, [tables, activeSection]);

  const openAddTable = () => {
    setEditingTable(null);
    setTableNumber("");
    setTableCapacity("4");
    setTableSectionId(activeSection || "");
    setTableShape("square");
    setTableModalOpen(true);
  };

  const openEditTable = (table: Table) => {
    setEditingTable(table);
    setTableNumber(table.table_number);
    setTableCapacity(table.capacity.toString());
    setTableSectionId(table.section_id || "");
    setTableShape(table.shape || "square");
    setTableModalOpen(true);
  };

  const openAddSection = () => {
    setEditingSection(null);
    setSectionName("");
    setSectionDescription("");
    setSectionModalOpen(true);
  };

  const openEditSection = (section: Section) => {
    setEditingSection(section);
    setSectionName(section.name);
    setSectionDescription(section.description || "");
    setSectionModalOpen(true);
  };

  const handleSaveTable = async () => {
    if (!tableNumber.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        table_number: tableNumber.trim(),
        capacity: parseInt(tableCapacity) || 4,
        section_id: tableSectionId || null,
        shape: tableShape,
      };

      if (editingTable) {
        const res = await fetch(`/api/tables?id=${editingTable.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Update failed");
        }
      } else {
        body.type = "table";
        const res = await fetch("/api/tables", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Create failed");
        }
      }

      setTableModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save table");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSection = async () => {
    if (!sectionName.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: sectionName.trim(),
        description: sectionDescription || null,
      };

      if (editingSection) {
        const res = await fetch(
          `/api/tables?id=${editingSection.id}&type=section`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) throw new Error("Update failed");
      } else {
        body.type = "section";
        const res = await fetch("/api/tables", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Create failed");
      }

      setSectionModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save section");
    } finally {
      setSaving(false);
    }
  };

  const handleTableAction = async (
    table: Table,
    action: "seat" | "available" | "reserve"
  ) => {
    try {
      const body: Record<string, unknown> = {};
      if (action === "seat") {
        body.status = "occupied";
        body.current_guests = parseInt(guestCount) || 1;
      } else if (action === "available") {
        body.status = "available";
        body.current_guests = null;
        body.current_order_id = null;
      } else if (action === "reserve") {
        body.status = "reserved";
      }

      const res = await fetch(`/api/tables?id=${table.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Action failed");
      setActionTable(null);
      setGuestCount("");
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update table");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/tables?id=${deleteTarget.id}&type=${deleteTarget.type}`,
        { method: "DELETE", headers }
      );
      if (!res.ok) throw new Error("Delete failed");
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const getSectionName = (sectionId: string | null) => {
    if (!sectionId) return "No Section";
    const section = sections.find((s) => s.id === sectionId);
    return section?.name || "Unknown";
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6" />
            Table Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tables.length} tables across {sections.length} sections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAddSection}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </button>
          <button
            onClick={openAddTable}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSection(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            !activeSection
              ? "bg-green-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All Tables
        </button>
        {sections.map((section) => (
          <div key={section.id} className="flex items-center gap-1">
            <button
              onClick={() =>
                setActiveSection(
                  activeSection === section.id ? null : section.id
                )
              }
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeSection === section.id
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {section.name}
            </button>
            <button
              onClick={() => openEditSection(section)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() =>
                setDeleteTarget({
                  id: section.id,
                  type: "section",
                  name: section.name,
                })
              }
              className="p-1 text-gray-400 hover:text-red-500 rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Tables Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <Armchair className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">No tables</p>
          <p className="text-sm mt-1">Add your first table to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredTables.map((table) => (
            <div
              key={table.id}
              onClick={() => {
                setActionTable(table);
                setGuestCount(table.current_guests?.toString() || "");
              }}
              className={`relative cursor-pointer rounded-xl border-2 p-5 transition-all ${
                STATUS_COLORS[table.status]
              }`}
            >
              {/* Edit/delete buttons */}
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditTable(table);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-white/50"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({
                      id: table.id,
                      type: "table",
                      name: `Table ${table.table_number}`,
                    });
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-white/50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Table visual */}
              <div className="text-center mb-3">
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 ${
                    table.shape === "round" ? "rounded-full" : "rounded-lg"
                  } bg-white border-2 ${
                    table.status === "available"
                      ? "border-green-300"
                      : table.status === "occupied"
                      ? "border-red-300"
                      : "border-blue-300"
                  }`}
                >
                  <span className="text-xl font-bold text-gray-800">
                    {table.table_number}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="text-center">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_BADGES[table.status]
                  }`}
                >
                  {table.status.charAt(0).toUpperCase() +
                    table.status.slice(1)}
                </span>
                <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-gray-500">
                  <Users className="w-3.5 h-3.5" />
                  {table.current_guests || 0} / {table.capacity}
                </div>
                {table.section_id && (
                  <p className="text-xs text-gray-400 mt-1">
                    {getSectionName(table.section_id)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table Action Modal */}
      <Modal
        open={!!actionTable}
        onClose={() => {
          setActionTable(null);
          setGuestCount("");
        }}
        title={`Table ${actionTable?.table_number || ""}`}
        size="sm"
      >
        {actionTable && (
          <div className="space-y-4">
            <div className="text-center">
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  STATUS_BADGES[actionTable.status]
                }`}
              >
                {actionTable.status.charAt(0).toUpperCase() +
                  actionTable.status.slice(1)}
              </span>
              <p className="text-sm text-gray-500 mt-2">
                Capacity: {actionTable.capacity} seats
              </p>
            </div>

            {actionTable.status === "available" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Guests
                  </label>
                  <input
                    type="number"
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    placeholder="1"
                    min="1"
                    max={actionTable.capacity.toString()}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleTableAction(actionTable, "seat")
                    }
                    className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    Seat Guests
                  </button>
                  <button
                    onClick={() =>
                      handleTableAction(actionTable, "reserve")
                    }
                    className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Reserve
                  </button>
                </div>
              </>
            )}

            {actionTable.status === "occupied" && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    Guests: {actionTable.current_guests || "N/A"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleTableAction(actionTable, "available")
                  }
                  className="w-full py-2.5 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  Mark Available
                </button>
              </div>
            )}

            {actionTable.status === "reserved" && (
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleTableAction(actionTable, "seat")
                  }
                  className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  Seat Guests
                </button>
                <button
                  onClick={() =>
                    handleTableAction(actionTable, "available")
                  }
                  className="flex-1 py-2.5 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  Cancel Reservation
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add/Edit Table Modal */}
      <Modal
        open={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        title={editingTable ? "Edit Table" : "Add Table"}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Table Number *
            </label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. 1, A1, VIP-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity
            </label>
            <input
              type="number"
              value={tableCapacity}
              onChange={(e) => setTableCapacity(e.target.value)}
              min="1"
              max="50"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Section
            </label>
            <select
              value={tableSectionId}
              onChange={(e) => setTableSectionId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">No Section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shape
            </label>
            <div className="flex gap-2">
              {["square", "round", "rectangle"].map((shape) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => setTableShape(shape)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    tableShape === shape
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {shape.charAt(0).toUpperCase() + shape.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setTableModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTable}
              disabled={saving || !tableNumber.trim()}
              className="px-6 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingTable ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Section Modal */}
      <Modal
        open={sectionModalOpen}
        onClose={() => setSectionModalOpen(false)}
        title={editingSection ? "Edit Section" : "Add Section"}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Section Name *
            </label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. Main Hall, Patio, VIP"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={sectionDescription}
              onChange={(e) => setSectionDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Optional description"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setSectionModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSection}
              disabled={saving || !sectionName.trim()}
              className="px-6 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingSection ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.type === "section" ? "Section" : "Table"}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>?
              {deleteTarget?.type === "section" &&
                " Tables in this section will become unassigned."}
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
