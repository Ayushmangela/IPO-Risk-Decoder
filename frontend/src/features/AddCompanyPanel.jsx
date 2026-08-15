import React, { useEffect, useState } from 'react';
import { ArrowClockwise, ArrowSquareOut, UploadSimple, WarningCircle, Info, Check } from '@phosphor-icons/react';
import EmptyState from '../primitives/EmptyState';
import { SkeletonRows } from '../primitives/Skeleton';
import { fetchActiveIpos, refreshActiveIpos, uploadDrhp } from '../api';

/* Mirrors the real pipeline stages in scripts/15_process_uploaded_drhp.py.
   `weight` is the rough share of total wall-clock each stage takes — LLM
   scoring dominates, so an evenly-timed indicator would sit at "step 3 of 6"
   looking stalled for most of the run. These drive dwell time only; they are
   an honest estimate of duration, never a claim about backend state. */
const PIPELINE_STAGES = [
  { label: 'Verifying DRHP structure', weight: 1 },
  { label: 'Extracting risk factors', weight: 2 },
  { label: 'Scoring risk factors with Gemini', weight: 12 },
  { label: 'Extracting litigation & industry', weight: 3 },
  { label: 'Computing DDI & obfuscation metrics', weight: 1 },
  { label: 'Recomputing cross-company benchmarks', weight: 1 },
];

