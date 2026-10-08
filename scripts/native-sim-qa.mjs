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
  evidence: [],
};

let simulatorPrepared = false;
let appSessionOpened = false;
let recordingStarted = false;
let failedStep = null;

class QaStepError extends Error {
  constructor(step, message) {
    super(message);
    this.step = step;
  }
}

function runAgentDevice(step, args, timeout = 120_000) {
  const result = spawnSync('agent-device', ['--session', sessionName, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout,
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    const reason = result.error?.code || `exit-${result.status ?? result.signal ?? 'unknown'}`;
    throw new QaStepError(step, `agent-device failed (${reason}).`);
  }

  return result.stdout.trim();
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
      : report.errors.length === 0
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
  report.errors.push({ step, message: safeError.message });
  if (!failedStep) failedStep = step;
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

  runStep('boot_fresh_ios_simulator', () => {
    runAgentDevice(
      'boot_fresh_ios_simulator',
      ['boot', '--platform', 'ios', '--device', process.env.SIMULATOR_DEVICE],
      600_000,
    );
    simulatorPrepared = true;
  });

  runStep('install_cached_app', () => {
    runAgentDevice('install_cached_app', [
      'install',
      process.env.APP_BUNDLE_ID,
      process.env.APP_PATH,
      '--platform',
      'ios',
      '--device',
      process.env.SIMULATOR_DEVICE,
    ]);
  });

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

  if (simulatorPrepared) {
    try {
      runAgentDevice('close_simulator_session', ['close', '--shutdown'], 120_000);
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
