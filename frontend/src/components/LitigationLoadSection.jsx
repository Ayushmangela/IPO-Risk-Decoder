import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { CATEGORY_COLORS } from '../api';

export default function LitigationLoadSection({ summaryData }) {
  if (!summaryData?.litigation_summary) return null;

  const litSummary = summaryData.litigation_summary;
  const partyBreakdown = litSummary.by_party_type || {};
  const categoryCounts = litSummary.by_category || {};
  const totalLitigationCases = litSummary.total_cases || 0;
  const hasMaterialPromoterLitigation = (partyBreakdown.Promoter || 0) > 0 || (partyBreakdown.Director || 0) > 0;

  const litigationChartData = Object.entries(categoryCounts).map(([cat, count]) => ({
    category: cat,
    count,
    fill: CATEGORY_COLORS[cat] || '#818cf8',
  }));

  return (
    <div className="card mb-8">
      <h3 className="card-title">
        <AlertCircle size={18} color="#ec4899" />
        Litigation Load & Legal Exposure Analysis
      </h3>

      {/* Material Risk Warning Callout Banner */}
      {hasMaterialPromoterLitigation && (
        <div className="promoter-warning-box mb-6">
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 2px 0' }}>
              Material Governance Risk Warning: Individual Director/Promoter Litigation
            </h4>
            <p style={{ fontSize: '0.82rem', margin: 0, opacity: 0.9 }}>
              Filing names key individuals directly: <strong>{partyBreakdown.Promoter || 0} case(s) against Promoters</strong> and <strong>{partyBreakdown.Director || 0} case(s) against Directors</strong>. Individual legal proceedings carry significantly higher material operational risk than standard corporate litigations.
            </p>
          </div>
        </div>
      )}

      {/* Grid Layout: Stat Badges + Category Bar Chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stat Badges Box */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1.25rem', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Total Outstanding Cases
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f8fafc', margin: '0.25rem 0 1rem 0' }}>
              {totalLitigationCases} <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>cases</span>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Breakdown by Named Party Type
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '0.4rem 0.6rem', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '6px' }}>
                <span style={{ color: '#cbd5e1' }}>Company / Subsidiaries</span>
                <strong style={{ color: '#f8fafc' }}>{partyBreakdown.Company || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '0.4rem 0.6rem', background: (partyBreakdown.Promoter || 0) > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(30, 41, 59, 0.6)', borderRadius: '6px', border: (partyBreakdown.Promoter || 0) > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : 'none' }}>
                <span style={{ color: (partyBreakdown.Promoter || 0) > 0 ? '#f87171' : '#cbd5e1', fontWeight: (partyBreakdown.Promoter || 0) > 0 ? 600 : 400 }}>Promoters Individually</span>
                <strong style={{ color: (partyBreakdown.Promoter || 0) > 0 ? '#f87171' : '#f8fafc' }}>{partyBreakdown.Promoter || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '0.4rem 0.6rem', background: (partyBreakdown.Director || 0) > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(30, 41, 59, 0.6)', borderRadius: '6px', border: (partyBreakdown.Director || 0) > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : 'none' }}>
                <span style={{ color: (partyBreakdown.Director || 0) > 0 ? '#fbbf24' : '#cbd5e1', fontWeight: (partyBreakdown.Director || 0) > 0 ? 600 : 400 }}>Directors Individually</span>
                <strong style={{ color: (partyBreakdown.Director || 0) > 0 ? '#fbbf24' : '#f8fafc' }}>{partyBreakdown.Director || 0}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Small Bar Chart Box */}
        <div style={{ gridColumn: 'span 2', background: 'rgba(15, 23, 42, 0.6)', padding: '1.25rem', borderRadius: '10px', border: '1px solid #334155' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.75rem' }}>
            Litigation Cases by Legal Category
          </span>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={litigationChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" stroke="#64748b" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="category" stroke="#cbd5e1" fontSize={12} width={90} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {litigationChartData.map((entry, index) => (
                    <Cell key={`cell-lit-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
