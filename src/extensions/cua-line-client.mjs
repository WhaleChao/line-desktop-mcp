import fs from 'node:fs';
import { configuredCuaDriverPath, LineToolError, runtimeImport, runtimeRequire } from './line-runtime.mjs';

const CUA_INPUT_TOOLS = new Set([
  'click', 'double_click', 'right_click', 'drag', 'scroll', 'move_cursor',
  'type_text', 'press_key', 'hotkey', 'set_value', 'clipboard_write', 'clipboard_clear',
  'mouse_down', 'mouse_up', 'key_down', 'key_up',
  'set_window_frame', 'invoke_menu', 'launch_app', 'start_session', 'end_session', 'desktop_action',
]);

/** Existing CUA runtime, used over its public stdio MCP protocol. No daemon,
 * installer, permission-mode override, recording, or private pipe protocol. */
export async function withCuaClient(callback, { deadline } = {}) {
  const remaining = maximum => {
    const value = deadline === undefined ? maximum : Math.min(maximum, deadline - Date.now());
    if(value <= 0) throw new LineToolError('LINE_SEND_TIMEOUT', 'LINE operation reached its deadline.');
    return value;
  };
  const driverPath = requireConfiguredCuaDriver();
  const [{ Client }, { StdioClientTransport }, { AjvJsonSchemaValidator }] = await Promise.all([
    runtimeImport('@modelcontextprotocol/sdk/client/index.js'),
    runtimeImport('@modelcontextprotocol/sdk/client/stdio.js'),
    runtimeImport('@modelcontextprotocol/sdk/validation/ajv'),
  ]);
  const ajv = createCuaAjv();
  const client = new Client({ name: 'line-desktop-ui-adapter', version: '1.0.0' }, { jsonSchemaValidator: new AjvJsonSchemaValidator(ajv) });
  const transport = new StdioClientTransport({ command: driverPath, args: ['mcp'], stderr: 'pipe' });
  // Drain diagnostic output without writing possible UI content into a log.
  transport.stderr?.on('data', () => {});
  let connected = false;
  let failure;
  let inputAttempted = false;
  try {
    await client.connect(transport, { timeout: remaining(20000) });
    connected = true;
    const listed = await client.listTools({}, {timeout:remaining(20000)});
    const inputValidator = createCuaInputValidator(listed?.tools, { ajv });
    const tools = inputValidator.tools;
    const api = {
      tools,
      serverVersion: client.getServerVersion(),
      async call(name, args) {
        if (!tools.has(name)) throw new LineToolError('LINE_UI_CAPABILITY_UNAVAILABLE', `The active CUA runtime does not advertise ${name}.`);
        inputValidator.validate(name, args);
        if (CUA_INPUT_TOOLS.has(name)) inputAttempted = true;
        const result = await callCuaTool(client, name, args, {timeout:remaining(25000)});
        const data = unwrapCua(result);
        if (result.isError) {
          throw new LineToolError('LINE_UI_ACTION_REFUSED', `CUA ${name}: ${data.message || data.error || data.code || 'operation refused'}`, {
            backendCode: data.code ?? null,
            escalation: data.escalation ?? null,
            // Never replay an input merely because its acknowledgment failed.
            operationMayHaveCompleted: !['list_windows', 'get_window_state', 'get_config'].includes(name),
          });
        }
        return { ...data, images: (result.content || []).filter(item => item.type === 'image') };
      },
    };
    return await callback(api);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    // Closing the public transport ends this operation's CUA control session.
    await closeCuaSession(() => connected ? client.close() : transport.close(), { failure, inputAttempted });
  }
}

/**
 * Validate the optional driver only at the UI-operation boundary. The
 * injectable filesystem is for deterministic tests; withCuaClient always
 * obtains its path from LINE_MCP_CUA_DRIVER.
 */
