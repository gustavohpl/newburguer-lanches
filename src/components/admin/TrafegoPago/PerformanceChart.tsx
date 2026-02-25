import React from 'react';
import { Metric } from '../../../hooks/useTrafegoPago';

interface PerformanceChartProps {
  data: Metric[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Desempenho</h3>
        <div className="flex items-center justify-center h-64 text-gray-400">
          Nenhum dado disponível
        </div>
      </div>
    );
  }

  // Calculate dimensions
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 40, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min/max values
  const values = data.map(d => d.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const valueRange = maxValue - minValue || 1;

  // Create points for the line
  const points = data.map((item, index) => {
    const x = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((item.value - minValue) / valueRange) * chartHeight;
    return { x, y, value: item.value, label: item.label };
  });

  // Create path for the line
  const linePath = points.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ');

  // Create area path
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

  // Generate Y-axis labels
  const yAxisSteps = 5;
  const yAxisLabels = Array.from({ length: yAxisSteps }, (_, i) => {
    const value = minValue + (valueRange / (yAxisSteps - 1)) * i;
    const y = height - padding.bottom - (i / (yAxisSteps - 1)) * chartHeight;
    return { value: Math.round(value), y };
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">Desempenho</h3>
      
      <div className="overflow-x-auto">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto"
          style={{ minWidth: '600px' }}
        >
          {/* Grid lines */}
          {yAxisLabels.map((label, i) => (
            <line
              key={`grid-${i}`}
              x1={padding.left}
              y1={label.y}
              x2={width - padding.right}
              y2={label.y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}

          {/* Area fill */}
          <path
            d={areaPath}
            fill="url(#gradient)"
            opacity="0.3"
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((point, index) => (
            <g key={`point-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="#3b82f6"
                stroke="white"
                strokeWidth="2"
                className="cursor-pointer hover:r-6 transition-all"
              >
                <title>{`${point.label}: ${point.value}`}</title>
              </circle>
            </g>
          ))}

          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="#9ca3af"
            strokeWidth="2"
          />

          {/* X-axis */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#9ca3af"
            strokeWidth="2"
          />

          {/* Y-axis labels */}
          {yAxisLabels.map((label, i) => (
            <text
              key={`y-label-${i}`}
              x={padding.left - 10}
              y={label.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="12"
              fill="#6b7280"
            >
              {label.value}
            </text>
          ))}

          {/* X-axis labels */}
          {points.map((point, index) => {
            // Show every nth label to avoid crowding
            const showEvery = Math.ceil(data.length / 8);
            if (index % showEvery !== 0 && index !== data.length - 1) return null;
            
            return (
              <text
                key={`x-label-${index}`}
                x={point.x}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
              >
                {point.label}
              </text>
            );
          })}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
        <span>Performance ao longo do tempo</span>
      </div>
    </div>
  );
}
