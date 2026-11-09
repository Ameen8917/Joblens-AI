import { useState, useCallback, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, CircleCheck, CircleX, Clock, FileText, House, LoaderCircle, Moon, Plus, Settings as SettingsIcon, Sparkles, Sun } from 'lucide-react';
import { parseJD, getJob } from '../api/jobs';
import { parseResume, getResume } from '../api/resumes';
import { analyze, scoreOnly } from '../api/analyze';
import { ScoreCard } from '../components/ui/ScoreCard';
import { SkillGrid } from '../components/ui/SkillGrid';
import { ModeTabs, modeLabel } from '../components/ui/ModeTabs';
import { ResumeUpload } from '../components/ui/ResumeUpload';
import { JDInput } from '../components/ui/JDInput';
import { JobSidebar, Logo } from '../components/ui/JobSidebar';
import { FitResult, GapResult, CoverLetterResult, InterviewResult } from '../components/ui/ModeResults';
import { ResumeTailoring } from '../components/ui/ResumeTailoring';
import { MockInterview } from '../components/ui/MockInterview';
import HistoryPage from './History';
import SettingsPage from './Settings';
import { useSettings } from '../hooks/useSettings';
import {
  ResultTab, ParsedJD, ParsedResume, ScoreBreakdown,
  FitAnalysisData, GapAnalysisData, CoverLetterData, InterviewPrepData,
  SavedJob,
} from '../types';

const STORAGE_KEY = 'joblens_saved_jobs';
const loadSaved = (): SavedJob[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const saveSaved = (j: SavedJob[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(j)); } catch { /* storage unavailable */ } };

