import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import MethodologyPage from './pages/MethodologyPage';
import { 
  fetchCompanies, 
  fetchCompanySummary, 
  fetchCompanyOutliers, 
  fetchCompanyRisks, 
  fetchCompanyLitigation, 
  fetchMethodology 
} from './api';

export default function App() {
  const [activeScreen, setActiveScreen] = useState(() => {
    return (typeof window !== 'undefined' && window.location.pathname.startsWith('/methodology'))
      ? 'methodology'
      : 'dashboard';
  });

  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [outliersData, setOutliersData] = useState(null);
  const [risks, setRisks] = useState([]);
  const [litigationCases, setLitigationCases] = useState([]);
  const [methodologyData, setMethodologyData] = useState(null);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRisks, setLoadingRisks] = useState(false);
  const [loadingLitigation, setLoadingLitigation] = useState(false);

  // Drill-down filter & tab states
  const [drillDownTab, setDrillDownTab] = useState('risks'); // 'risks' | 'litigation'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRiskId, setExpandedRiskId] = useState(null);

  const [litigationCategoryFilter, setLitigationCategoryFilter] = useState('ALL');
  const [litigationSearchQuery, setLitigationSearchQuery] = useState('');
  const [expandedLitigationId, setExpandedLitigationId] = useState(null);

  const navigateTo = (screen) => {
    setActiveScreen(screen);
    const targetPath = screen === 'methodology' ? '/methodology' : '/';
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ screen }, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        if (window.location.pathname.startsWith('/methodology')) {
          setActiveScreen('methodology');
        } else {
          setActiveScreen('dashboard');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 1. Fetch Companies & Methodology on Load
  useEffect(() => {
    fetchCompanies()
      .then((data) => {
        setCompanies(data);
        if (data && data.length > 0) {
          setSelectedCompanyId(data[0].company_id);
        }
      })
      .catch((err) => console.error('Error fetching companies:', err));

    fetchMethodology()
      .then((data) => setMethodologyData(data))
      .catch((err) => console.error('Error fetching methodology:', err));
  }, []);

  // 2. Fetch Summary, Outliers, Risks & Litigation when selectedCompanyId changes
  useEffect(() => {
    if (!selectedCompanyId) return;

    setLoadingSummary(true);
    setLoadingRisks(true);
    setLoadingLitigation(true);
    setCategoryFilter('ALL');
    setLitigationCategoryFilter('ALL');
    setSearchQuery('');
    setLitigationSearchQuery('');
    setExpandedRiskId(null);
    setExpandedLitigationId(null);

    fetchCompanySummary(selectedCompanyId)
      .then((data) => {
        setSummaryData(data);
        setLoadingSummary(false);
      })
      .catch((err) => {
        console.error('Error fetching summary:', err);
        setLoadingSummary(false);
      });

    fetchCompanyOutliers(selectedCompanyId)
      .then((data) => setOutliersData(data))
      .catch((err) => console.error('Error fetching outliers:', err));

    fetchCompanyRisks(selectedCompanyId)
      .then((data) => {
        setRisks(data);
        setLoadingRisks(false);
      })
      .catch((err) => {
        console.error('Error fetching risks:', err);
        setLoadingRisks(false);
      });

    fetchCompanyLitigation(selectedCompanyId)
      .then((data) => {
        setLitigationCases(data);
        setLoadingLitigation(false);
      })
      .catch((err) => {
        console.error('Error fetching litigation:', err);
        setLoadingLitigation(false);
      });
  }, [selectedCompanyId]);

  const selectedCompany = companies.find((c) => c.company_id === selectedCompanyId);

  return (
    <div className="app-shell">
      {/* Header Navigation */}
      <Navbar activeScreen={activeScreen} onNavigate={navigateTo} />

      {/* Main Content */}
      <main className="main-container">
        {activeScreen === 'dashboard' && (
          <DashboardPage
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            onSelectCompany={setSelectedCompanyId}
            selectedCompany={selectedCompany}
            summaryData={summaryData}
            outliersData={outliersData}
            risks={risks}
            litigationCases={litigationCases}
            drillDownTab={drillDownTab}
            setDrillDownTab={setDrillDownTab}
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
            loadingSummary={loadingSummary}
            loadingRisks={loadingRisks}
            loadingLitigation={loadingLitigation}
          />
        )}

        {activeScreen === 'methodology' && (
          <MethodologyPage data={methodologyData} />
        )}
      </main>
    </div>
  );
}
