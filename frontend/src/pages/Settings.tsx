import { ReactNode, useState } from 'react';
import { Settings, ThemeChoice } from '../hooks/useSettings';
import { TABS } from '../components/ui/ModeTabs';
import { PreviewBadge } from '../components/ui/PreviewBadge';
import { ResultTab } from '../types';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  historyCount: number;
  onClearHistory: () => void;
}

const inputCls = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand-soft sm:w-64';

const Section = ({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) => (
  <section className="card p-5">
    <div className="mb-1 flex items-center gap-2">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {badge && <PreviewBadge>{badge}</PreviewBadge>}
    </div>
    <div className="divide-y divide-line">{children}</div>
  </section>
);

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
    <div>
      <p className="text-sm font-medium text-ink">{label}</p>
      {hint && <p className="text-xs text-body">{hint}</p>}
    </div>
    {children}
  </div>
);

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-fit rounded-lg bg-subtle p-1">
      {options.map(o => (
        <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${value === o.id ? 'bg-surface text-ink shadow-card' : 'text-body hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'System' },
];

export default function SettingsPage({ settings, onChange, historyCount, onClearHistory }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="max-w-3xl space-y-4 animate-fade-up">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Settings</h1>
        <p className="text-sm text-body">Saved in this browser.</p>
      </div>

      <Section title="Profile">
        <Field label="Display name" hint="Used for the initials in the top corner.">
          <input value={settings.displayName} onChange={e => onChange({ displayName: e.target.value })}
            placeholder="Your name" aria-label="Display name" className={inputCls} />
        </Field>
      </Section>

      <Section title="Preferences">
        <Field label="Theme">
          <Segmented label="Theme" value={settings.theme} options={THEMES} onChange={theme => onChange({ theme })} />
        </Field>
        <Field label="Default results tab" hint="The tab that opens first on a new analysis.">
          <select value={settings.defaultTab} onChange={e => onChange({ defaultTab: e.target.value as ResultTab })}
            aria-label="Default results tab" className={inputCls}>
            {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="AI Preferences" badge="Used once the backend supports it">
        <Field label="Cover letter tone">
          <Segmented label="Cover letter tone" value={settings.coverLetterTone}
            options={[{ id: 'professional', label: 'Professional' }, { id: 'friendly', label: 'Friendly' }, { id: 'confident', label: 'Confident' }]}
            onChange={coverLetterTone => onChange({ coverLetterTone })} />
        </Field>
        <Field label="Interview difficulty">
          <Segmented label="Interview difficulty" value={settings.interviewDifficulty}
            options={[{ id: 'easy', label: 'Easy' }, { id: 'standard', label: 'Standard' }, { id: 'hard', label: 'Hard' }]}
            onChange={interviewDifficulty => onChange({ interviewDifficulty })} />
        </Field>
      </Section>

      <Section title="Data">
        <Field label="Clear history" hint={`Removes ${historyCount} saved ${historyCount === 1 ? 'job' : 'jobs'} from this browser.`}>
          {confirming ? (
            <div className="flex gap-2">
              <button onClick={() => { onClearHistory(); setConfirming(false); }}
                className="inline-flex items-center rounded-lg bg-bad px-3 py-1.5 text-xs font-semibold text-white hover:bg-bad/90">Yes, clear</button>
              <button onClick={() => setConfirming(false)} className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} disabled={historyCount === 0} className="btn-secondary px-3 py-1.5 text-xs text-bad disabled:opacity-40">Clear history</button>
          )}
        </Field>
      </Section>
    </div>
  );
}