const initials = (name?: string) =>
  (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || 'JL';

const Spinner = ({ label }: { label: string }) => (
  <div className="card flex flex-col items-center justify-center gap-3 py-14">
    <LoaderCircle className="h-8 w-8 animate-spin text-brand" />
    <p className="text-sm text-body">{label}</p>
  </div>
);

const ErrorBanner = ({ msg, onDismiss }: { msg: string; onDismiss: () => void }) => (
  <div role="alert" className="flex items-center gap-3 rounded-xl border border-bad/20 bg-bad-soft px-4 py-3 animate-fade-up">
    <CircleX className="h-5 w-5 flex-shrink-0 text-bad" />
    <p className="flex-1 text-sm text-bad">{msg}</p>
    <button onClick={onDismiss} className="text-sm font-semibold text-bad/70 hover:text-bad">Dismiss</button>
  </div>
);

const HeroArt = () => (
  <div aria-hidden className="relative hidden h-36 w-48 flex-shrink-0 md:block">
    <div className="absolute left-2 top-2 h-28 w-24 -rotate-6 rounded-xl border border-line bg-surface p-3 shadow-lift">
      <FileText className="h-6 w-6 text-info" />
      <div className="mt-3 space-y-1.5">
        {[80, 100, 64, 90].map((w, i) => <div key={i} className="h-1.5 rounded bg-subtle" style={{ width: `${w}%` }} />)}
      </div>
    </div>
    <div className="absolute bottom-0 right-4 flex h-20 w-24 items-center justify-center rounded-2xl bg-ink shadow-lift">
      <Briefcase className="h-9 w-9 text-surface" strokeWidth={1.5} />
    </div>
    <CircleCheck className="absolute bottom-3 left-20 h-10 w-10 rounded-full bg-surface text-brand shadow-lift" strokeWidth={2.25} />
    <Sparkles className="absolute right-2 top-0 h-6 w-6 text-brand" />
  </div>
);

const Step = ({ n, title, sub, done, children }: { n: number; title: string; sub: string; done: boolean; children: ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-brand text-white' : 'bg-brand-soft text-brand-dark'}`}>
        {done ? <CircleCheck className="h-4 w-4" /> : n}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
    </div>
    {children}
  </div>
);

export default function AnalyzePage() {
  const [jobId,        setJobId]        = useState<string | null>(null);
  const [resumeId,     setResumeId]     = useState<string | null>(null);
  const [parsedJD,     setParsedJD]     = useState<ParsedJD | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [score,        setScore]        = useState<ScoreBreakdown | null>(null);
  const [scoreMs,      setScoreMs]      = useState<number | null>(null);
  const { settings, update: updateSettings, dark } = useSettings();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const view = pathname === '/history' ? 'history' : pathname === '/settings' ? 'settings' : 'home';
  const [mode,         setMode]         = useState<ResultTab>(settings.defaultTab);
  const [modeData,     setModeData]     = useState<Record<string, unknown>>({});
  const [jdLoading,      setJdLoading]      = useState(false);
  const [resumeLoading,  setResumeLoading]  = useState(false);
  const [scoreLoading,   setScoreLoading]   = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [savedJobs,    setSavedJobs]    = useState<SavedJob[]>(loadSaved);
  const [activeJobId,  setActiveJobId]  = useState<string | undefined>();

  const handleError = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong');

  const timedScore = async (jId: string, rId: string) => {
    setScoreLoading(true);
    const t0 = performance.now();
    try {
      const s = await scoreOnly(jId, rId);
      setScore(s); setScoreMs(performance.now() - t0);
      return s;
    } finally { setScoreLoading(false); }
  };

  const runScore = useCallback(async (jId: string, rId: string, jd?: ParsedJD | null) => {
    try {
      const s = await timedScore(jId, rId);
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

  const handleMode = useCallback(async (m: ResultTab) => {
    setMode(m);
    if (m === 'tailor' || m === 'mock') return; // frontend previews, no API call yet
    if (!jobId || !resumeId || modeData[m]) return;
    setAnalyzeLoading(true); setError(null);
    try {
      const data = await analyze(m, jobId, resumeId);
      setModeData(prev => ({ ...prev, [m]: data }));
      if (m === 'fit') setScore((data as FitAnalysisData).scoreBreakdown);
    } catch (e) { handleError(e); } finally { setAnalyzeLoading(false); }
  }, [jobId, resumeId, modeData]);

  const reset = () => {
    setJobId(null); setResumeId(null); setParsedJD(null); setParsedResume(null);
    setScore(null); setScoreMs(null); setModeData({}); setError(null); setActiveJobId(undefined); setMode(settings.defaultTab);
    navigate('/');
  };

  const loadSavedJob = async (job: SavedJob) => {
    navigate('/');
    setActiveJobId(job.id); setJobId(job.jobId); setResumeId(job.resumeId);
    setScore(null); setModeData({}); setError(null); setParsedJD(null); setParsedResume(null);
    try {
      const [, jd, resume] = await Promise.all([
        timedScore(job.jobId, job.resumeId),
        getJob(job.jobId).catch(() => null),
        getResume(job.resumeId).catch(() => null),
      ]);
      if (jd) setParsedJD(jd.parsed);
      if (resume) setParsedResume(resume.parsed);
    } catch (e) { handleError(e); }
  };

  const deleteSaved = (id: string) => {
    setSavedJobs(prev => { const u = prev.filter(j => j.id !== id); saveSaved(u); return u; });
    if (activeJobId === id) setActiveJobId(undefined);
  };

  const clearHistory = () => { setSavedJobs([]); saveSaved([]); setActiveJobId(undefined); };

  const bothParsed = !!jobId && !!resumeId;
  const isPreviewTab = mode === 'tailor' || mode === 'mock';
  const activeJob = savedJobs.find(j => j.id === activeJobId);
  const jobTitle = parsedJD?.title ?? activeJob?.title;
  const jobCompany = parsedJD?.company ?? activeJob?.company;

  return (
    <div className="flex h-screen bg-page">
      <div className="hidden w-60 flex-shrink-0 border-r border-line bg-surface md:block">
        <JobSidebar jobs={savedJobs} activeId={activeJobId} onSelect={loadSavedJob} onDelete={deleteSaved}
          onHome={() => (view === 'home' ? reset() : navigate('/'))} homeActive={view === 'home' && !activeJobId} />
      </div>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="flex items-center justify-between px-4 pt-4 sm:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <Logo />
            <nav className="flex items-center gap-2 text-body">
              <Link to="/" aria-label="Home"><House className="h-4 w-4" /></Link>
              <Link to="/history" aria-label="History"><Clock className="h-4 w-4" /></Link>
              <Link to="/settings" aria-label="Settings"><SettingsIcon className="h-4 w-4" /></Link>
            </nav>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {view === 'home' && bothParsed && (
              <button onClick={reset} className="btn-secondary px-3 py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> New analysis</button>
            )}
            <button onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="text-body transition-colors hover:text-ink">
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <span title={settings.displayName || parsedResume?.name}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {initials(settings.displayName || parsedResume?.name)}
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-5 px-4 pb-12 pt-4 sm:px-8">
          {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}

          {view === 'history' && <HistoryPage jobs={savedJobs} onOpen={loadSavedJob} onDelete={deleteSaved} />}
          {view === 'settings' && <SettingsPage settings={settings} onChange={updateSettings} historyCount={savedJobs.length} onClearHistory={clearHistory} />}

          {view === 'home' && <>
          {!score && !scoreLoading ? (
            <section className="card hero-wash overflow-hidden p-6 sm:p-10 animate-fade-up">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                    Find Your Perfect <span className="text-brand">Job Match</span>
                  </h1>
                  <p className="mt-3 max-w-md text-[15px] leading-relaxed text-body">
                    Upload your resume and job description to get AI-powered analysis, scores and personalized insights.
                  </p>
                </div>
                <HeroArt />
              </div>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <Step n={1} title="Upload Resume" sub="Your latest resume (PDF)" done={!!parsedResume}>
                  <ResumeUpload onFile={handleResumeSubmit} loading={resumeLoading} parsed={!!parsedResume} name={parsedResume?.name} />
                </Step>
                <Step n={2} title="Add Job Description" sub="Paste the target job details" done={!!parsedJD}>
                  <JDInput onSubmit={handleJDSubmit} loading={jdLoading} parsed={!!parsedJD} title={parsedJD?.title} company={parsedJD?.company} />
                </Step>
              </div>
            </section>
          ) : (
            <section className="flex flex-wrap items-end justify-between gap-3 animate-fade-up">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Match report</p>
                <h1 className="truncate text-2xl font-extrabold tracking-tight text-ink">{jobTitle ?? 'Saved analysis'}</h1>
                {(jobCompany || parsedResume?.name) && (
                  <p className="text-sm text-body">{[jobCompany, parsedResume?.name && `for ${parsedResume.name}`].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              {score && scoreMs !== null && (
                <span className="flex items-center gap-1.5 text-xs text-body">
                  Analysis completed · {(scoreMs / 1000).toFixed(1)}s <CircleCheck className="h-4 w-4 text-brand" />
                </span>
              )}
            </section>
          )}

          {scoreLoading && <Spinner label="Scoring your resume against the job…" />}

          {score && (
            <>
              <ScoreCard score={score} />
              <SkillGrid skills={score.matchedSkills} missingNiceToHave={score.missingNiceToHave} />
            </>
          )}

          {bothParsed && score && (
            <section className="space-y-4 animate-fade-up">
              <ModeTabs active={mode} onChange={handleMode} loading={analyzeLoading} />

              {mode === 'tailor' && (parsedResume && parsedJD
                ? <ResumeTailoring key={`${jobId}_${resumeId}`} resume={parsedResume} jd={parsedJD} score={score} />
                : <div className="card px-6 py-10 text-center text-sm text-body">Resume details aren’t available for this saved job.</div>)}
              {mode === 'mock' && <MockInterview key={`${jobId}_${resumeId}`} jd={parsedJD}
                questions={(modeData.interview as InterviewPrepData | undefined)?.questions} />}

              {!isPreviewTab && !modeData[mode] && !analyzeLoading && (
                <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
                  <Sparkles className="h-7 w-7 text-brand" />
                  <p className="text-sm text-body">Generate a {modeLabel(mode).toLowerCase()} for this job with Gemini.</p>
                  <button onClick={() => handleMode(mode)} className="btn-primary">
                    Run {modeLabel(mode)} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {analyzeLoading && <Spinner label={`Running ${modeLabel(mode).toLowerCase()}…`} />}

              {!isPreviewTab && !analyzeLoading && !!modeData[mode] && (
                <div key={mode}>
                  {mode === 'fit'          && <FitResult         data={modeData[mode] as FitAnalysisData} />}
                  {mode === 'gaps'         && <GapResult         data={modeData[mode] as GapAnalysisData} score={score} />}
                  {mode === 'cover-letter' && <CoverLetterResult data={modeData[mode] as CoverLetterData} />}
                  {mode === 'interview'    && <InterviewResult   data={modeData[mode] as InterviewPrepData} />}
                </div>
              )}
            </section>
          )}
          </>}
        </div>
      </main>
    </div>
  );
}
