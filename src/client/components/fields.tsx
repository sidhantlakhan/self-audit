import { useId, useState } from 'react';
import type { Answer } from '../../shared/types.ts';
import { useVoice } from '../lib/voice.ts';
import { Check } from './ui.tsx';

export interface QDef {
  id: string; phase: number; type: string; label: string; description?: string; helpText?: string; required: boolean;
  options?: string[]; exclusiveOptions?: string[]; rankCount?: number; scale?: { low: string; high: string };
  validation?: { minLength?: number; maxLength?: number; min?: number; max?: number }; voice?: boolean;
}

interface FieldProps { q: QDef; value: Answer | undefined; onChange: (v: Answer) => void; error?: string; describedBy: string }

const inputProps = (q: QDef, error: string | undefined, describedBy: string) => ({
  'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': q.required || undefined,
});

export function Field(p: FieldProps) {
  switch (p.q.type) {
    case 'short_text': case 'phone': case 'email': case 'numeric': return <TextInput {...p} />;
    case 'long_text': return <LongText {...p} />;
    case 'single_select': return (p.q.options?.length ?? 0) > 7 ? <SelectInput {...p} /> : <Choice {...p} multi={false} />;
    case 'multi_select': return <Choice {...p} multi />;
    case 'rating': return <Rating {...p} />;
    case 'ranking': return <Ranking {...p} />;
    default: return null;
  }
}

function TextInput({ q, value, onChange, error, describedBy }: FieldProps) {
  const type = q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : q.type === 'numeric' ? 'number' : 'text';
  const auto = q.id === 'Q1.1' ? 'name' : q.id === 'Q1.2' ? 'organization' : q.id === 'Q1.3' ? 'tel' : q.id === 'Q1.4' ? 'email' : 'off';
  return (
    <input
      id={`in-${q.id}`} className="input" type={type} autoComplete={auto} inputMode={q.type === 'phone' ? 'tel' : q.type === 'numeric' ? 'decimal' : undefined}
      value={value === null || value === undefined ? '' : String(value)} maxLength={q.validation?.maxLength}
      placeholder={q.type === 'phone' ? '98765 43210' : q.type === 'email' ? 'name@company.com' : undefined}
      onChange={(e) => onChange(q.type === 'numeric' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      {...inputProps(q, error, describedBy)}
    />
  );
}

function LongText({ q, value, onChange, error, describedBy }: FieldProps) {
  const text = typeof value === 'string' ? value : '';
  const max = q.validation?.maxLength ?? 1200;
  const voice = useVoice((t) => onChange(((text ? text + ' ' : '') + t).slice(0, max)));
  return (
    <>
      <textarea id={`in-${q.id}`} className="textarea" rows={5} maxLength={max} value={text} onChange={(e) => onChange(e.target.value)} {...inputProps(q, error, describedBy)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {q.voice && voice.supported ? (
          <button type="button" className={`btn btn-ghost btn-sm voice ${voice.listening ? 'on' : ''}`} onClick={voice.toggle} aria-pressed={voice.listening}>
            {voice.listening ? <><span className="dot" aria-hidden="true" /> Stop dictation</> : <>🎙 Dictate instead</>}
          </button>
        ) : <span />}
        <span className="counter" aria-live="off">{text.length} / {max}</span>
      </div>
      {q.voice && voice.supported && <p className="hint">Dictation uses your browser’s speech service. Typing always works.</p>}
      {voice.error && <p className="err" role="status">{voice.error}</p>}
    </>
  );
}

function SelectInput({ q, value, onChange, error, describedBy }: FieldProps) {
  return (
    <select id={`in-${q.id}`} className="select" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)} {...inputProps(q, error, describedBy)}>
      <option value="">Select…</option>
      {q.options!.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Choice({ q, value, onChange, multi, error, describedBy }: FieldProps & { multi: boolean }) {
  const name = useId();
  const selected: string[] = multi ? (Array.isArray(value) ? value : []) : typeof value === 'string' ? [value] : [];
  const ex = q.exclusiveOptions ?? [];
  const toggle = (o: string) => {
    if (!multi) return onChange(o);
    if (ex.includes(o)) return onChange(selected.includes(o) ? [] : [o]);
    const without = selected.filter((s) => !ex.includes(s));
    onChange(without.includes(o) ? without.filter((s) => s !== o) : [...without, o]);
  };
  return (
    <div className={`options ${q.options!.length > 5 ? 'cols' : ''}`} role={multi ? 'group' : 'radiogroup'} aria-labelledby={`lbl-${q.id}`} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      {q.options!.map((o) => (
        <label key={o} className="opt">
          <input type={multi ? 'checkbox' : 'radio'} name={name} checked={selected.includes(o)} onChange={() => toggle(o)} />
          <span className="box"><span className={`mark ${multi ? 'check' : 'radio'}`}><Check size={13} /></span>{o}</span>
        </label>
      ))}
    </div>
  );
}

function Rating({ q, value, onChange, error, describedBy }: FieldProps) {
  const name = useId();
  return (
    <div>
      <div className="rating" role="radiogroup" aria-labelledby={`lbl-${q.id}`} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="opt">
            <input type="radio" name={name} checked={value === n} onChange={() => onChange(n)} aria-label={`${n} of 5${n === 1 ? ` — ${q.scale?.low ?? ''}` : n === 5 ? ` — ${q.scale?.high ?? ''}` : ''}`} />
            <span className="box">{n}</span>
          </label>
        ))}
      </div>
      <div className="rating-ends" aria-hidden="true"><span>1 · {q.scale?.low ?? 'Low'}</span><span>5 · {q.scale?.high ?? 'High'}</span></div>
    </div>
  );
}

function Ranking({ q, value, onChange, error, describedBy }: FieldProps) {
  const n = q.rankCount ?? q.options!.length;
  const picked: string[] = Array.isArray(value) ? value : [];
  const [announce, setAnnounce] = useState('');
  const add = (o: string) => { if (picked.length < n) { onChange([...picked, o]); setAnnounce(`${o} added as priority ${picked.length + 1}`); } };
  const remove = (o: string) => { onChange(picked.filter((p) => p !== o)); setAnnounce(`${o} removed`); };
  const move = (i: number, d: -1 | 1) => {
    const next = [...picked];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
    setAnnounce(`${next[i + d]} moved to priority ${i + d + 1}`);
  };
  return (
    <div className="rank" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <p className="hint" id={`rk-${q.id}`}>{picked.length} of {n} chosen. Select an outcome to add it; use the arrows to reorder.</p>
      {picked.length > 0 && (
        <ol className="rank-picked" aria-label="Your priorities in order">
          {picked.map((o, i) => (
            <li key={o}>
              <span className="n">{i + 1}</span><span className="t">{o}</span>
              <button type="button" className="iconbtn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${o} up`}>↑</button>
              <button type="button" className="iconbtn" onClick={() => move(i, 1)} disabled={i === picked.length - 1} aria-label={`Move ${o} down`}>↓</button>
              <button type="button" className="iconbtn" onClick={() => remove(o)} aria-label={`Remove ${o}`}>✕</button>
            </li>
          ))}
        </ol>
      )}
      <div className="options cols" role="group" aria-labelledby={`lbl-${q.id}`}>
        {q.options!.filter((o) => !picked.includes(o)).map((o) => (
          <button key={o} type="button" className="opt" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => add(o)} disabled={picked.length >= n}>
            <span className="box" style={picked.length >= n ? { opacity: 0.5 } : undefined}>＋ {o}</span>
          </button>
        ))}
      </div>
      <div className="sr-only" aria-live="polite">{announce}</div>
    </div>
  );
}
