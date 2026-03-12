"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const navItems = [
  {
    href: "/dashboard/terminal",
    label: "Terminal",
    icon: ShoppingCart,
  },
  {
    href: "/dashboard/products",
    label: "Products",
    icon: Package,
  },
  {
    href: "/dashboard/sales",
    label: "Sales",
    icon: Receipt,
  },
  {
    href: "/dashboard/orders",
    label: "Orders",
    icon: ShoppingBag,
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    icon: Boxes,
  },
  {
    href: "/dashboard/customers",
    label: "Customers",
    icon: Users,
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: BarChart3,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <Link
            href="/dashboard"
            className="text-lg font-bold text-green-600 flex items-center gap-2"
          >
            <LayoutDashboard className="w-5 h-5" />
            Peeap POS
          </Link>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
        </nav>

        <div className="p-2 border-t">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <LogOut className="w-4 h-4" />
            Back to Store
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
