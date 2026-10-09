import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const requiredEnvironment = [
  'AGENT_DEVICE_VERSION',
  'APP_BUNDLE_ID',
  'APP_CACHE_KEY',
  'APP_PATH',
  'APP_PUBLIC_SHA',
  'APP_REVISION_SHA',
  'GITHUB_RUN_ID',
  'QA_ARTIFACT_DIR',
  'QA_WORKFLOW_SHA',
  'SOURCE_SHA_VERIFIED',
  'SIMULATOR_DEVICE',
  'SYNC_COMMIT',
];

const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
const outputDirectory = path.resolve(process.env.QA_ARTIFACT_DIR || process.cwd());
const screenshotDirectory = path.join(outputDirectory, 'screenshots');
const videoDirectory = path.join(outputDirectory, 'video');
const sessionName = `rigatti-qa-${process.env.GITHUB_RUN_ID || 'local'}`;
const simulatorBootTimeoutMs = 600_000;
const simulatorDiagnosticTimeoutMs = 30_000;
const simulatorInstallTimeoutMs = 300_000;
const maxDiagnosticTextLength = 6_000;
const expectedMode = {
  wholesale: {
    homeLabel: 'Alterar modo. Modo atual: Atacado',
  },
  retail: {
    homeLabel: 'Alterar modo. Modo atual: Varejo',
  },
};

const report = {
  schemaVersion: 1,
  status: 'failed',
  startedAt: new Date().toISOString(),
  finishedAt: null,
  runId: process.env.GITHUB_RUN_ID || null,
  testWorkflowSha: process.env.QA_WORKFLOW_SHA || null,
  app: {
    bundleId: process.env.APP_BUNDLE_ID || null,
    publicSyncCommit: process.env.APP_PUBLIC_SHA || null,
    sourceRepository: 'LuanRigatti/emporiorigatti',
    appRevisionSha: process.env.APP_REVISION_SHA || null,
    sourceShaVerified: process.env.SOURCE_SHA_VERIFIED || null,
    syncCommit: process.env.SYNC_COMMIT || null,
    cacheKey: process.env.APP_CACHE_KEY || null,
  },
  dataSafety: {
    publicArtifact: true,
    syntheticTestDataConfirmed: process.env.PUBLIC_EVIDENCE_SYNTHETIC_ONLY === 'true',
    cachedQuickLoginConfigConfirmed: process.env.CACHED_QUICK_LOGIN_CURRENT === 'true',
    confirmationMechanism: 'workflow_dispatch operator attestation',
  },
  device: {
    platform: 'ios',
    simulator: process.env.SIMULATOR_DEVICE || null,
    agentDeviceVersion: process.env.AGENT_DEVICE_VERSION || null,
    controlTransport: 'local simulator; no tunnel or remote proxy',
  },
  actions: [],
  errors: [],
  cleanupErrors: [],
  evidence: [],
};

let simulatorUdid = null;
let agentDeviceSessionReady = false;
let appSessionOpened = false;
let recordingStarted = false;
let failedStep = null;

class QaStepError extends Error {
  constructor(step, message, bootFailure = null) {
    super(message);
    this.step = step;
    this.bootFailure = bootFailure;
  }
}

