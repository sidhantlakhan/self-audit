import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Answer, Answers, AssessmentConfig, Question } from '../../shared/types.ts';
import { completionPercentage, isEmpty, validateAnswer, validateQuestions } from '../../shared/validation.ts';
import { api, ApiError } from './api.ts';
import { forgetToken, getToken, readPending, saveToken, writePending } from './storage.ts';
import { readAttribution } from './attribution.ts';
import type { QDef } from '../components/fields.tsx';

export interface PublicConfig { version: string; phases: { number: number; title: string; intro: string }[]; questions: QDef[] }
export interface SessionState {
  id: string; status: string; locked: boolean; currentPhase: number; completedPhases: number[]; completionPercentage: number;
  analysisStatus: string; reportStatus: string; consultationStatus: string; answers: Answers; config: PublicConfig;
}
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type Load = 'loading' | 'ready' | 'invalid' | 'no-token' | 'error';

const DEBOUNCE_MS = 800;

/** Adapts the public configuration (string options) to the shared validation types. */
export function toConfig(c: PublicConfig): AssessmentConfig {
  const questions = c.questions.map((q) => ({ ...q, options: q.options?.map((value) => ({ value })), dimension: 'context', weight: 1, scored: false, aiRelevant: false, opportunityRelevant: false, version: c.version })) as unknown as Question[];
  return { version: c.version, scoringVersion: '', phases: [], dimensions: [], bands: [], questions };
}

export function consumeHashToken(id: string) {
  if (typeof location === 'undefined') return;
  const m = /^#t=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (m) {
    saveToken(id, m[1]);
    history.replaceState(null, '', location.pathname + location.search); // keep the secret out of the address bar and history
  }
}

