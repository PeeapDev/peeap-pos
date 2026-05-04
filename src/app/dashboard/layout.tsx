"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardAuthGuard } from "@/components/DashboardAuthGuard";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  ShoppingBag,
  Boxes,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChefHat,
  LayoutGrid,
  UserCog,
  Tag,
  Truck,
  Printer,
  Store,
  TrendingUp,
  Smartphone,
  QrCode,
} from "lucide-react";

interface NavSection {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const navSections: NavSection[] = [
  {
    title: "Store Management",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/products", label: "Products", icon: Package },
      { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
      { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
      { href: "/dashboard/customers", label: "Customers", icon: Users },
      { href: "/dashboard/analytics", label: "Analytics", icon: TrendingUp },
    ],
  },
  {
    title: "In-Store / POS",
    items: [
      { href: "/dashboard/terminal", label: "POS Terminal", icon: ShoppingCart },
      { href: "/dashboard/pos-devices", label: "Scan-to-Pay Devices", icon: Smartphone },
      { href: "/dashboard/pos-staff", label: "POS Cashiers", icon: QrCode },
      { href: "/dashboard/kitchen", label: "Kitchen", icon: ChefHat },
      { href: "/dashboard/tables", label: "Tables", icon: LayoutGrid },
      { href: "/dashboard/sales", label: "POS Sales", icon: Receipt },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/dashboard/staff", label: "Staff", icon: UserCog },
      { href: "/dashboard/discounts", label: "Discounts", icon: Tag },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck },
      { href: "/dashboard/receipts", label: "Receipts", icon: Printer },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <DashboardAuthGuard>
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <Link
            href="/dashboard"
            className="text-lg font-bold text-green-600 flex items-center gap-2"
          >
            <Store className="w-5 h-5" />
            Peeap Store
          </Link>
        </div>

        <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    (item.href === "/dashboard" && pathname === "/dashboard") ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-green-50 text-green-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-2 border-t space-y-0.5">
          <Link
            href="/dashboard/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-green-50 text-green-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <LogOut className="w-4 h-4" />
            Back to Marketplace
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
    </DashboardAuthGuard>
  );
}
