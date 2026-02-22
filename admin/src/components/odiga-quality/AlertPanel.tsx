'use client';

import { useState } from 'react';
import { AlertTriangle, XCircle, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import type { AlertItem } from '@/types/odiga-quality';

interface AlertPanelProps {
  alerts: AlertItem[];
}

export function AlertPanel({ alerts }: AlertPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (alerts.length === 0) return null;

  const errorCount = alerts.filter((a) => a.type === 'error').length;
  const warnCount = alerts.filter((a) => a.type === 'warn').length;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-gray-100 shadow-lg bg-white">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold border-b border-gray-100 rounded-t-xl hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-orange-500" />
          <span>알림</span>
          {errorCount > 0 && (
            <span className="rounded-full bg-red-50 text-red-600 text-xs px-1.5 py-0.5 font-semibold">
              {errorCount}
            </span>
          )}
          {warnCount > 0 && (
            <span className="rounded-full bg-orange-50 text-orange-600 text-xs px-1.5 py-0.5 font-medium">
              {warnCount}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Alert list */}
      {!collapsed && (
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
          {alerts.map((alert, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              {alert.type === 'error' ? (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-xs font-medium leading-snug">{alert.message}</p>
                <p className="text-xs text-muted-foreground">
                  {alert.metric}: {alert.value.toFixed(1)} (기준: {alert.threshold})
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
