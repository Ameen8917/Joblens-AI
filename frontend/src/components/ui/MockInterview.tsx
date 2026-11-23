import { ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, CircleX, Lightbulb, LoaderCircle, Mic, RotateCcw, SkipForward, Square, TriangleAlert, User, Volume2, VolumeX } from 'lucide-react';
import { finishInterview, skipQuestion, startInterview, submitAnswer } from '../../api/interview';
import { AnswerEvaluation, ConsistencyFlag, CriterionScore, InterviewExchange, InterviewFocus, InterviewSessionState } from '../../types';
import { Ring } from './ScoreCard';

interface Props { jobId: string; resumeId: string; }

const COUNTS = [3, 4, 5, 6];
const strokeFor = (n: number) => (n >= 75 ? 'stroke-good' : n >= 50 ? 'stroke-warn' : 'stroke-bad');
const barFor = (n: number) => (n >= 75 ? 'bg-good' : n >= 50 ? 'bg-warn' : 'bg-bad');
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

// The Web Speech API isn't in TypeScript's DOM lib.
/* eslint-disable @typescript-eslint/no-explicit-any */
const SpeechRecognitionApi = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

const focusLabel = (focus: InterviewFocus) =>
  focus.kind === 'resume_claim' ? 'About your resume'
    : focus.kind === 'job_requirement' ? `Job requirement${focus.requirement ? `: ${focus.requirement}` : ''}`
    : 'Behavioral';

const CRITERIA: { key: 'structure' | 'specifics' | 'relevance'; label: string }[] = [
  { key: 'structure', label: 'Structure' },
  { key: 'specifics', label: 'Specifics' },
  { key: 'relevance', label: 'Relevance' },
];

const Bubble = ({ role, children }: { role: 'interviewer' | 'candidate'; children: ReactNode }) => (
  <div className={`flex items-start gap-3 ${role === 'candidate' ? 'flex-row-reverse' : ''}`}>
    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${role === 'interviewer' ? 'bg-brand-soft text-brand' : 'bg-subtle text-body'}`}>
      {role === 'interviewer' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
    </span>
    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
      role === 'interviewer' ? 'rounded-tl-sm border border-info/15 bg-info-soft font-medium text-ink' : 'rounded-tr-sm bg-subtle text-ink'}`}>
      {children}
    </div>
  </div>
);

const Criterion = ({ label, value }: { label: string; value: CriterionScore }) => (
  <li className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="font-semibold text-ink">{label}</span>
      <span className="flex items-center gap-1" aria-label={`${value.score} out of 5`}>
        {[1, 2, 3, 4, 5].map(n => <span key={n} className={`h-1.5 w-4 rounded-full ${n <= value.score ? barFor((value.score - 1) * 25) : 'bg-subtle'}`} />)}
        <span className="ml-1 font-semibold text-body">{value.score}/5</span>
      </span>
    </div>
    {value.note && <p className="text-[11px] leading-relaxed text-body">{value.note}</p>}
    {value.quotes.map(q => <p key={q} className="text-[11px] italic text-muted">From your answer: “{q}”</p>)}
    {value.capped && <p className="text-[11px] text-warn">Held at 3: nothing quoted from your answer backed a higher score.</p>}
  </li>
);