export function requireConfiguredCuaDriver({
  configuredPath = configuredCuaDriverPath(),
  fileSystem = fs,
} = {}) {
  const driverPath = configuredCuaDriverPath(configuredPath);
  if (!driverPath) {
    throw new LineToolError(
      'LINE_UI_BACKEND_UNAVAILABLE',
      'LINE_MCP_CUA_DRIVER must name an absolute CUA Driver executable before a LINE UI operation can run.',
    );
  }
  try {
    if (!fileSystem.statSync(driverPath).isFile()) throw new Error('not a regular file');
  } catch {
    throw new LineToolError(
      'LINE_UI_BACKEND_UNAVAILABLE',
      'LINE_MCP_CUA_DRIVER must name an existing regular CUA Driver executable before a LINE UI operation can run.',
    );
  }
  return driverPath;
}

export async function closeCuaSession(close, { failure, inputAttempted = false } = {}) {
  try { await close(); }
  catch {
    if (failure) {
      // Preserve the original operation error, including its uncertainty flag.
      try { failure.details = { ...failure.details, sessionCleanupFailed: true }; } catch {}
      return;
    }
    throw new LineToolError('LINE_UI_SESSION_CLOSE_FAILED', 'The LINE UI operation ended, but its control session could not be confirmed closed. Inspect the result before retrying.', { operationMayHaveCompleted: inputAttempted, sessionCleanupFailed: true });
  }
}

/**
 * A rejected MCP request has no trustworthy completion signal. Treat input
 * operations as possibly completed, while reads can safely report failure.
 * The fixed errors intentionally omit transport/backend text and arguments.
 */
export async function callCuaTool(client, name, args, {timeout=25000} = {}) {
  try {
    return await client.callTool({ name, arguments: args }, undefined, { timeout });
  } catch {
    if (isCuaInputTool(name)) {
      throw new LineToolError(
        'LINE_UI_ACTION_UNCERTAIN',
        `CUA ${name} lost its completion response. Inspect fresh UI state before deciding whether to retry.`,
        { operationMayHaveCompleted: true },
      );
    }
    throw new LineToolError(
      'LINE_UI_ACTION_FAILED',
      `CUA ${name} could not complete.`,
      { operationMayHaveCompleted: false },
    );
  }
}

function isCuaInputTool(name) {
  return CUA_INPUT_TOOLS.has(name);
}

/**
 * Build input validators from the runtime's current listTools descriptors.
 * Schemas are compiled only when their named tool is first called, keeping
 * connection setup read-only and avoiding a hard-coded CUA action schema.
 */
export function createCuaInputValidator(toolDescriptors, { ajv = createCuaAjv() } = {}) {
  if (!Array.isArray(toolDescriptors)) {
    throw new LineToolError('LINE_UI_BACKEND_PROTOCOL', 'CUA did not return a tools array with input schemas.');
  }
  if (!ajv || typeof ajv.compile !== 'function') {
    throw new TypeError('ajv must provide compile(schema).');
  }

  const descriptors = new Map();
  for (const descriptor of toolDescriptors) {
    if (!descriptor || typeof descriptor.name !== 'string' || !descriptor.name || descriptor.inputSchema === undefined) {
      throw new LineToolError('LINE_UI_BACKEND_PROTOCOL', 'CUA advertised an invalid tool descriptor.');
    }
    if (descriptors.has(descriptor.name)) {
      throw new LineToolError('LINE_UI_BACKEND_PROTOCOL', `CUA advertised duplicate tool name ${descriptor.name}.`);
    }
    descriptors.set(descriptor.name, descriptor);
  }

  const validators = new Map();
  return {
    tools: new Set(descriptors.keys()),
    validate(name, args) {
      const descriptor = descriptors.get(name);
      if (!descriptor) {
        throw new LineToolError('LINE_UI_CAPABILITY_UNAVAILABLE', `The active CUA runtime does not advertise ${name}.`);
      }
      let validate = validators.get(name);
      if (!validate) {
        try {
          validate = ajv.compile(descriptor.inputSchema);
        } catch {
          throw new LineToolError('LINE_UI_BACKEND_PROTOCOL', `CUA ${name} advertised an input schema that could not be validated.`);
        }
        validators.set(name, validate);
      }
      if (validate(args)) return;
      throw new LineToolError(
        'LINE_UI_INVALID_ARGUMENT',
        `CUA ${name} arguments do not match the active runtime schema.`,
        { schemaIssueCount: Array.isArray(validate.errors) ? validate.errors.length : 0 },
      );
    },
  };
}

