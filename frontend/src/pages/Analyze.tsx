import { useState, useCallback } from 'react';
import { parseJD } from '../api/jobs';
import { parseResume } from '../api/resumes';
import { analyze, scoreOnly } from '../api/analyze';
import { ScoreCard } from '../components/ui/ScoreCard';
import { SkillGrid } from '../components/ui/SkillGrid';
import { ModeTabs } from '../components/ui/ModeTabs';
import { ResumeUpload } from '../components/ui/ResumeUpload';
import { JDInput } from '../components/ui/JDInput';
import { JobSidebar } from '../components/ui/JobSidebar';
import { FitResult, GapResult, CoverLetterResult, InterviewResult } from '../components/ui/ModeResults';
import {
  AnalysisMode, ParsedJD, ParsedResume, ScoreBreakdown,
  FitAnalysisData, GapAnalysisData, CoverLetterData, InterviewPrepData,
  SavedJob,
} from '../types';

const STORAGE_KEY = 'joblens_saved_jobs';
const loadSaved = (): SavedJob[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const saveSaved = (j: SavedJob[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(j));

const Spinner = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12">
    <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: 'var(--accent-amber)', borderTopColor: 'transparent' }} />
    <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{label}</p>
  </div>
);

const ErrorBanner = ({ msg, onDismiss }: { msg: string; onDismiss: () => void }) => (
  <div className="glass-elevated rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-up"
    style={{ borderLeft: '3px solid var(--score-low)', background: 'rgba(239,68,68,0.07)' }}>
    <span className="font-mono font-bold flex-shrink-0" style={{ color: 'var(--score-low)' }}>!</span>
    <p className="text-sm flex-1" style={{ color: 'var(--score-low)' }}>{msg}</p>
    <button onClick={onDismiss} className="font-mono text-lg leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
  </div>
);