export function useAssessmentSession(id: string) {
  const [load, setLoad] = useState<Load>('loading');
  const [state, setState] = useState<SessionState | null>(null);
  const [answers, setAnswersState] = useState<Answers>({});
  const [save, setSave] = useState<SaveStatus>('idle');
  const [pct, setPct] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const dirty = useRef<Record<string, Answer>>({});
  const answersRef = useRef<Answers>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);
  const inflight = useRef<Promise<boolean> | null>(null);
  const phaseRef = useRef(1);
  const tokenRef = useRef<string | null>(null);
  const cfgRef = useRef<AssessmentConfig | null>(null);

  const cfg = useMemo(() => (state ? toConfig(state.config) : null), [state]);
  cfgRef.current = cfg;

  // ── Load ──
  useEffect(() => {
    let cancelled = false;
    consumeHashToken(id);
    const token = getToken(id);
    tokenRef.current = token;
    if (!token) { setLoad('no-token'); return; }
    setLoad('loading');
    api<SessionState>(`/api/assessments/${id}`, { token })
      .then((s) => {
        if (cancelled) return;
        const pending = readPending(id) as Record<string, Answer>;
        const merged = s.locked ? s.answers : { ...s.answers, ...pending };
        if (!s.locked) dirty.current = { ...pending };
        answersRef.current = merged;
        phaseRef.current = s.currentPhase;
        setState(s);
        setAnswersState(merged);
        setPct(s.completionPercentage);
        setLoad('ready');
        // Attribution: record a newer marketing touch if the visitor came back through a different link.
        const a = readAttribution();
        if (a && Object.keys(a.latestTouch).length) void api(`/api/assessments/${id}`, { method: 'PATCH', token, body: { latestTouch: a.latestTouch, referrer: a.referrer } }).catch(() => undefined);
        if (Object.keys(dirty.current).length) schedule(0);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) { forgetToken(id); setLoad('invalid'); }
        else setLoad('error');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reloadKey]);

  // ── Autosave ──
  const doFlush = useCallback(async (opts: { keepalive?: boolean } = {}): Promise<boolean> => {
    if (inflight.current) { await inflight.current.catch(() => undefined); }
    const snapshot = { ...dirty.current };
    if (!Object.keys(snapshot).length) { return true; }
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setSave('saving');
    const run = (async () => {
      try {
        const r = await api<{ completionPercentage: number }>(`/api/assessments/${id}/responses`, { method: 'POST', token: tokenRef.current, keepalive: opts.keepalive, body: { answers: snapshot, currentPhase: phaseRef.current } });
        for (const [k, v] of Object.entries(snapshot)) if (JSON.stringify(dirty.current[k]) === JSON.stringify(v)) delete dirty.current[k];
        writePending(id, dirty.current);
        retries.current = 0;
        setPct(r.completionPercentage);
        setSave(Object.keys(dirty.current).length ? 'saving' : 'saved');
        if (Object.keys(dirty.current).length) schedule(DEBOUNCE_MS);
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) { setLoad('invalid'); return false; }
        if (e instanceof ApiError && e.status === 409) { setSave('idle'); setState((s) => (s ? { ...s, locked: true } : s)); return false; }
        if (e instanceof ApiError && e.status === 422 && e.details) {
          // A value the server will never accept: drop it so autosave does not loop; phase completion will surface it.
          for (const k of Object.keys(e.details)) delete dirty.current[k];
          writePending(id, dirty.current);
        }
        setSave('error');
        const delay = Math.min(30_000, 3000 * 2 ** retries.current++);
        if (retry.current) clearTimeout(retry.current);
        retry.current = setTimeout(() => { void doFlush(); }, delay);
        return false;
      }
    })();
    inflight.current = run;
    try { return await run; } finally { if (inflight.current === run) inflight.current = null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function schedule(ms: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void doFlush(); }, ms);
  }

  const setAnswer = useCallback((qid: string, value: Answer) => {
    answersRef.current = { ...answersRef.current, [qid]: value };
    setAnswersState(answersRef.current);
    const q = cfgRef.current?.questions.find((x) => x.id === qid);
    // Half-typed phone numbers and emails are held locally and only saved once they are valid.
    if (q && (q.type === 'phone' || q.type === 'email') && !isEmpty(value) && validateAnswer(q, value) !== null) return;
    dirty.current[qid] = isEmpty(value) ? null : value;
    writePending(id, dirty.current);
    setSave('saving');
    schedule(DEBOUNCE_MS);
  }, [id]);

  const retryNow = useCallback(() => { retries.current = 0; void doFlush(); }, [doFlush]);

  // Final-save guarantees: leaving the page, backgrounding the tab, and regaining connectivity.
  useEffect(() => {
    const leave = () => { if (Object.keys(dirty.current).length) void doFlush({ keepalive: true }); };
    const vis = () => { if (document.visibilityState === 'hidden') leave(); };
    const online = () => { if (Object.keys(dirty.current).length) retryNow(); };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('online', online);
      if (timer.current) clearTimeout(timer.current);
      if (retry.current) clearTimeout(retry.current);
      leave();
    };
  }, [doFlush, retryNow]);

  const setCurrentPhase = useCallback((p: number) => { phaseRef.current = p; }, []);

  const completePhase = useCallback(async (phase: number): Promise<{ ok: true } | { ok: false; network?: boolean; errors?: Record<string, string>; message?: string }> => {
    const saved = await doFlush();
    if (!saved) return { ok: false, network: true };
    try {
      await api(`/api/assessments/${id}/phase-complete`, { method: 'POST', token: tokenRef.current, body: { phase } });
      setState((s) => (s ? { ...s, completedPhases: [...new Set([...s.completedPhases, phase])] } : s));
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiError) return { ok: false, network: e.isNetwork, errors: e.details, message: e.message };
      return { ok: false };
    }
  }, [doFlush, id]);

  const completeAssessment = useCallback(async (): Promise<{ ok: true } | { ok: false; network?: boolean; errors?: Record<string, string>; message?: string }> => {
    const saved = await doFlush();
    if (!saved) return { ok: false, network: true };
    try {
      await api(`/api/assessments/${id}/complete`, { method: 'POST', token: tokenRef.current });
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiError) return { ok: false, network: e.isNetwork, errors: e.details, message: e.message };
      return { ok: false };
    }
  }, [doFlush, id]);

  const phaseErrors = useCallback((phase: number) => (cfg ? validateQuestions(cfg.questions.filter((q) => q.phase === phase), answersRef.current) : {}), [cfg]);
  const allErrors = useCallback(() => (cfg ? validateQuestions(cfg.questions, answersRef.current) : {}), [cfg]);
  const livePct = cfg ? Math.max(pct, completionPercentage(cfg, answers)) : pct;

  return { load, state, cfg, answers, save, pct: livePct, token: tokenRef.current, setAnswer, flush: doFlush, retryNow, setCurrentPhase, completePhase, completeAssessment, phaseErrors, allErrors, reload: () => setReloadKey((k) => k + 1) };
}

export type Session = ReturnType<typeof useAssessmentSession>;
