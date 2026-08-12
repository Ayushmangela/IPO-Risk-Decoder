import React from 'react';
import CompanySelector from '../components/CompanySelector';
import CompanyMetrics from '../components/CompanyMetrics';
import IndustryContextCard from '../components/IndustryContextCard';
import DisclosureQualitySection from '../components/DisclosureQualitySection';
import LitigationLoadSection from '../components/LitigationLoadSection';
import ChartsSection from '../components/ChartsSection';
import BenchmarkTable from '../components/BenchmarkTable';
import DrillDownSection from '../components/DrillDownSection';

export default function DashboardPage({
  companies,
  selectedCompanyId,
  onSelectCompany,
  selectedCompany,
  summaryData,
  outliersData,
  risks,
  litigationCases,
  drillDownTab,
  setDrillDownTab,
  categoryFilter,
  setCategoryFilter,
  searchQuery,
  setSearchQuery,
  expandedRiskId,
  setExpandedRiskId,
  litigationCategoryFilter,
  setLitigationCategoryFilter,
  litigationSearchQuery,
  setLitigationSearchQuery,
  expandedLitigationId,
  setExpandedLitigationId,
  loadingSummary,
  loadingRisks,
  loadingLitigation
}) {
  return (
    <>
      {/* SECTION 1: Company Selector */}
      <CompanySelector
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={onSelectCompany}
      />

      {/* SECTION 2: Company Dashboard & Metrics */}
      {selectedCompany && summaryData && (
        <section className="section-block mb-8">
          {/* Industry Overview Context Card */}
          <IndustryContextCard
            sector={selectedCompany.sector}
            industrySummary={summaryData.industry_summary}
          />

          {/* Key Metric Summary Cards */}
          <CompanyMetrics
            selectedCompany={selectedCompany}
            summaryData={summaryData}
          />

          {/* Disclosure Quality & Algorithmic Distortion Analysis */}
          <DisclosureQualitySection
            summaryData={summaryData}
            outliersData={outliersData}
          />

          {/* Litigation Load Analysis */}
          <LitigationLoadSection
            summaryData={summaryData}
          />

          {/* Charts: Recharts Bar & Pie */}
          <ChartsSection
            summaryData={summaryData}
            risks={risks}
          />

          {/* Peer Benchmark Table */}
          <BenchmarkTable
            summaryData={summaryData}
          />
        </section>
      )}

      {/* SECTION 3: Drill-Down List (Risk Factors vs Litigation) */}
      <DrillDownSection
        drillDownTab={drillDownTab}
        setDrillDownTab={setDrillDownTab}
        risks={risks}
        litigationCases={litigationCases}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        expandedRiskId={expandedRiskId}
        setExpandedRiskId={setExpandedRiskId}
        litigationCategoryFilter={litigationCategoryFilter}
        setLitigationCategoryFilter={setLitigationCategoryFilter}
        litigationSearchQuery={litigationSearchQuery}
        setLitigationSearchQuery={setLitigationSearchQuery}
        expandedLitigationId={expandedLitigationId}
        setExpandedLitigationId={setExpandedLitigationId}
        loadingRisks={loadingRisks}
        loadingLitigation={loadingLitigation}
      />
    </>
  );
}