export default function AnalyzePage() {
  const [jobId,        setJobId]        = useState<string | null>(null);
  const [resumeId,     setResumeId]     = useState<string | null>(null);
  const [parsedJD,     setParsedJD]     = useState<ParsedJD | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [score,        setScore]        = useState<ScoreBreakdown | null>(null);
  const [mode,         setMode]         = useState<AnalysisMode>('fit');
  const [modeData,     setModeData]     = useState<Record<string, unknown>>({});
  const [jdLoading,      setJdLoading]      = useState(false);
  const [resumeLoading,  setResumeLoading]  = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [savedJobs,    setSavedJobs]    = useState<SavedJob[]>(loadSaved);
  const [activeJobId,  setActiveJobId]  = useState<string | undefined>();

  const handleError = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong');

  const runScore = useCallback(async (jId: string, rId: string, jd?: ParsedJD | null) => {
    try {
      const s = await scoreOnly(jId, rId);
      setScore(s);
      const effectiveJD = jd ?? parsedJD;
      if (effectiveJD) {
        const entry: SavedJob = { id: `${jId}_${rId}`, jobId: jId, resumeId: rId, title: effectiveJD.title, company: effectiveJD.company, score: s.finalScore, savedAt: new Date().toISOString() };
        setSavedJobs(prev => { const u = [entry, ...prev.filter(j => j.id !== entry.id)].slice(0, 20); saveSaved(u); return u; });
        setActiveJobId(entry.id);
      }
    } catch (e) { handleError(e); }
  }, [parsedJD]);

  const handleJDSubmit = async (text: string) => {
    setJdLoading(true); setError(null); setScore(null); setModeData({});
    try {
      const { jobId: id, parsed } = await parseJD(text);
      setJobId(id); setParsedJD(parsed);
      if (resumeId) await runScore(id, resumeId, parsed);
    } catch (e) { handleError(e); } finally { setJdLoading(false); }
  };

  const handleResumeSubmit = async (file: File) => {
    setResumeLoading(true); setError(null); setScore(null); setModeData({});
    try {
      const { resumeId: id, parsed } = await parseResume(file);
      setResumeId(id); setParsedResume(parsed);
      if (jobId) await runScore(jobId, id);
    } catch (e) { handleError(e); } finally { setResumeLoading(false); }
  };

  const handleMode = useCallback(async (m: AnalysisMode) => {
    setMode(m);
    if (!jobId || !resumeId || modeData[m]) return;
    setAnalyzeLoading(true); setError(null);
    try {
      const data = await analyze(m, jobId, resumeId);
      setModeData(prev => ({ ...prev, [m]: data }));
      if (m === 'fit') setScore((data as FitAnalysisData).scoreBreakdown);
    } catch (e) { handleError(e); } finally { setAnalyzeLoading(false); }
  }, [jobId, resumeId, modeData]);

  const loadSavedJob = async (job: SavedJob) => {
    setActiveJobId(job.id); setJobId(job.jobId); setResumeId(job.resumeId);
    setScore(null); setModeData({}); setError(null); setParsedJD(null); setParsedResume(null);
    try { const s = await scoreOnly(job.jobId, job.resumeId); setScore(s); } catch (e) { handleError(e); }
  };

  const deleteSaved = (id: string) => {
    setSavedJobs(prev => { const u = prev.filter(j => j.id !== id); saveSaved(u); return u; });
    if (activeJobId === id) setActiveJobId(undefined);
  };

  const bothParsed = !!jobId && !!resumeId;

  return (
    <div className="min-h-screen dot-grid" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--bg-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm" style={{ background: 'var(--accent-amber)', color: '#0a0a0a' }}>JL</div>
          <span className="font-bold tracking-tight text-lg">JobLens <span className="font-mono font-light text-sm" style={{ color: 'var(--accent-amber)' }}>AI</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse-slow" style={{ background: 'var(--score-high)' }} />
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>API connected</span>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 p-3 overflow-y-auto" style={{ borderRight: '1px solid var(--bg-border)' }}>
          <JobSidebar jobs={savedJobs} activeId={activeJobId} onSelect={loadSavedJob} onDelete={deleteSaved} />
        </div>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
            {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}

            {/* Step 01 & 02 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>01 · Job Description</p>
                <JDInput onSubmit={handleJDSubmit} loading={jdLoading} parsed={!!parsedJD} title={parsedJD?.title} company={parsedJD?.company} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>02 · Resume</p>
                <ResumeUpload onFile={handleResumeSubmit} loading={resumeLoading} parsed={!!parsedResume} name={parsedResume?.name} />
              </div>
            </div>

            {/* Score + Skills grid */}
            {score && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up">
                <ScoreCard score={score} />
                <SkillGrid skills={score.matchedSkills} missingNiceToHave={score.missingNiceToHave} />
              </div>
            )}

            {/* Step 03 - Modes */}
            {bothParsed && (
              <div className="space-y-4 animate-fade-up">
                <p className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>03 · Analysis Mode</p>
                <ModeTabs active={mode} onChange={handleMode} loading={analyzeLoading} />

                {!modeData[mode] && !analyzeLoading && (
                  <button onClick={() => handleMode(mode)}
                    className="w-full py-3 rounded-xl text-sm font-semibold font-mono transition-all duration-200"
                    style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent-amber)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    Run {mode.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())} →
                  </button>
                )}

                {analyzeLoading && <Spinner label={`Running ${mode} analysis…`} />}

                {(!analyzeLoading && !!modeData[mode]) && (
                  <div className="animate-fade-up">
                    {mode === 'fit'          && <FitResult         data={modeData[mode] as FitAnalysisData}   />}
                    {mode === 'gaps'         && <GapResult         data={modeData[mode] as GapAnalysisData}   />}
                    {mode === 'cover-letter' && <CoverLetterResult data={modeData[mode] as CoverLetterData}   />}
                    {mode === 'interview'    && <InterviewResult   data={modeData[mode] as InterviewPrepData} />}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!bothParsed && !jdLoading && !resumeLoading && (
              <div className="text-center py-12 animate-fade-up delay-200">
                <p className="text-4xl mb-3 opacity-10">◎</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Paste a JD and upload your resume to begin</p>
                <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>Both are parsed with Gemini before scoring</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
