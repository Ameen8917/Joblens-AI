import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bot, Check, Lightbulb, LoaderCircle, Mic, Square, X } from 'lucide-react';
import { evaluateAnswer, SAMPLE_QUESTIONS } from '../../api/preview';
import { InterviewQuestion, MockFeedback, ParsedJD } from '../../types';
import { PreviewBadge } from './PreviewBadge';
import { Ring } from './ScoreCard';

interface Props { questions?: InterviewQuestion[]; jd?: ParsedJD | null; }

const PASS = 60;
const strokeFor = (n: number) => (n >= 75 ? 'stroke-good' : n >= 50 ? 'stroke-warn' : 'stroke-bad');

// The Web Speech API isn't in TypeScript's DOM lib.
/* eslint-disable @typescript-eslint/no-explicit-any */
const SpeechRecognitionApi = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export const MockInterview = ({ questions, jd }: Props) => {
  const list = questions?.length ? questions : SAMPLE_QUESTIONS;
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, MockFeedback>>({});
  const [evaluating, setEvaluating] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognition = useRef<any>(null);

  useEffect(() => () => recognition.current?.abort(), []);

  const question = list[index];
  const draft = drafts[index] ?? '';
  const feedback = results[index];

  const setDraft = (text: string) => setDrafts(prev => ({ ...prev, [index]: text }));
  const stopListening = () => { recognition.current?.stop(); setListening(false); };

  const toggleMic = () => {
    if (listening) { stopListening(); return; }
    setMicError(null);
    const rec = new SpeechRecognitionApi();
    rec.continuous = true;
    rec.interimResults = false;
    const target = index;
    rec.onresult = (e: any) => {
      let heard = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heard += e.results[i][0].transcript;
      if (heard) setDrafts(prev => ({ ...prev, [target]: `${prev[target] ?? ''} ${heard}`.trim() }));
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

  const go = (next: number) => { stopListening(); setIndex(next); };

  const submit = async () => {
    stopListening();
    setEvaluating(true);
    const result = await evaluateAnswer(question, draft, jd);
    setResults(prev => ({ ...prev, [index]: result }));
    setEvaluating(false);
  };

  const rows = feedback ? [
    { label: 'Structure', value: feedback.structure },
    { label: 'Content', value: feedback.content },
    { label: 'Relevance', value: feedback.relevance },
  ] : [];

  return (
    <div className="grid items-start gap-4 animate-fade-up lg:grid-cols-[1fr_320px]">
      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted">Question {index + 1} of {list.length}</p>
          <PreviewBadge>{questions?.length ? 'Preview' : 'Preview · sample questions'}</PreviewBadge>
        </div>

        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-soft">
            <Bot className="h-8 w-8 text-brand" />
          </span>
          <div className="rounded-2xl rounded-tl-sm border border-info/15 bg-info-soft px-4 py-3">
            <p className="text-sm font-semibold text-ink">{question.question}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          {SpeechRecognitionApi ? (
            <>
              <button onClick={toggleMic} aria-label={listening ? 'Stop recording' : 'Start recording'}
                className={`flex h-16 w-16 items-center justify-center rounded-full text-white ring-8 transition-colors ${
                  listening ? 'bg-bad ring-bad-soft' : 'bg-brand ring-brand-soft hover:bg-brand/90'}`}>
                {listening ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
              </button>
              <p className="mt-2 text-xs text-body" aria-live="polite">{listening ? 'Listening… click to stop' : 'Click to speak'}</p>
            </>
          ) : (
            <p className="text-xs text-muted">Voice input isn’t supported in this browser. Type your answer below.</p>
          )}
          {micError && <p className="text-xs font-medium text-bad">{micError}</p>}
        </div>

        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={5}
          aria-label="Your answer" placeholder="Your answer appears here as you speak, or type it…"
          className="mt-4 w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand-soft" />

        <div className="mt-3 flex items-center justify-between gap-2">
          <button onClick={() => go(index - 1)} disabled={index === 0} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">
            <ArrowLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <div className="flex gap-2">
            <button onClick={submit} disabled={!draft.trim() || evaluating} className="btn-primary px-3 py-1.5 text-xs">
              {evaluating && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />} Get Feedback
            </button>
            <button onClick={() => go(index + 1)} disabled={index === list.length - 1} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">
              Next <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <p className="eyebrow mb-4">Your Performance</p>
          {feedback ? (
            <div className="flex items-center gap-5">
              <Ring value={feedback.overall} strokeClass={strokeFor(feedback.overall)} size="h-24 w-24">
                <span className="text-xl font-extrabold text-ink">{feedback.overall}%</span>
              </Ring>
              <ul className="flex-1 space-y-2.5">
                {rows.map(r => (
                  <li key={r.label} className="flex items-center justify-between text-xs text-body">
                    {r.label}
                    {r.value >= PASS ? <Check className="h-4 w-4 text-good" /> : <X className="h-4 w-4 text-bad" />}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-body">Answer this question to see how it scores.</p>
          )}
          {feedback && <p className="mt-4 text-[11px] leading-relaxed text-muted">Rule-based estimate for now. AI evaluation comes with the backend.</p>}
        </div>

        {feedback && (
          <div className="rounded-2xl border border-warn/20 bg-warn-soft p-5 animate-fade-up">
            <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink"><Lightbulb className="h-4 w-4 text-warn" /> Tips</p>
            <ul className="space-y-1.5">
              {feedback.tips.map(t => <li key={t} className="text-xs leading-relaxed text-body">{t}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
