import { useState } from 'react';
import { FitAnalysisData, GapAnalysisData, CoverLetterData, InterviewPrepData } from '../../types';
// ═══════════════════════════════════════════════════
// FIT ANALYSIS
// ═══════════════════════════════════════════════════
export const FitResult = ({ data }: { data: FitAnalysisData }) => (
  <div className="space-y-4 animate-fade-up">
    {/* Verdict */}
    <div className="glass-elevated rounded-xl px-5 py-4" style={{ borderLeft: '3px solid var(--accent-amber)' }}>
      <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--accent-amber)' }}>Verdict</p>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{data.verdict}</p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Strengths */}
      <div className="glass-elevated rounded-xl p-5">
        <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--score-high)' }}>
          ↑ Strengths
        </p>
        <ul className="space-y-2">
          {data.strengths.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="mt-0.5 flex-shrink-0 font-mono font-bold" style={{ color: 'var(--score-high)' }}>+</span>
              <span style={{ color: 'var(--text-secondary)' }}>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Gaps */}
      <div className="glass-elevated rounded-xl p-5">
        <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--score-low)' }}>
          ↓ Gaps
        </p>
        <ul className="space-y-2">
          {data.gaps.map((g, i) => (
            <li key={i} className="flex gap-2.5 text-sm animate-fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="mt-0.5 flex-shrink-0 font-mono font-bold" style={{ color: 'var(--score-low)' }}>−</span>
              <span style={{ color: 'var(--text-secondary)' }}>{g}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════
// GAP ANALYSIS
// ═══════════════════════════════════════════════════
const priorityConfig = {
  high:   { color: 'var(--score-low)',   bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   label: 'HIGH'   },
  medium: { color: 'var(--accent-amber)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', label: 'MED'    },
  low:    { color: 'var(--accent-blue)',  bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)', label: 'LOW'    },
};

export const GapResult = ({ data }: { data: GapAnalysisData }) => (
  <div className="space-y-3 animate-fade-up">
    {data.gaps.map((gap, i) => {
      const cfg = priorityConfig[gap.priority];
      return (
        <div key={i} className="glass-elevated rounded-xl p-5 animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
          <div className="flex items-start gap-3 mb-3">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold flex-shrink-0 mt-0.5"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
              {cfg.label}
            </span>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{gap.skill}</span>
          </div>
          <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{gap.reason}</p>
          <div className="flex gap-2 items-start pt-3" style={{ borderTop: '1px solid var(--bg-border)' }}>
            <span className="font-mono text-xs flex-shrink-0 pt-0.5" style={{ color: 'var(--accent-amber)' }}>→</span>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--accent-amber)' }}>{gap.suggestion}</p>
          </div>
        </div>
      );
    })}
  </div>
);

// ═══════════════════════════════════════════════════
// COVER LETTER
// ═══════════════════════════════════════════════════
export const CoverLetterResult = ({ data }: { data: CoverLetterData }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${data.subject}\n\n${data.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-elevated rounded-xl p-6 animate-fade-up space-y-4">
      {/* Subject + meta */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Subject</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{data.subject}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'var(--bg-border)', color: 'var(--text-secondary)' }}>
            {data.wordCount} words
          </span>
          <button onClick={copy}
            className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all duration-200 font-semibold"
            style={{ background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.12)',
                     color: copied ? 'var(--score-high)' : 'var(--accent-amber)',
                     border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
            {copied ? '✓ Copied' : '⎘ Copy'}
          </button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--bg-border)' }} />

      {/* Body */}
      <div className="text-sm leading-8 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
        {data.body}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// INTERVIEW PREP
// ═══════════════════════════════════════════════════
const typeConfig = {
  behavioral:    { color: 'var(--accent-blue)',  label: 'Behavioral'    },
  technical:     { color: 'var(--accent-amber)', label: 'Technical'     },
  'role-specific': { color: 'var(--accent-coral)', label: 'Role-Specific' },
};

export const InterviewResult = ({ data }: { data: InterviewPrepData }) => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-2 animate-fade-up">
      {data.questions.map((q, i) => {
        const cfg = typeConfig[q.type];
        const isOpen = open === i;
        return (
          <div key={i} className="glass-elevated rounded-xl overflow-hidden animate-fade-up"
            style={{ animationDelay: `${i * 0.06}s` }}>
            <button className="w-full flex items-center gap-3 p-4 text-left transition-colors duration-150"
              style={{ background: isOpen ? 'rgba(245,158,11,0.04)' : 'transparent' }}
              onClick={() => setOpen(isOpen ? null : i)}>
              <span className="text-xs font-mono px-2 py-0.5 rounded flex-shrink-0"
                style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
                {cfg.label}
              </span>
              <span className="text-sm flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{q.question}</span>
              <span className="font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{isOpen ? '−' : '+'}</span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--bg-border)' }}>
                <p className="text-xs font-mono uppercase tracking-widest mt-3 mb-2" style={{ color: 'var(--accent-amber)' }}>
                  Answer Framework
                </p>
                <ul className="space-y-1.5">
                  {q.answerFramework.map((tip, j) => (
                    <li key={j} className="flex gap-2.5 text-xs animate-fade-up" style={{ animationDelay: `${j * 0.05}s` }}>
                      <span className="font-mono font-bold mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-amber)' }}>›</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
