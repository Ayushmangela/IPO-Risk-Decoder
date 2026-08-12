import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend } from 'recharts';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { CATEGORY_COLORS, SEVERITY_COLORS } from '../api';

export default function ChartsSection({ summaryData, risks }) {
  if (!summaryData) return null;

  const categoryChartData = summaryData.category_counts
    ? Object.entries(summaryData.category_counts).map(([cat, count]) => ({
        category: cat,
        count,
        fill: CATEGORY_COLORS[cat] || '#6366f1',
      }))
    : [];

  const severityCounts = risks.reduce((acc, r) => {
    acc[r.score] = (acc[r.score] || 0) + 1;
    return acc;
  }, {});

  const severityChartData = [5, 4, 3, 2, 1]
    .filter((score) => severityCounts[score] > 0)
    .map((score) => ({
      name: `Score ${score}`,
      value: severityCounts[score],
      fill: SEVERITY_COLORS[score] || '#94a3b8',
    }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Chart 1: Category Breakdown */}
      <div className="card">
        <h3 className="card-title">
          <BarChart3 size={18} color="#6366f1" />
          Risk Distribution by Category
        </h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis dataKey="category" stroke="#64748b" fontSize={12} interval={0} angle={-15} textAnchor="end" />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {categoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Severity Distribution */}
      <div className="card">
        <h3 className="card-title">
          <AlertTriangle size={18} color="#fb923c" />
          Severity Score Distribution (1–5 Rubric)
        </h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={severityChartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {severityChartData.map((entry, index) => (
                  <Cell key={`cell-pie-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }} />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
