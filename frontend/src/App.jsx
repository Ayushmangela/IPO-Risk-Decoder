import React, { useEffect, useState } from 'react';
import { SquaresFour, ClipboardText, Scales, ChartBar, BookOpen } from '@phosphor-icons/react';
import AppShell from './shell/AppShell';
import CommandPalette from './composed/CommandPalette';
import OverviewPanel from './features/OverviewPanel';
import RiskRegister from './features/RiskRegister';
import LitigationDocket from './features/LitigationDocket';
import BenchmarksPanel from './features/BenchmarksPanel';
import MethodologyPanel from './features/MethodologyPanel';
import {
  fetchCompanies,
  fetchCompanySummary,
  fetchCompanyOutliers,
  fetchCompanyRisks,
  fetchCompanyLitigation,
  fetchMethodology,
} from './api';

const VIEWS = [
  { id: 'overview', path: '/', label: 'Overview', short: 'Home', icon: <SquaresFour size={19} /> },
  { id: 'risks', path: '/risks', label: 'Risk register', short: 'Risks', icon: <ClipboardText size={19} /> },
  { id: 'litigation', path: '/litigation', label: 'Litigation docket', short: 'Legal', icon: <Scales size={19} /> },
  { id: 'benchmarks', path: '/benchmarks', label: 'Benchmarks', short: 'Bench', icon: <ChartBar size={19} /> },
  { id: 'methodology', path: '/methodology', label: 'Methodology', short: 'Method', icon: <BookOpen size={19} /> },
];

function viewForPath(pathname) {
  const match = VIEWS.find((v) => v.path !== '/' && pathname.startsWith(v.path));
  return match ? match.id : 'overview';
}

export default function App() {
  const [activeView, setActiveView] = useState(() =>
    typeof window !== 'undefined' ? viewForPath(window.location.pathname) : 'overview'
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusRiskNumber, setFocusRiskNumber] = useState(null);

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

  const navigateTo = (viewId) => {
    setActiveView(viewId);
    const target = VIEWS.find((v) => v.id === viewId);
    if (target && typeof window !== 'undefined' && window.location.pathname !== target.path) {
      window.history.pushState({ view: viewId }, '', target.path);
    }
  };

  const jumpToRisk = (riskNumber) => {
    setFocusRiskNumber(riskNumber);
    navigateTo('risks');
  };

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        setActiveView(viewForPath(window.location.pathname));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    function handleKeydown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  // 1. Fetch companies & methodology on load
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

  // 2. Fetch summary, outliers, risks & litigation when selected company changes
  useEffect(() => {
    if (!selectedCompanyId) return;

    setLoadingSummary(true);
    setLoadingRisks(true);
    setLoadingLitigation(true);
    setFocusRiskNumber(null);

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
    <AppShell
      companies={companies}
      selectedCompanyId={selectedCompanyId}
      onSelectCompany={setSelectedCompanyId}
      selectedCompany={selectedCompany}
      views={VIEWS}
      activeView={activeView}
      onNavigate={navigateTo}
      onOpenPalette={() => setPaletteOpen(true)}
    >
      <ViewHeader activeView={activeView} selectedCompany={selectedCompany} />

      {activeView === 'overview' && (
        <OverviewPanel
          selectedCompany={selectedCompany}
          summaryData={summaryData}
          outliersData={outliersData}
          risks={risks}
          loading={loadingSummary}
          onJumpToRisk={jumpToRisk}
        />
      )}

      {activeView === 'risks' && (
        <RiskRegister risks={risks} loading={loadingRisks} focusRiskNumber={focusRiskNumber} />
      )}

      {activeView === 'litigation' && (
        <LitigationDocket
          cases={litigationCases}
          summary={summaryData?.litigation_summary}
          loading={loadingLitigation}
        />
      )}

      {activeView === 'benchmarks' && <BenchmarksPanel summaryData={summaryData} loading={loadingSummary} />}

      {activeView === 'methodology' && <MethodologyPanel data={methodologyData} />}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        companies={companies}
        views={VIEWS}
        onSelectCompany={setSelectedCompanyId}
        onSelectView={navigateTo}
      />
    </AppShell>
  );
}

const VIEW_COPY = {
  overview: {
    title: 'Overview',
    description: 'Filing-level summary of disclosure quality, severity distribution, and litigation exposure.',
  },
  risks: {
    title: 'Risk register',
    description: 'Every disclosed risk factor, scored and cross-checked for materiality and disclosure placement.',
  },
  litigation: {
    title: 'Litigation docket',
    description: 'Legal proceedings disclosed in the filing, categorized by matter type and named party.',
  },
  benchmarks: {
    title: 'Benchmarks',
    description: 'Category risk profile compared against a cross-company average.',
  },
  methodology: {
    title: 'Methodology',
    description: 'Scoring rubric, model validation results, and the deterministic audit formulas behind every score.',
  },
};

function ViewHeader({ activeView }) {
  const copy = VIEW_COPY[activeView];
  return (
    <div className="view-header">
      <div>
        <div className="view-title">{copy.title}</div>
        <div className="view-description">{copy.description}</div>
      </div>
    </div>
  );
}