export default function AddCompanyPanel({ onCompanyAdded }) {
  const [tab, setTab] = useState('browse');

  const [ipos, setIpos] = useState([]);
  const [loadingIpos, setLoadingIpos] = useState(true);
  const [iposError, setIposError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [file, setFile] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [sector, setSector] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [activeStage, setActiveStage] = useState(0);
  const [autoFetchNote, setAutoFetchNote] = useState(null);

  useEffect(() => {
    loadIpos();
  }, []);

  async function loadIpos() {
    setLoadingIpos(true);
    setIposError(null);
    try {
      const data = await fetchActiveIpos();
      setIpos(data.ipos || []);
    } catch (err) {
      setIposError(err.message);
    } finally {
      setLoadingIpos(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setIposError(null);
    try {
      const data = await refreshActiveIpos();
      setIpos(data.ipos || []);
    } catch (err) {
      setIposError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  function handleGetPdf(ipo) {
    setCompanyName(ipo.company_name);
    if (ipo.source_url) {
      window.open(ipo.source_url, '_blank', 'noopener,noreferrer');
      setAutoFetchNote(
        `Opened the source page for "${ipo.company_name}" in a new tab — this app can't silently auto-download a third-party PDF. Grab the DRHP from there, then upload it below.`
      );
    } else {
      setAutoFetchNote(`Couldn't auto-fetch a source link for "${ipo.company_name}" — please upload manually.`);
    }
    setTab('upload');
  }

  /* The endpoint is a single synchronous call with no progress stream, so the
     indicator advances on weighted timers rather than pretending to know the
     backend's true position. It deliberately STOPS on the final stage instead
     of looping — a wrapping indicator would imply the run restarted. The copy
     below the indicator is explicit that these are estimates. */
  useEffect(() => {
    if (!uploading) {
      setActiveStage(0);
      return undefined;
    }
    const unit = 5000;
    const timers = [];
    let elapsed = 0;
    PIPELINE_STAGES.forEach((stage, i) => {
      if (i === 0) return;
      elapsed += PIPELINE_STAGES[i - 1].weight * unit;
      timers.push(setTimeout(() => setActiveStage(i), elapsed));
    });
    return () => timers.forEach(clearTimeout);
  }, [uploading]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file || !companyName.trim() || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadDrhp(file, companyName.trim(), sector.trim());
      onCompanyAdded(result.company_id);
    } catch (err) {
      setUploadError(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="add-company-tabs">
        <button
          type="button"
          className={['add-company-tab', tab === 'browse' ? 'active' : ''].join(' ')}
          onClick={() => setTab('browse')}
        >
          Browse active IPOs
        </button>
        <button
          type="button"
          className={['add-company-tab', tab === 'upload' ? 'active' : ''].join(' ')}
          onClick={() => setTab('upload')}
        >
          Upload PDF
        </button>
      </div>

      {tab === 'browse' && (
        <BrowseTab
          ipos={ipos}
          loading={loadingIpos}
          error={iposError}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onGetPdf={handleGetPdf}
        />
      )}

      {tab === 'upload' && (
        <UploadTab
          file={file}
          setFile={setFile}
          companyName={companyName}
          setCompanyName={setCompanyName}
          sector={sector}
          setSector={setSector}
          uploading={uploading}
          uploadError={uploadError}
          activeStage={activeStage}
          autoFetchNote={autoFetchNote}
          onSubmit={handleUpload}
        />
      )}
    </div>
  );
}

function BrowseTab({ ipos, loading, error, refreshing, onRefresh, onGetPdf }) {
  return (
    <div>
      <div className="active-ipo-toolbar">
        <span className="active-ipo-refresh-note">
          {ipos.length > 0 ? `${ipos.length} mainboard IPOs currently filed or under SEBI review.` : ''}
        </span>
        <button type="button" className="btn" onClick={onRefresh} disabled={refreshing}>
          <ArrowClockwise size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh list'}
        </button>
      </div>

      {loading ? (
        <SkeletonRows rows={6} rowHeight={52} />
      ) : error ? (
        <EmptyState
          tone="error"
          icon={<WarningCircle size={32} />}
          title="Couldn't load the active IPO list"
          description={error}
        />
      ) : ipos.length === 0 ? (
        <EmptyState
          icon={<Info size={32} />}
          title="No cached active IPO list yet"
          description="Click Refresh list to fetch the current mainboard DRHP filing tracker."
        />
      ) : (
        <div className="ledger">
          <div className="ledger-head active-ipo-ledger-head">
            <span>Company</span>
            <span>Status</span>
            <span>DRHP filed</span>
            <span>Industry</span>
            <span />
          </div>
          {ipos.map((ipo) => (
            <div className="ledger-row active-ipo-ledger-row" key={ipo.id}>
              <span className="active-ipo-company-name">
                {ipo.company_name}
                {ipo.is_confidential_filing && <span className="active-ipo-confidential">Confidential filing</span>}
              </span>
              <span className={['badge', ipo.filing_status === 'SEBI Approved' ? 'badge-positive' : ''].join(' ')}>
                {ipo.filing_status}
              </span>
              <span className="tabular" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {ipo.drhp_filing_date}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{ipo.industry}</span>
              <button type="button" className="btn" onClick={() => onGetPdf(ipo)}>
                Get PDF <ArrowSquareOut size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadTab({
  file,
  setFile,
  companyName,
  setCompanyName,
  sector,
  setSector,
  uploading,
  uploadError,
  activeStage,
  autoFetchNote,
  onSubmit,
}) {
  if (uploading) {
    return (
      <div className="pipeline-progress">
        <div className="pipeline-stage-list" role="status" aria-live="polite">
          {PIPELINE_STAGES.map((stage, i) => {
            const state = i < activeStage ? 'done' : i === activeStage ? 'active' : 'pending';
            return (
              <div className={`pipeline-stage pipeline-stage-${state}`} key={stage.label}>
                <span className="pipeline-stage-marker" aria-hidden="true">
                  {state === 'done' ? <Check size={12} weight="bold" /> : <span className="pipeline-stage-dot" />}
                </span>
                <span className="pipeline-stage-label">{stage.label}</span>
                {state === 'active' && <span className="pipeline-stage-spinner" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
        <div className="pipeline-progress-note">
          Running the full pipeline for "{companyName}". Stage timings are estimates — the API returns once at
          the end, so this indicator can't report the backend's exact position. You'll be redirected
          automatically when it finishes.
        </div>
      </div>
    );
  }

  return (
    <div>
      {autoFetchNote && <div className="upload-callout">{autoFetchNote}</div>}

      <form className="upload-form" onSubmit={onSubmit}>
        <div className="form-field">
          <label className="form-label" htmlFor="drhp-file">
            DRHP PDF
          </label>
          <input
            id="drhp-file"
            className="form-file-input"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="company-name">
            Company name
          </label>
          <input
            id="company-name"
            className="form-input"
            type="text"
            placeholder="e.g. Tablespace Technologies Ltd."
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="company-sector">
            Sector <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <input
            id="company-sector"
            className="form-input"
            type="text"
            placeholder="e.g. Diversified Commercial Services"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={!file || !companyName.trim()}>
          <UploadSimple size={15} />
          Run analysis pipeline
        </button>
      </form>

      {uploadError && (
        <div className="pipeline-error">
          <div className="pipeline-error-title">
            {uploadError.detail?.failed_step
              ? `Failed at step: ${uploadError.detail.failed_step}`
              : 'Upload failed'}
          </div>
          <div className="pipeline-error-detail">{uploadError.message}</div>
          {uploadError.detail?.log && uploadError.detail.log.length > 0 && (
            <div className="pipeline-error-log">{uploadError.detail.log.join('\n')}</div>
          )}
        </div>
      )}
    </div>
  );
}
