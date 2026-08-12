import React from 'react';
import { BookOpen } from 'lucide-react';

export default function IndustryContextCard({ sector, industrySummary }) {
  if (!industrySummary) return null;

  return (
    <div className="industry-context-card mb-8">
      <div className="industry-header">
        <div className="industry-title-group">
          <BookOpen size={20} />
          <span>Industry Context & Sector Overview</span>
        </div>
        <span className="company-sector-badge">{sector} Sector</span>
      </div>
      <p className="industry-text-body">{industrySummary}</p>
    </div>
  );
}
