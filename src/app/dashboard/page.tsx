"use client";

import { useState } from "react";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  QrCode,
} from "lucide-react";

// Placeholder POS Terminal — will be fully built in Phase 2
export default function TerminalPage() {
  const [cart, setCart] = useState<
    Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>
  >([]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="flex h-full">
      {/* Products Panel */}
      <div className="flex-1 p-4">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products or scan barcode..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg p-8 text-center text-gray-500">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">POS Terminal</p>
          <p className="text-sm mt-2">
            Connect your Supabase database to load products.
            <br />
            Full terminal UI coming in Phase 2.
          </p>
        </div>
      </div>

      {/* Cart Panel */}
      <div className="w-96 bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Cart ({cart.length} items)
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 text-sm mt-8">
              Cart is empty
            </p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      NLe {item.price.toLocaleString()} x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 hover:bg-gray-100 rounded"
                      onClick={() =>
                        setCart((prev) =>
                          prev
                            .map((i) =>
                              i.id === item.id
                                ? { ...i, quantity: i.quantity - 1 }
                                : i
                            )
                            .filter((i) => i.quantity > 0)
                        )
                      }
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      className="p-1 hover:bg-gray-100 rounded"
                      onClick={() =>
                        setCart((prev) =>
                          prev.map((i) =>
                            i.id === item.id
                              ? { ...i, quantity: i.quantity + 1 }
                              : i
                          )
                        )
                      }
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      className="p-1 hover:bg-red-50 rounded text-red-500 ml-1"
                      onClick={() =>
                        setCart((prev) =>
                          prev.filter((i) => i.id !== item.id)
                        )
                      }
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals + Payment */}
        <div className="border-t p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">
              NLe {subtotal.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-green-600">
              NLe {subtotal.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50">
              <Banknote className="w-4 h-4" />
              Cash
            </button>
            <button className="flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50">
              <Smartphone className="w-4 h-4" />
              Mobile
            </button>
            <button className="flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50">
              <CreditCard className="w-4 h-4" />
              Card
            </button>
            <button className="flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50">
              <QrCode className="w-4 h-4" />
              QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