const Flag = ({ flag }: { flag: ConsistencyFlag }) => (
  <p className={`flex items-start gap-1.5 rounded-md px-2 py-1 text-[11px] leading-relaxed ${flag.kind === 'contradiction' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'}`}>
    {flag.kind === 'contradiction' ? <CircleX className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
    {flag.detail}
  </p>
);

const Feedback = ({ evaluation, pending }: { evaluation: AnswerEvaluation; pending: boolean }) => (
  <div className="card space-y-4 p-5">
    <p className="eyebrow">Feedback</p>
    <div className="flex items-center gap-4">
      <Ring value={evaluation.overall} strokeClass={strokeFor(evaluation.overall)} size="h-20 w-20">
        <span className="text-lg font-extrabold text-ink">{evaluation.overall}</span>
      </Ring>
      <p className="text-xs leading-relaxed text-body">
        {pending ? 'Answer the follow-up and this updates to cover both answers.' : 'Scored against a rubric. Each score above 3 must quote your own words.'}
      </p>
    </div>
    <ul className="space-y-3">{CRITERIA.map(c => <Criterion key={c.key} label={c.label} value={evaluation[c.key]} />)}</ul>
    {evaluation.consistency.length > 0 && (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-ink">Checked against your resume</p>
        {evaluation.consistency.map(f => <Flag key={`${f.kind}-${f.claim}`} flag={f} />)}
      </div>
    )}
    {evaluation.tip && (
      <p className="flex items-start gap-2 rounded-lg bg-brand-soft px-3 py-2 text-xs leading-relaxed text-brand-dark">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{evaluation.tip}
      </p>
    )}
  </div>
);

const Report = ({ session, onRestart }: { session: InterviewSessionState; onRestart: () => void }) => {
  const report = session.report!;
  const question = (i: number | null) => (i === null ? null : session.exchanges[i]?.turns[0]?.text);
  return (
    <div className="grid items-start gap-4 animate-fade-up lg:grid-cols-[280px_1fr]">
      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        <p className="eyebrow">Interview Score</p>
        <Ring value={report.overall} strokeClass={strokeFor(report.overall)} size="h-32 w-32">
          <span className="text-3xl font-extrabold text-ink">{report.overall}</span>
        </Ring>
        <p className="text-xs text-body">{report.answered} of {session.exchanges.length} questions answered</p>
        <ul className="w-full space-y-2 pt-2">
          {CRITERIA.map(c => (
            <li key={c.key} className="text-left text-xs">
              <div className="mb-1 flex justify-between"><span className="text-body">{c.label}</span><span className="font-semibold text-ink">{report.byCriterion[c.key]}</span></div>
              <div className="h-1.5 rounded-full bg-subtle"><div className={`h-1.5 rounded-full ${barFor(report.byCriterion[c.key])}`} style={{ width: `${report.byCriterion[c.key]}%` }} /></div>
            </li>
          ))}
        </ul>
        <button onClick={onRestart} className="btn-secondary mt-2 w-full text-xs"><RotateCcw className="h-3.5 w-3.5" /> Practise again</button>
      </div>

      <div className="space-y-4">
        {report.answered === 0 ? (
          <div className="card p-5 text-sm text-body">No questions were answered, so there's nothing to score yet.</div>
        ) : <>
          {(report.strongest !== null || report.weakest !== null) && (
            <div className="card grid gap-4 p-5 sm:grid-cols-2">
              {report.strongest !== null && <div><p className="eyebrow mb-1 text-good">Strongest answer</p><p className="text-sm text-ink">{question(report.strongest)}</p></div>}
              {report.weakest !== null && <div><p className="eyebrow mb-1 text-bad">Needs most work</p><p className="text-sm text-ink">{question(report.weakest)}</p></div>}
            </div>
          )}
          {report.tips.length > 0 && (
            <div className="card p-5">
              <p className="eyebrow mb-2">What to practise</p>
              <ul className="space-y-2">{report.tips.map(t => <li key={t} className="flex items-start gap-2 text-sm text-body"><Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />{t}</li>)}</ul>
            </div>
          )}
          {report.consistency.length > 0 && (
            <div className="card space-y-1.5 p-5">
              <p className="eyebrow mb-1">Checked against your resume</p>
              {report.consistency.map(f => <Flag key={`${f.question}-${f.kind}-${f.claim}`} flag={{ ...f, detail: `Question ${f.question + 1}: ${f.detail}` }} />)}
            </div>
          )}
        </>}
      </div>
    </div>
  );
};

export const MockInterview = ({ jobId, resumeId }: Props) => {
  const [session, setSession] = useState<InterviewSessionState | null>(null);
  const [count, setCount] = useState(4);
  const [readAloud, setReadAloud] = useState(false);
  const [busy, setBusy] = useState<'starting' | 'answering' | 'skipping' | 'finishing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [liveEvaluation, setLiveEvaluation] = useState<{ index: number; evaluation: AnswerEvaluation } | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognition = useRef<any>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  useEffect(() => () => { recognition.current?.abort(); if (canSpeak) window.speechSynthesis.cancel(); }, []);
  useEffect(() => { transcriptEnd.current?.scrollIntoView({ block: 'nearest' }); }, [streaming, session, viewing]);

  const say = (text: string) => {
    if (!readAloud || !canSpeak || !text) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const stopListening = () => { recognition.current?.stop(); setListening(false); };
  const toggleMic = () => {
    if (listening) { stopListening(); return; }
    setMicError(null);
    const rec = new SpeechRecognitionApi();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      let heard = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += e.results[i][0].transcript;
      if (heard) setDraft(prev => `${prev} ${heard}`.trim());
    };
    rec.onerror = (e: any) => {
      if (e.error !== 'aborted') setMicError('Microphone unavailable. You can type your answer instead.');
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recognition.current = rec;
    rec.start();
    setListening(true);
  };

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
    setBusy(kind); setError(null);
    try { await action(); } catch (e) { setError(errorText(e)); } finally { setBusy(null); }
  };

  const start = () => run('starting', async () => {
    const next = await startInterview(jobId, resumeId, count);
    setSession(next); setViewing(null); setDraft('');
    say(next.exchanges[0]?.turns[0]?.text ?? '');
  });

  const answer = () => session && run('answering', async () => {
    stopListening();
    const index = session.exchanges.findIndex(e => !e.done);
    setStreaming('');
    try {
      const next = await submitAnswer(session.sessionId, draft.trim(), {
        onEvaluation: (i, evaluation) => setLiveEvaluation({ index: i, evaluation }),
        onToken: text => setStreaming(prev => (prev ?? '') + text),
        onStreamError: message => setError(`The follow-up question failed (${message}), so the interview moved on.`),
      });
      setSession(next); setDraft('');
      const exchange = next.exchanges[index];
      // Keep a finished question on screen so its feedback can be read before moving on.
      if (exchange.done) setViewing(index);
      else say(exchange.turns[exchange.turns.length - 1].text);
    } finally {
      setStreaming(null); setLiveEvaluation(null);
    }
  });

  const skip = () => session && run('skipping', async () => {
    stopListening();
    const next = await skipQuestion(session.sessionId);
    setSession(next); setDraft(''); setViewing(null);
    const upcoming = next.exchanges.find(e => !e.done);
    if (upcoming) say(upcoming.turns[0].text);
  });

  const finish = () => session && run('finishing', async () => {
    stopListening();
    setSession(await finishInterview(session.sessionId));
  });

  const nextQuestion = () => {
    setViewing(null);
    const upcoming = session?.exchanges.find(e => !e.done);
    if (upcoming) say(upcoming.turns[0].text);
  };

  if (!session) {
    return (
      <div className="card flex flex-col items-center gap-4 px-6 py-10 text-center animate-fade-up">
        <Bot className="h-8 w-8 text-brand" />
        <div className="max-w-lg space-y-1">
          <p className="text-sm font-semibold text-ink">A live interview built from this job and your resume</p>
          <p className="text-sm text-body">
            Questions go deeper on your own resume lines and the job's requirements. Each answer is scored, checked against
            your resume, and may get a follow-up, just like a real interviewer would ask.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-body">
          <span>Questions:</span>
          <div className="flex gap-1">
            {COUNTS.map(n => (
              <button key={n} onClick={() => setCount(n)} aria-pressed={count === n}
                className={`h-8 w-8 rounded-lg border text-xs font-semibold ${count === n ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-body hover:text-ink'}`}>{n}</button>
            ))}
          </div>
          {canSpeak && (
            <label className="ml-2 flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={readAloud} onChange={e => setReadAloud(e.target.checked)} className="accent-brand" /> Read questions aloud
            </label>
          )}
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
        <button onClick={start} disabled={busy === 'starting'} className="btn-primary">
          {busy === 'starting' ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Planning your interview…</> : <>Start interview <ArrowRight className="h-4 w-4" /></>}
        </button>
        <p className="text-[11px] text-muted">Uses one AI request to plan, one per answer, and one per follow-up.</p>
      </div>
    );
  }

  if (session.status === 'finished' && session.report) {
    return <Report session={session} onRestart={() => { setSession(null); setViewing(null); setError(null); }} />;
  }

  const current = session.exchanges.findIndex(e => !e.done);
  const shown = viewing ?? (current >= 0 ? current : session.exchanges.length - 1);
  const exchange: InterviewExchange = session.exchanges[shown];
  const isCurrent = shown === current;
  const evaluation = liveEvaluation?.index === shown ? liveEvaluation.evaluation : exchange.evaluation;
  const answering = busy === 'answering';

  return (
    <div className="grid items-start gap-4 animate-fade-up lg:grid-cols-[1fr_320px]">
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Questions">
            {session.exchanges.map((e, i) => (
              <button key={i} role="tab" aria-selected={i === shown} disabled={!e.done && i !== current}
                onClick={() => setViewing(i === current ? null : i)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors disabled:opacity-40 ${
                  i === shown ? 'bg-brand text-white' : e.done ? 'bg-brand-soft text-brand-dark' : 'bg-subtle text-body'}`}>{i + 1}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-subtle px-2 py-0.5 text-[11px] font-semibold text-body">{focusLabel(exchange.focus)}</span>
            {canSpeak && (
              <button onClick={() => setReadAloud(v => !v)} aria-label={readAloud ? 'Stop reading questions aloud' : 'Read questions aloud'} className="text-body hover:text-ink">
                {readAloud ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {exchange.turns.map((t, i) => (
            <Bubble key={i} role={t.role}>
              {t.kind === 'follow_up' && <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-info">Follow-up</span>}
              {t.text}
            </Bubble>
          ))}
          {isCurrent && answering && <Bubble role="candidate">{draft}</Bubble>}
          {isCurrent && streaming !== null && (
            <Bubble role="interviewer">
              {streaming
                ? <><span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-info">Follow-up</span>{streaming}<span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-ink/60 align-middle" /></>
                : <span className="flex items-center gap-2 text-body"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {liveEvaluation ? 'Thinking of a follow-up…' : 'Scoring your answer…'}</span>}
            </Bubble>
          )}
          <div ref={transcriptEnd} />
        </div>

        {error && <p className="mt-3 text-xs text-bad">{error}</p>}

        {isCurrent ? (
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-start gap-3">
              {SpeechRecognitionApi && (
                <button onClick={toggleMic} disabled={answering} aria-label={listening ? 'Stop recording' : 'Answer by voice'}
                  className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:opacity-50 ${listening ? 'bg-bad' : 'bg-brand hover:bg-brand/90'}`}>
                  {listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
                </button>
              )}
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} disabled={answering} maxLength={4000}
                aria-label="Your answer" placeholder={listening ? 'Listening… your words appear here.' : 'Type your answer, or use the microphone…'}
                className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand-soft disabled:opacity-60" />
            </div>
            {micError && <p className="mt-1 text-xs text-bad">{micError}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button onClick={finish} disabled={!!busy} className="text-xs font-semibold text-body hover:text-ink disabled:opacity-50">
                {busy === 'finishing' ? 'Finishing…' : 'Finish early'}
              </button>
              <div className="flex gap-2">
                <button onClick={skip} disabled={!!busy} className="btn-secondary px-3 py-1.5 text-xs"><SkipForward className="h-3.5 w-3.5" /> Skip</button>
                <button onClick={answer} disabled={!draft.trim() || !!busy} className="btn-primary px-3 py-1.5 text-xs">
                  {answering && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />} Submit answer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex justify-end border-t border-line pt-4">
            {current >= 0
              ? <button onClick={nextQuestion} className="btn-primary px-3 py-1.5 text-xs">{shown < current ? 'Back to current question' : 'Next question'} <ArrowRight className="h-3.5 w-3.5" /></button>
              : <button onClick={finish} disabled={!!busy} className="btn-primary px-3 py-1.5 text-xs">
                  {busy === 'finishing' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />} See your report <ArrowRight className="h-3.5 w-3.5" />
                </button>}
          </div>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-4">
        {evaluation
          ? <Feedback evaluation={evaluation} pending={!exchange.done} />
          : (
            <div className="card p-5">
              <p className="eyebrow mb-2">Feedback</p>
              <p className="text-xs leading-relaxed text-body">
                {exchange.done ? 'This question was skipped.' : 'Answer to get scored on structure, specifics and relevance, with each answer checked against your resume.'}
              </p>
              {exchange.focus.bullet && !exchange.done && (
                <p className="mt-3 text-[11px] leading-relaxed text-muted">This question is about your resume line: “{exchange.focus.bullet}”</p>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