function sanitizeDiagnosticText(value) {
  return String(value || '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
      '[redacted-private-key]',
    )
    .replace(/\b(Bearer|Basic)\s+[^\s,;]+/gi, '$1 [redacted]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[redacted-url]')
    .replace(
      /\b(?:gh[pousr]_|github_pat_|AIza|ya29\.|AKIA|sk-)[A-Za-z0-9._-]{12,}\b/g,
      '[redacted-token]',
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/g,
      '[redacted-token]',
    )
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
    .replace(
      /((?:access[_ -]?token|refresh[_ -]?token|token|password|secret|api[_ -]?key|authorization|cookie|credential)\s*(?:=|:)\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[redacted]',
    )
    .replace(/([?&](?:k|token|access_token|auth|key|secret)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, '[redacted-id]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted-opaque-value]')
    .replace(/\/Users\/[^/\s]+/g, '/Users/[redacted]')
    .replace(/C:\\Users\\[^\\\s]+/gi, 'C:\\Users\\[redacted]')
    .slice(-maxDiagnosticTextLength);
}

function captureCommand(command, args, timeout = simulatorBootTimeoutMs) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout,
    windowsHide: true,
  });

  return {
    status: result.status,
    signal: result.signal || null,
    errorCode: result.error?.code || null,
    elapsedMs: Date.now() - startedAt,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function safeCommandResult(command, timeoutMs, result, includeOutput = true) {
  return {
    command,
    timeoutMs,
    elapsedMs: result.elapsedMs,
    exitCode: result.status,
    signal: result.signal,
    errorCode: result.errorCode,
    stdout: includeOutput ? sanitizeDiagnosticText(result.stdout) : '',
    stderr: includeOutput ? sanitizeDiagnosticText(result.stderr) : '',
  };
}

function runAgentDevice(step, args, timeout = 120_000, captureBootFailure = false) {
  const startedAt = Date.now();
  const result = spawnSync('agent-device', ['--session', sessionName, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout,
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    const reason = result.error?.code || `exit-${result.status ?? result.signal ?? 'unknown'}`;
    const bootFailure = captureBootFailure
      ? safeCommandResult('agent-device boot', timeout, {
          status: result.status,
          signal: result.signal,
          errorCode: result.error?.code || null,
          elapsedMs: Date.now() - startedAt,
          stdout: result.stdout,
          stderr: result.stderr,
        })
      : null;
    throw new QaStepError(step, `agent-device failed (${reason}).`, bootFailure);
  }

  return result.stdout.trim();
}

function normalizeDeviceName(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function listAvailableIosSimulators() {
  const result = captureCommand(
    'xcrun',
    ['simctl', 'list', 'devices', 'available', '--json'],
    60_000,
  );
  if (result.errorCode || result.status !== 0) {
    throw new QaStepError(
      'boot_fresh_ios_simulator',
      'Could not enumerate available iOS simulators before boot.',
      safeCommandResult('xcrun simctl list devices available --json', 60_000, result),
    );
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new QaStepError(
      'boot_fresh_ios_simulator',
      'Simulator inventory returned invalid JSON.',
      safeCommandResult('xcrun simctl list devices available --json', 60_000, result),
    );
  }

  const requestedName = normalizeDeviceName(process.env.SIMULATOR_DEVICE);
  const candidates = Object.entries(payload.devices || {})
    .filter(([runtime]) => /^com\.apple\.coresimulator\.simruntime\.ios-/i.test(runtime))
    .flatMap(([runtime, devices], runtimeIndex) =>
      (Array.isArray(devices) ? devices : []).map((device, deviceIndex) => ({
        runtime,
        runtimeIndex,
        deviceIndex,
        device,
      })),
    )
    .filter(
      ({ device }) =>
        device?.isAvailable === true &&
        typeof device.udid === 'string' &&
        normalizeDeviceName(device.name) === requestedName,
    )
    .sort(
      (left, right) =>
        Number(right.device.state === 'Booted') - Number(left.device.state === 'Booted') ||
        String(left.device.name).localeCompare(String(right.device.name)) ||
        left.runtimeIndex - right.runtimeIndex ||
        left.deviceIndex - right.deviceIndex,
    );

  if (candidates.length === 0) {
    throw new QaStepError(
      'boot_fresh_ios_simulator',
      'No available iOS simulator matched the requested device name.',
    );
  }

  return candidates[0].device;
}

function readSimulatorBootDiagnostics(failure) {
  const xcodeResult = captureCommand('xcodebuild', ['-version'], simulatorDiagnosticTimeoutMs);
  const xcodeText = `${xcodeResult.stdout}\n${xcodeResult.stderr}`;
  const xcodeVersion = xcodeText
    .split(/\r?\n/)
    .filter((line) =>
      /^(Xcode\s+|Build version\s+|ProductName:|ProductVersion:|BuildVersion:)/i.test(line.trim()),
    )
    .map((line) => sanitizeDiagnosticText(line.trim()));

  const runtimesResult = captureCommand(
    'xcrun',
    ['simctl', 'list', 'runtimes', '--json'],
    simulatorDiagnosticTimeoutMs,
  );
  let iosRuntimes = [];
  try {
    const payload = JSON.parse(runtimesResult.stdout);
    iosRuntimes = (payload.runtimes || [])
      .filter((runtime) => /\biOS\b/i.test(runtime.name || ''))
      .map((runtime) => ({
        name: sanitizeDiagnosticText(runtime.name),
        version: sanitizeDiagnosticText(runtime.version),
        available: runtime.isAvailable === true,
      }));
  } catch {
    // Keep only the command status below; malformed output is not copied to the artifact.
  }

  const devicesResult = captureCommand(
    'xcrun',
    ['simctl', 'list', 'devices', 'available', '--json'],
    simulatorDiagnosticTimeoutMs,
  );
  let iosDevices = [];
  try {
    const payload = JSON.parse(devicesResult.stdout);
    iosDevices = Object.entries(payload.devices || {})
      .filter(([runtime]) => /^com\.apple\.coresimulator\.simruntime\.ios-/i.test(runtime))
      .flatMap(([runtime, devices]) =>
        (Array.isArray(devices) ? devices : [])
          .filter((device) => device?.isAvailable === true)
          .map((device) => ({
            name: sanitizeDiagnosticText(device.name),
            runtime: sanitizeDiagnosticText(
              (payload.runtimes || []).find((item) => item.identifier === runtime)?.version ||
                runtime
                  .replace(/^com\.apple\.CoreSimulator\.SimRuntime\.iOS-/i, '')
                  .replaceAll('-', '.'),
            ),
            state: sanitizeDiagnosticText(device.state),
          })),
      );
  } catch {
    // Do not include raw inventory JSON because it contains simulator identifiers.
  }

  return {
    failure: {
      message: sanitizeDiagnosticText(failure?.message || 'Simulator initialization failed.'),
      command: failure?.bootFailure?.command || null,
      timeoutMs: failure?.bootFailure?.timeoutMs || null,
      elapsedMs: failure?.bootFailure?.elapsedMs || null,
      exitCode: failure?.bootFailure?.exitCode ?? null,
      signal: failure?.bootFailure?.signal || null,
      errorCode: failure?.bootFailure?.errorCode || null,
      stdout: failure?.bootFailure?.stdout || '',
      stderr: failure?.bootFailure?.stderr || '',
    },
    xcode: {
      version: xcodeVersion,
      command: safeCommandResult(
        'xcodebuild -version',
        simulatorDiagnosticTimeoutMs,
        xcodeResult,
        Boolean(xcodeResult.errorCode) || xcodeResult.status !== 0,
      ),
    },
    iosRuntimes: runtimesResult.status === 0 ? iosRuntimes : [],
    runtimesCommand: safeCommandResult(
      'xcrun simctl list runtimes --json',
      simulatorDiagnosticTimeoutMs,
      runtimesResult,
      Boolean(runtimesResult.errorCode) || runtimesResult.status !== 0,
    ),
    availableIosDevices: devicesResult.status === 0 ? iosDevices : [],
    devicesCommand: safeCommandResult(
      'xcrun simctl list devices available --json',
      simulatorDiagnosticTimeoutMs,
      devicesResult,
      Boolean(devicesResult.errorCode) || devicesResult.status !== 0,
    ),
  };
}

function bootFreshIosSimulator() {
  try {
    const device = listAvailableIosSimulators();
    simulatorUdid = device.udid;

    // agent-device 0.20.1 gives boot a 90s daemon envelope; its iOS boot work allows 180s.
    // Preboot outside that request, then let agent-device bind to the already-booted UDID.
    if (device.state !== 'Booted') {
      const bootResult = captureCommand('xcrun', ['simctl', 'boot', device.udid]);
      const alreadyBooted = /already booted|current state:\s*booted/i.test(
        `${bootResult.stdout}\n${bootResult.stderr}`,
      );
      if ((bootResult.errorCode || bootResult.status !== 0) && !alreadyBooted) {
        throw new QaStepError(
          'boot_fresh_ios_simulator',
          'xcrun simctl boot failed.',
          safeCommandResult('xcrun simctl boot', simulatorBootTimeoutMs, bootResult),
        );
      }
    }

    const bootStatus = captureCommand('xcrun', ['simctl', 'bootstatus', device.udid, '-b']);
    if (bootStatus.errorCode || bootStatus.status !== 0) {
      throw new QaStepError(
        'boot_fresh_ios_simulator',
        'xcrun simctl bootstatus failed.',
        safeCommandResult('xcrun simctl bootstatus -b', simulatorBootTimeoutMs, bootStatus),
      );
    }

    // agent-device opens Simulator after a cold boot; simctl preboot skips that path.
    captureCommand('open', ['-a', 'Simulator'], 15_000);

    runAgentDevice(
      'boot_fresh_ios_simulator',
      ['boot', '--platform', 'ios', '--udid', device.udid],
      simulatorBootTimeoutMs,
      true,
    );
    agentDeviceSessionReady = true;
  } catch (error) {
    const bootError =
      error instanceof QaStepError
        ? error
        : new QaStepError('boot_fresh_ios_simulator', 'Simulator initialization failed.');
    const diagnostics = readSimulatorBootDiagnostics(bootError.bootFailure);
    report.diagnostics = { simulatorBoot: diagnostics };
    console.error('NativeSim QA simulator boot diagnostics (sanitized):');
    console.error(JSON.stringify(report.diagnostics, null, 2));
    throw new QaStepError(
      'boot_fresh_ios_simulator',
      `${bootError.message} Sanitized diagnostics are attached to report.json.`,
    );
  }
}

function runStep(name, operation) {
  const startedAt = Date.now();

  try {
    operation();
    report.actions.push({ name, status: 'passed', durationMs: Date.now() - startedAt });
  } catch (error) {
    const safeError = error instanceof QaStepError ? error : new QaStepError(name, 'Step failed.');
    report.actions.push({
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      error: safeError.message,
    });
    failedStep = safeError.step || name;
    throw safeError;
  }
}

function captureEvidence(name, targetPath) {
  runStep(name, () => {
    runAgentDevice(name, ['screenshot', targetPath]);
    if (!existsSync(targetPath) || statSync(targetPath).size === 0) {
      throw new QaStepError(name, 'Screenshot file was not created.');
    }
  });
  report.evidence.push(path.relative(outputDirectory, targetPath).replaceAll(path.sep, '/'));
}

function verifyAgentDeviceVersion() {
  const result = spawnSync('agent-device', ['--version'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024,
    timeout: 15_000,
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    throw new QaStepError('verify_agent_device_version', 'Could not read agent-device version.');
  }

  const versionText = `${result.stdout || ''} ${result.stderr || ''}`;
  if (
    !new RegExp(`(?:^|\\D)${process.env.AGENT_DEVICE_VERSION.replaceAll('.', '\\.')}($|\\D)`).test(
      versionText,
    )
  ) {
    throw new QaStepError(
      'verify_agent_device_version',
      'Installed agent-device version does not match the pin.',
    );
  }
}

function writeReport() {
  report.status =
    failedStep === 'public_evidence_safety_confirmation'
      ? 'blocked'
      : report.errors.length === 0 && report.cleanupErrors.length === 0
        ? 'passed'
        : 'failed';
  report.failedStep = failedStep;
  report.finishedAt = new Date().toISOString();
  writeFileSync(
    path.join(outputDirectory, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}

function addCleanupError(step, error) {
  const safeError = error instanceof QaStepError ? error : new QaStepError(step, 'Cleanup failed.');
  report.cleanupErrors.push({ step, message: safeError.message });
  if (!failedStep) failedStep = step;
}

function installCachedAppOnSimulator() {
  if (!simulatorUdid || !agentDeviceSessionReady) {
    throw new QaStepError(
      'install_cached_app',
      'The selected simulator or its agent-device session is not ready.',
    );
  }

  const installResult = captureCommand(
    'xcrun',
    ['simctl', 'install', simulatorUdid, process.env.APP_PATH],
    simulatorInstallTimeoutMs,
  );
  const installDiagnostic = safeCommandResult(
    'xcrun simctl install <UDID> <APP_PATH>',
    simulatorInstallTimeoutMs,
    installResult,
  );
  report.diagnostics = {
    ...(report.diagnostics || {}),
    cachedAppInstall: { install: installDiagnostic },
  };

  if (installResult.errorCode || installResult.status !== 0) {
    const reason =
      installResult.errorCode ||
      `exit-${installResult.status ?? installResult.signal ?? 'unknown'}`;
    console.error('NativeSim QA app install diagnostics (sanitized):');
    console.error(JSON.stringify(report.diagnostics.cachedAppInstall, null, 2));
    throw new QaStepError(
      'install_cached_app',
      `simctl install failed (${reason}); sanitized diagnostics are attached to report.json.`,
    );
  }

  const verificationResult = captureCommand(
    'xcrun',
    ['simctl', 'get_app_container', simulatorUdid, process.env.APP_BUNDLE_ID, 'app'],
    simulatorDiagnosticTimeoutMs,
  );
  const bundleContainerReturned =
    verificationResult.status === 0 && Boolean(verificationResult.stdout.trim());
  const verificationDiagnostic = {
    ...safeCommandResult(
      'xcrun simctl get_app_container <UDID> <APP_BUNDLE_ID> app',
      simulatorDiagnosticTimeoutMs,
      verificationResult,
      false,
    ),
    bundleContainerReturned,
  };
  if (!bundleContainerReturned) {
    verificationDiagnostic.stderr = sanitizeDiagnosticText(verificationResult.stderr);
  }
  report.diagnostics.cachedAppInstall.verification = verificationDiagnostic;

  if (verificationResult.errorCode || verificationResult.status !== 0 || !bundleContainerReturned) {
    const reason =
      verificationResult.errorCode ||
      `exit-${verificationResult.status ?? verificationResult.signal ?? 'unknown'}`;
    console.error('NativeSim QA app install verification diagnostics (sanitized):');
    console.error(JSON.stringify(report.diagnostics.cachedAppInstall, null, 2));
    throw new QaStepError(
      'install_cached_app',
      `Installed bundle could not be verified on the selected simulator (${reason}).`,
    );
  }

  console.log(
    `Cached app installed and bundle verified on selected simulator; installMs=${installResult.elapsedMs}; verificationMs=${verificationResult.elapsedMs}.`,
  );
}

mkdirSync(screenshotDirectory, { recursive: true });
mkdirSync(videoDirectory, { recursive: true });

try {
  if (
    process.env.PUBLIC_EVIDENCE_SYNTHETIC_ONLY !== 'true' ||
    process.env.CACHED_QUICK_LOGIN_CURRENT !== 'true'
  ) {
    throw new QaStepError(
      'public_evidence_safety_confirmation',
      'QA requires confirmation that test data are fictitious and the cached app matches current Quick Login secrets.',
    );
  }

  if (missingEnvironment.length > 0) {
    throw new QaStepError(
      'preflight',
      `Missing required workflow metadata: ${missingEnvironment.join(', ')}.`,
    );
  }

  if (!/^[0-9a-f]{40}$/.test(process.env.SOURCE_SHA_VERIFIED)) {
    throw new QaStepError('preflight', 'The exact 40-character source commit was not verified.');
  }

  if (!existsSync(process.env.APP_PATH) || !process.env.APP_PATH.endsWith('.app')) {
    throw new QaStepError('preflight', 'The exact cached Simulator app is unavailable.');
  }

  runStep('verify_agent_device_version', verifyAgentDeviceVersion);

  runStep('boot_fresh_ios_simulator', bootFreshIosSimulator);

  runStep('install_cached_app', installCachedAppOnSimulator);

  runStep('open_app', () => {
    runAgentDevice('open_app', [
      'open',
      process.env.APP_BUNDLE_ID,
      '--platform',
      'ios',
      '--device',
      process.env.SIMULATOR_DEVICE,
      '--relaunch',
    ]);
    appSessionOpened = true;
  });

  runStep('wait_for_existing_quick_login_button', () => {
    runAgentDevice(
      'wait_for_existing_quick_login_button',
      ['wait', 'visible', 'label="Entrada rápida" role=button', '90000'],
      100_000,
    );
  });

  captureEvidence('capture_login_screen', path.join(screenshotDirectory, 'login.png'));

  runStep('start_short_video', () => {
    runAgentDevice('start_short_video', [
      'record',
      'start',
      path.join(videoDirectory, 'quick-login-and-mode-switch.mov'),
    ]);
    recordingStarted = true;
  });

  runStep('tap_existing_quick_login', () => {
    runAgentDevice('tap_existing_quick_login', ['press', 'label="Entrada rápida" role=button']);
  });

  runStep('confirm_authenticated_home_atacado', () => {
    runAgentDevice(
      'confirm_authenticated_home_atacado',
      ['wait', 'visible', `label="${expectedMode.wholesale.homeLabel}" role=button`, '120000'],
      130_000,
    );
  });

  captureEvidence('capture_atacado', path.join(screenshotDirectory, 'atacado.png'));

  runStep('open_sales_mode_selector_from_atacado', () => {
    runAgentDevice('open_sales_mode_selector_from_atacado', [
      'press',
      `label="${expectedMode.wholesale.homeLabel}" role=button`,
    ]);
    runAgentDevice('open_sales_mode_selector_from_atacado', [
      'wait',
      'visible',
      'label="Modo de venda"',
      '15000',
    ]);
  });

  runStep('select_varejo', () => {
    runAgentDevice('select_varejo', ['press', 'label="Varejo" role=button']);
    runAgentDevice(
      'select_varejo',
      ['wait', 'visible', `label="${expectedMode.retail.homeLabel}" role=button`, '60000'],
      70_000,
    );
  });

  captureEvidence('capture_varejo', path.join(screenshotDirectory, 'varejo.png'));

  runStep('open_sales_mode_selector_from_varejo', () => {
    runAgentDevice('open_sales_mode_selector_from_varejo', [
      'press',
      `label="${expectedMode.retail.homeLabel}" role=button`,
    ]);
    runAgentDevice('open_sales_mode_selector_from_varejo', [
      'wait',
      'visible',
      'label="Modo de venda"',
      '15000',
    ]);
  });

  runStep('select_atacado_again', () => {
    runAgentDevice('select_atacado_again', ['press', 'label="Atacado" role=button']);
    runAgentDevice(
      'select_atacado_again',
      ['wait', 'visible', `label="${expectedMode.wholesale.homeLabel}" role=button`, '60000'],
      70_000,
    );
  });

  captureEvidence(
    'capture_atacado_after_return',
    path.join(screenshotDirectory, 'atacado-final.png'),
  );
} catch (error) {
  const safeError =
    error instanceof QaStepError ? error : new QaStepError('qa_flow', 'QA flow failed.');
  failedStep = failedStep || safeError.step;
  report.errors.push({ step: safeError.step, message: safeError.message });

  if (appSessionOpened) {
    const failureScreenshot = path.join(screenshotDirectory, 'failure.png');
    try {
      runAgentDevice('capture_failure_state', ['screenshot', failureScreenshot]);
      if (existsSync(failureScreenshot) && statSync(failureScreenshot).size > 0) {
        report.evidence.push('screenshots/failure.png');
      }
    } catch {
      // Preserve the original failure without forwarding device output.
    }
  }
} finally {
  if (recordingStarted) {
    try {
      runAgentDevice('stop_short_video', ['record', 'stop']);
      const videoPath = path.join(videoDirectory, 'quick-login-and-mode-switch.mov');
      if (existsSync(videoPath) && statSync(videoPath).size > 0) {
        report.evidence.push('video/quick-login-and-mode-switch.mov');
      } else {
        addCleanupError(
          'stop_short_video',
          new QaStepError('stop_short_video', 'Video file was not created.'),
        );
      }
    } catch (error) {
      addCleanupError('stop_short_video', error);
    }
  }

  if (agentDeviceSessionReady) {
    try {
      // End this run's agent session only; never shut down a simulator another session may use.
      runAgentDevice('close_simulator_session', ['close'], 120_000);
    } catch (error) {
      addCleanupError('close_simulator_session', error);
    }
  }

  writeReport();
}

console.log(
  `NativeSim QA ${report.status}; actions=${report.actions.length}; evidence=${report.evidence.length}; report=report.json`,
);

if (report.status !== 'passed') process.exitCode = 1;
