
import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

export function MetricCard({ title, value, icon, trend, trendUp }: MetricCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {trend && (
          <p className={`text-xs font-medium mt-2 flex items-center ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            <span className="mr-1">{trendUp ? '↑' : '↓'}</span>
            {trend}
          </p>
        )}
      </div>
      <div className="p-3 bg-red-50 rounded-lg text-red-600">
        {icon}
      </div>
    </div>
  );
}
