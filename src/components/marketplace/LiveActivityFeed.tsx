"use client";

import { useState, useEffect } from "react";

interface RecentOrder {
  order_number: string;
  customer_name: string;
  total_amount: number;
  created_at: string;
}

// Simulated activity names for demo (when no real orders)
const demoNames = [
  "Aminata", "Mohamed", "Fatmata", "Ibrahim", "Mariama",
  "Abdul", "Hawa", "Alhaji", "Kadiatu", "Sahr",
];

const demoActions = [
  "just purchased",
  "added to cart",
  "is viewing",
  "just ordered",
];

interface Activity {
  id: number;
  name: string;
  action: string;
  amount?: number;
  time: string;
  isNew: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function LiveActivityFeed({
  recentOrders = [],
  storeName,
}: {
  recentOrders: RecentOrder[];
  storeName: string;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    // Start with real orders
    const initial: Activity[] = recentOrders.slice(0, 3).map((order, i) => ({
      id: i,
      name: order.customer_name.split(" ")[0],
      action: "purchased",
      amount: order.total_amount,
      time: timeAgo(order.created_at),
      isNew: false,
    }));

    // If no real orders, use simulated ones
    if (initial.length === 0) {
      for (let i = 0; i < 3; i++) {
        initial.push({
          id: i,
          name: demoNames[Math.floor(Math.random() * demoNames.length)],
          action: demoActions[Math.floor(Math.random() * demoActions.length)],
          time: `${Math.floor(Math.random() * 30) + 1}m ago`,
          isNew: false,
        } as Activity);
      }
    }

    setActivities(initial);

    // Add new simulated activity every 8-15 seconds
    let counter = initial.length;
    const interval = setInterval(() => {
      const newActivity: Activity = {
        id: counter++,
        name: demoNames[Math.floor(Math.random() * demoNames.length)],
        action: demoActions[Math.floor(Math.random() * demoActions.length)],
        time: "just now",
        isNew: true,
      };

      setActivities((prev) => {
        const updated = [newActivity, ...prev.slice(0, 4)];
        // Remove isNew after animation
        setTimeout(() => {
          setActivities((current) =>
            current.map((a) => (a.id === newActivity.id ? { ...a, isNew: false } : a))
          );
        }, 2000);
        return updated;
      });
    }, Math.random() * 7000 + 8000);

    return () => clearInterval(interval);
  }, [recentOrders]);

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <h3 className="font-semibold text-gray-900 text-sm">Live Activity</h3>
      </div>
      <div className="space-y-2.5">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`flex items-center gap-2 text-xs transition-all duration-500 ${
              activity.isNew
                ? "bg-green-50 -mx-2 px-2 py-1.5 rounded-lg"
                : ""
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
              {activity.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 truncate">
                <span className="font-medium">{activity.name}</span>{" "}
                {activity.action}
                {activity.amount && (
                  <span className="text-green-600 font-medium">
                    {" "}NLe {activity.amount.toLocaleString()}
                  </span>
                )}
              </p>
            </div>
            <span className="text-gray-400 shrink-0">{activity.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
