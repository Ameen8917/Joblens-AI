import { ScoreBreakdown } from '../../types';

interface Props { score: ScoreBreakdown; }

const scoreColor = (n: number) => {
  if (n >= 75) return { text: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: '#22c55e' };
  if (n >= 50) return { text: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: '#f59e0b' };
  return             { text: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: '#ef4444' };
};
const scoreLabel = (n: number) => n >= 75 ? 'Strong Match' : n >= 50 ? 'Moderate Match' : 'Weak Match';

const Bar = ({ label, value, color, delay }: { label: string; value: number; color: string; delay: string }) => (
  <div className={`animate-fade-up ${delay}`}>
    <div className="flex justify-between mb-1">
      <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-xs font-mono font-semibold" style={{ color }}>{value}%</span>
    </div>
    <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-border)' }}>
      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${value}%`, background: color }} />
    </div>
  </div>
);

export const ScoreCard = ({ score }: Props) => {
  const c = scoreColor(score.finalScore);
  const delta = score.yearsOfExperienceDelta;
  return (
    <div className="glass p-6 animate-fade-up">
      <div className="flex gap-6 items-start mb-6">
        <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl w-32 h-32 animate-score"
          style={{ background: c.bg, border: `2px solid ${c.border}` }}>
          <span className="text-4xl font-bold font-mono" style={{ color: c.text }}>{score.finalScore}</span>
          <span className="text-xs font-mono mt-1" style={{ color: 'var(--text-secondary)' }}>/ 100</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold mb-1" style={{ color: c.text }}>{scoreLabel(score.finalScore)}</p>
          <p className="text-xs font-mono mb-4" style={{ color: 'var(--text-secondary)' }}>Semantic 60% · Programmatic 40%</p>
          <div className="space-y-3">
            <Bar label="SEMANTIC SCORE"     value={score.semanticScore}     color="var(--accent-blue)"  delay="delay-100" />
            <Bar label="PROGRAMMATIC SCORE" value={score.programmaticScore} color="var(--accent-amber)" delay="delay-200" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'MATCHED',      val: `${score.matchedSkills.filter(s=>s.status==='matched').length}/${score.matchedSkills.length}`, color: 'var(--score-high)' },
          { label: 'MISSING REQ.', val: `${score.missingRequired.length}`,                                                            color: 'var(--score-low)'  },
          { label: 'YOE DELTA',    val: `${delta >= 0 ? '+' : ''}${delta} yrs`,                                                       color: delta >= 0 ? 'var(--score-high)' : 'var(--score-mid)' },
        ].map(s => (
          <div key={s.label} className="glass-elevated rounded-lg px-3 py-3 text-center animate-fade-up delay-300">
            <div className="font-mono font-semibold text-xl" style={{ color: s.color }}>{s.val}</div>
            <div className="text-xs font-mono mt-0.5 tracking-wide" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
