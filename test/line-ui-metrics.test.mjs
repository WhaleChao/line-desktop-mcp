import assert from 'node:assert/strict';
import test from 'node:test';
import { callCuaTool, snapshot } from '../src/extensions/cua-line-client.mjs';
import { countLineUiMetric, startLineUiPhase, withLineUiMetrics } from '../src/extensions/line-ui-metrics.mjs';

test('disabled metrics preserve the result and do not add diagnostics', async () => {
  const expected = { success: true };
  const result = await withLineUiMetrics(async () => {
    startLineUiPhase('snapshot')();
    return expected;
  }, { enabled: false });
  assert.equal(result, expected);
});

test('metrics count snapshots and requested images without retaining arguments or UI text', async () => {
  const privateText = 'private multiline\n中文🙂';
  const api = { async call() { return { elements: [{ value: privateText }] }; } };
  const result = await withLineUiMetrics(async () => {
    await snapshot(api, { pid: 42, window_id: 99 });
    await snapshot(api, { pid: 42, window_id: 99 }, { screenshot: true });
    startLineUiPhase(privateText)();
    countLineUiMetric(privateText);
    return { success: true };
  }, { enabled: true });
  assert.equal(result.uiMetrics.phases.snapshot.calls, 2);
  assert.equal(result.uiMetrics.screenshotRequests, 1);
  assert.ok(result.uiMetrics.totalMs >= 0);
  assert.equal(JSON.stringify(result.uiMetrics).includes(privateText), false);
  assert.equal(JSON.stringify(result.uiMetrics).includes('window_id'), false);
});

test('a failed input retains its uncertainty, is counted once and is never retried', async () => {
  let calls = 0;
  const client = { async callTool() { calls++; throw Error('private transport text'); } };
  await assert.rejects(withLineUiMetrics(() =>
    callCuaTool(client, 'set_value', { value: 'private input' }), { enabled: true }), error => {
    assert.equal(error.code, 'LINE_UI_ACTION_UNCERTAIN');
    assert.equal(error.operationMayHaveCompleted, true);
    assert.equal(error.details.uiMetrics.phases.cuaCall.calls, 1);
    assert.equal(JSON.stringify(error.details.uiMetrics).includes('private'), false);
    return true;
  });
  assert.equal(calls, 1);
});

test('concurrent operations keep separate counters and finishing a phase twice cannot inflate timing', async () => {
  const run = count => withLineUiMetrics(async () => {
    for (let i = 0; i < count; i++) {
      const stop = startLineUiPhase('ocr');
      countLineUiMetric('processStartAttempts');
      await Promise.resolve();
      stop();
      stop();
    }
    return { success: true };
  }, { enabled: true });
  const [one, three] = await Promise.all([run(1), run(3)]);
  assert.equal(one.uiMetrics.phases.ocr.calls, 1);
  assert.equal(three.uiMetrics.phases.ocr.calls, 3);
  assert.equal(one.uiMetrics.processStartAttempts, 1);
  assert.equal(three.uiMetrics.processStartAttempts, 3);
});