function createCuaAjv() {
  const Ajv = runtimeRequire()('ajv');
  const ajv = new Ajv({ strict: false, validateFormats: true, validateSchema: false, allErrors: true });
  runtimeRequire()('ajv-formats')(ajv);
  ajv.addFormat('uint32', { type: 'number', validate: n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff });
  ajv.addFormat('uint64', { type: 'number', validate: n => Number.isSafeInteger(n) && n >= 0 });
  return ajv;
}

export function unwrapCua(result) {
  const text = (result?.content || []).filter(item => item.type === 'text').map(item => item.text).join('\n');
  const structured = result?.structuredContent;
  if (structured && typeof structured === 'object' && !result.isError) return structured;
  try { return { ...structured, ...JSON.parse(text) }; } catch { return { ...structured, message: text }; }
}

export async function lineWindows(api) {
  const response = await api.call('list_windows', {});
  const windows = response.windows;
  if (!Array.isArray(windows)) throw new LineToolError('LINE_UI_BACKEND_PROTOCOL', 'CUA did not return a windows array.');
  return windows.filter(window => /^(LINE|LINE\.exe)$/i.test(window.app_name || ''));
}

export async function mainLineWindow(api) {
  const windows = await lineWindows(api);
  const matches = windows.filter(window => window.title === 'LINE' && !window.minimized && window.is_on_screen);
  if (matches.length !== 1) throw new LineToolError('LINE_TARGET_NOT_UNIQUE', `Expected one visible LINE main window, found ${matches.length}. Open/unminimize LINE and resolve duplicate main windows.`, { candidateCount: matches.length });
  return matches[0];
}

export async function snapshot(api, target, { screenshot = false, query, maxElements = 800 } = {}) {
  const result = await api.call('get_window_state', {
    pid: target.pid, window_id: target.window_id,
    include_screenshot: screenshot, max_elements: maxElements, max_depth: 25,
    ...(query ? { query } : {}),
  });
  if (!Array.isArray(result.elements)) throw new LineToolError('LINE_UI_TREE_UNAVAILABLE', 'LINE did not expose a structured accessibility tree. Continue using visual Computer Use.');
  return result;
}

export function elementTarget(target, state, element) {
  if (element.enabled === false) throw new LineToolError('LINE_CONTROL_DISABLED', 'The requested LINE control is disabled.');
  const ref = element.element_token
    ? { element_token: element.element_token }
    : { element_index: element.element_index, snapshot_id: state.snapshot_id };
  if (!element.element_token && (!Number.isInteger(element.element_index) || !state.snapshot_id)) {
    throw new LineToolError('LINE_UI_REFERENCE_INVALID', 'CUA did not return a snapshot-bound reference.');
  }
  return { pid: target.pid, window_id: target.window_id, ...ref };
}

export function uniqueElement(state, predicate, label) {
  const matches = state.elements.filter(predicate);
  if (matches.length !== 1) throw new LineToolError('LINE_CONTROL_NOT_UNIQUE', `${label}: expected one accessible control, found ${matches.length}. Use a fresh visual observation instead of guessing.`, { candidateCount: matches.length });
  return matches[0];
}

export function exactLabel(labels, roles) {
  return item => labels.includes(item.label) && (!roles || roles.some(role => String(item.role).toLowerCase().includes(role.toLowerCase())));
}
