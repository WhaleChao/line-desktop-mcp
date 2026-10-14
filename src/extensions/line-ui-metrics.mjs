import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

const context = new AsyncLocalStorage();
const PHASES = new Set(['cuaConnect', 'cuaTools', 'cuaCall', 'cuaClose', 'snapshot', 'ocr', 'fingerprint']);
const COUNTERS = new Set(['processStartAttempts', 'screenshotRequests']);
const round = value => Math.round(value * 100) / 100;

/** Opt-in, operation-local numbers only. No arguments, text, image or file logs. */
export async function withLineUiMetrics(fn, { enabled = process.env.LINE_MCP_UI_METRICS === '1' } = {}) {
  if (!enabled) return fn();
  const metrics = { phases: {}, processStartAttempts: 0, screenshotRequests: 0 };
  const started = performance.now();
  const summarize = () => ({
    totalMs: round(performance.now() - started),
    ...metrics,
    phases: Object.fromEntries(Object.entries(metrics.phases).map(([key, value]) =>
      [key, { calls: value.calls, ms: round(value.ms) }])),
  });
  return context.run(metrics, async () => {
    try {
      const result = await fn();
      return result && typeof result === 'object' && !Array.isArray(result)
        ? { ...result, uiMetrics: summarize() } : result;
    } catch (error) {
      // Diagnostics must preserve the same failure and its uncertainty flags.
      try { error.details = { ...error.details, uiMetrics: summarize() }; } catch {}
      throw error;
    }
  });
}

export function startLineUiPhase(name) {
  const metrics = context.getStore();
  if (!metrics || !PHASES.has(name)) return () => {};
  const phase = metrics.phases[name] ??= { calls: 0, ms: 0 };
  phase.calls++;
  const started = performance.now();
  let finished = false;
  return () => {
    if (!finished) phase.ms += performance.now() - started;
    finished = true;
  };
}

export function countLineUiMetric(name) {
  const metrics = context.getStore();
  if (metrics && COUNTERS.has(name)) metrics[name]++;
}
