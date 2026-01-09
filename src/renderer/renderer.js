const state = {
  servers: {},
  currentPlan: null,
  isExecuting: false,
  currentView: 'server-update',
  // Queue control state
  queuePlan: null,
  queueStatus: null,
  isQueueExecuting: false,
  // File editing state
  fileEditFunctions: {},
  fileEditPlan: null,
  isFileEditExecuting: false,
  fileEditHasChanges: false,
};

const elements = {
  navTabs: document.querySelectorAll('.nav-tab'),
  viewContainers: document.querySelectorAll('.view-container'),
  serverSelect: document.getElementById('server'),
  directorySelect: document.getElementById('directory'),
  branchInput: document.getElementById('branch'),
  planButton: document.getElementById('plan'),
  statusSection: document.getElementById('status'),
  commandsDisplay: document.getElementById('commands'),
  executeButton: document.getElementById('execute'),
  cancelButton: document.getElementById('cancel'),
  progressSection: document.getElementById('progress'),
  progressBar: document.getElementById('progress-bar'),
  progressPercentage: document.getElementById('progress-percentage'),
  progressWrapper: document.querySelector('.progress-wrapper'),
  progressSteps: document.getElementById('progress-steps'),
  resultSection: document.getElementById('result'),
  outputDisplay: document.getElementById('output'),
  // Queue control elements
  queueServerSelect: document.getElementById('queue-server'),
  queueDirectorySelect: document.getElementById('queue-directory'),
  queueCheckButton: document.getElementById('queue-check'),
  queueStatusDisplay: document.getElementById('queue-status-display'),
  queueProcessInfo: document.getElementById('queue-process-info'),
  queueStartButton: document.getElementById('queue-start'),
  queueStopButton: document.getElementById('queue-stop'),
  queueRestartButton: document.getElementById('queue-restart'),
  queueProgressSection: document.getElementById('queue-progress'),
  queueProgressBar: document.getElementById('queue-progress-bar'),
  queueProgressPercentage: document.getElementById('queue-progress-percentage'),
  queueProgressSteps: document.getElementById('queue-progress-steps'),
  queueResultSection: document.getElementById('queue-result'),
  queueOutputDisplay: document.getElementById('queue-output'),
  // File editing elements
  fileEditServerSelect: document.getElementById('file-edit-server'),
  fileEditDirectorySelect: document.getElementById('file-edit-directory'),
  fileEditFunctionSelect: document.getElementById('file-edit-function'),
  fileEditRestoreSection: document.getElementById('file-edit-restore-section'),
  fileEditRestoreStatus: document.getElementById('file-edit-restore-status'),
  fileEditRestoreButton: document.getElementById('file-edit-restore'),
  fileEditInputsContainer: document.getElementById('file-edit-inputs'),
  fileEditPlanButton: document.getElementById('file-edit-plan'),
  fileEditStatusSection: document.getElementById('file-edit-status'),
  fileEditCommandsDisplay: document.getElementById('file-edit-commands'),
  fileEditExecuteButton: document.getElementById('file-edit-execute'),
  fileEditCancelButton: document.getElementById('file-edit-cancel'),
  fileEditProgressSection: document.getElementById('file-edit-progress'),
  fileEditProgressBar: document.getElementById('file-edit-progress-bar'),
  fileEditProgressPercentage: document.getElementById(
    'file-edit-progress-percentage'
  ),
  fileEditProgressSteps: document.getElementById('file-edit-progress-steps'),
  fileEditResultSection: document.getElementById('file-edit-result'),
  fileEditOutputDisplay: document.getElementById('file-edit-output'),
};

const PROGRESS_GRADIENTS = {
  success: 'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)',
  error: 'linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)',
};

const RESULT_STYLES = {
  success: { background: '#14b8a6', color: '#ffffff' },
  conflict: { background: '#f59e0b', color: '#ffffff' },
  error: { background: '#f43f5e', color: '#ffffff' },
  warning: { background: '#fef3c7', color: '#92400e' },
};

const CONFLICT_LABELS = {
  UNMERGED_INDEX: 'Repository has unmerged paths that block stashing',
  STASH_CONFLICT: 'Stashed changes conflict with pulled updates',
  MERGE_CONFLICT: 'Local and remote branches have conflicting changes',
  UNMERGED_FILE: 'Index contains unmerged files after stash pop',
};

const STEP_STATUS_MAP = {
  running: { class: 'running', text: 'Running' },
  'step-complete': { class: 'success', text: 'Completed' },
  'step-failed': { class: 'failed', text: 'Failed' },
  'rollback-running': { class: 'rollback-running', text: 'Rolling back' },
  'rollback-step-complete': { class: 'rollback-complete', text: 'Rolled back' },
  'rollback-step-warning': {
    class: 'rollback-warning',
    text: 'Rolled back with warning',
  },
};

async function initialize() {
  setupViewSwitching();
  await loadServers();
  await loadFileEditFunctions();
  attachEventListeners();
  setupProgressListener();
  // Queue control initialization
  attachQueueEventListeners();
  setupQueueProgressListener();
  // File editing initialization
  attachFileEditEventListeners();
  setupFileEditProgressListener();
}

function setupViewSwitching() {
  elements.navTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => switchView(e.target.dataset.view));
  });
}

function switchView(viewName) {
  state.currentView = viewName;
  toggleActive(elements.navTabs, (tab) => tab.dataset.view === viewName);
  toggleActive(
    elements.viewContainers,
    (container) => container.id === `view-${viewName}`
  );
}

function toggleActive(elements, matchFn) {
  elements.forEach((el) => el.classList.toggle('active', matchFn(el)));
}

async function loadServers() {
  try {
    state.servers = await window.igent.getServers();
    Object.keys(state.servers).forEach((key) => {
      elements.serverSelect.appendChild(createOption(key, key));
      elements.queueServerSelect.appendChild(createOption(key, key));
      elements.fileEditServerSelect.appendChild(createOption(key, key));
    });
  } catch (error) {
    showError('Failed to load server configuration', error);
  }
}

async function loadFileEditFunctions() {
  try {
    state.fileEditFunctions = await window.igent.fileEdit.getFunctions();
  } catch (error) {
    showError('Failed to load file edit functions', error);
  }
}

function createOption(value, text) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  return option;
}

function attachEventListeners() {
  elements.serverSelect.addEventListener('change', handleServerChange);
  elements.directorySelect.addEventListener('change', validateForm);
  elements.branchInput.addEventListener('input', validateForm);
  elements.planButton.addEventListener('click', handleUpdate);
  elements.executeButton.addEventListener('click', handleExecute);
  elements.cancelButton.addEventListener('click', handleCancel);
}

function handleServerChange(e) {
  const serverKey = e.target.value;

  elements.directorySelect.innerHTML =
    '<option value="">Select directory...</option>';
  elements.directorySelect.disabled = true;
  elements.planButton.disabled = true;
  hideResults();

  if (serverKey && state.servers[serverKey]) {
    state.servers[serverKey].allowedDirectories.forEach((dir) => {
      elements.directorySelect.appendChild(createOption(dir, dir));
    });
    elements.directorySelect.disabled = false;
  }
}

function validateForm() {
  const isValid =
    elements.serverSelect.value &&
    elements.directorySelect.value &&
    elements.branchInput.value.trim();
  elements.planButton.disabled = !isValid;
}

async function handleUpdate() {
  hideResults();
  elements.planButton.disabled = true;

  try {
    state.currentPlan = await window.igent.plan({
      serverKey: elements.serverSelect.value,
      directory: elements.directorySelect.value,
      branch: elements.branchInput.value.trim(),
    });
    displayPlan(state.currentPlan);
  } catch (error) {
    showError('Planning failed', error);
  } finally {
    validateForm();
  }
}

async function handleExecute() {
  if (!state.currentPlan) {
    showError(
      'No deployment plan available',
      new Error('Please create a deployment plan first')
    );
    return;
  }

  setExecutionState(true);
  resetProgress();
  scrollToElement(elements.progressSection);

  try {
    const result = await window.igent.execute(state.currentPlan);
    if (result.success === false) {
      displayError(result);
    } else {
      displaySuccess(result);
    }
  } catch (error) {
    displayError(error);
  } finally {
    setExecutionState(false);
  }
}

function setExecutionState(isExecuting) {
  state.isExecuting = isExecuting;
  elements.executeButton.disabled = isExecuting;
  elements.cancelButton.disabled = isExecuting;
  elements.planButton.disabled = isExecuting;
  if (!isExecuting) validateForm();
}

function resetProgress() {
  hideSection(elements.statusSection);
  hideSection(elements.resultSection);
  showSection(elements.progressSection);

  elements.progressSteps.innerHTML = '';
  setProgressBar(0);
  elements.progressWrapper.style.display = 'flex';

  const conflictHeader = document.getElementById('conflict-header');
  if (conflictHeader) conflictHeader.style.display = 'none';
}

function setProgressBar(percentage, gradient = null) {
  elements.progressBar.style.width = `${percentage}%`;
  elements.progressPercentage.textContent = `${percentage}%`;
  if (gradient) elements.progressBar.style.background = gradient;
}

function handleCancel() {
  state.currentPlan = null;
  hideSection(elements.statusSection);
}

function setupProgressListener() {
  window.igent.onProgress(updateProgress);
}

function updateProgress(data) {
  const { status, currentStep, totalSteps } = data;

  if (totalSteps > 0) {
    const completed =
      status === 'running' ? Math.max(0, currentStep - 1) : currentStep || 0;
    setProgressBar(Math.round((completed / totalSteps) * 100));
  }

  const handlers = {
    started: () => (elements.progressSteps.innerHTML = ''),
    running: () => updateStepDisplay(data),
    'step-complete': () => updateStepDisplay(data),
    'step-failed': () => updateStepDisplay(data),
    'conflict-detected': () => {
      displayConflictStep(data);
      elements.progressWrapper.style.display = 'none';
      displayConflictHeader();
    },
    'rollback-running': () => displayRollbackStep(data),
    'rollback-step-complete': () => displayRollbackStep(data),
    'rollback-step-warning': () => displayRollbackStep(data),
    'rollback-completed': () => displayRollbackComplete(),
    completed: () => setProgressBar(100, PROGRESS_GRADIENTS.success),
    failed: () =>
      setProgressBar(
        parseInt(elements.progressPercentage.textContent),
        PROGRESS_GRADIENTS.error
      ),
  };

  handlers[status]?.();
}

function updateStepDisplay(data) {
  const { currentStep, command, status, duration, error, stderr } = data;
  const stepElement = getOrCreateStepElement(
    `step-${currentStep}`,
    'progress-step'
  );
  const statusInfo = STEP_STATUS_MAP[status] || { class: '', text: 'Running' };

  stepElement.className = `progress-step ${statusInfo.class}`;
  stepElement.innerHTML = createStepHTML(
    statusInfo.text,
    currentStep,
    command,
    duration,
    status === 'step-failed' ? error || stderr : null
  );
  scrollToElement(stepElement);
}

function displayConflictStep(data) {
  const { currentStep, conflictType, totalSteps } = data;
  const stepElement = getOrCreateStepElement(
    'step-conflict',
    'progress-step conflict'
  );
  const label =
    CONFLICT_LABELS[conflictType] || `Git conflict: ${conflictType}`;

  stepElement.innerHTML = `
    <div class="progress-step-header">
      <span><strong>CONFLICT DETECTED</strong> at Step ${currentStep}/${totalSteps}</span>
    </div>
    <div class="progress-step-command">${escapeHTML(label)}</div>
    <div class="progress-step-info">Starting automatic rollback...</div>
  `;
  scrollToElement(stepElement);
}

function displayRollbackStep(data) {
  const { rollbackStep, totalRollbackSteps, command, status, duration } = data;
  const stepElement = getOrCreateStepElement(
    `rollback-step-${rollbackStep}`,
    'progress-step rollback'
  );
  const statusInfo = STEP_STATUS_MAP[status] || {
    class: '',
    text: 'Rolling back',
  };

  stepElement.className = `progress-step rollback ${statusInfo.class}`;
  stepElement.innerHTML = createStepHTML(
    statusInfo.text,
    `${rollbackStep}/${totalRollbackSteps}`,
    command,
    duration
  );
  scrollToElement(stepElement);
}

function displayRollbackComplete() {
  const stepElement = getOrCreateStepElement(
    'rollback-complete',
    'progress-step rollback-done'
  );
  stepElement.innerHTML = `
    <div class="progress-step-header">
      <span><strong>ROLLBACK COMPLETE</strong></span>
    </div>
    <div class="progress-step-command">Server restored to previous state</div>
  `;
  scrollToElement(stepElement);
}

function createStepHTML(
  statusText,
  stepNum,
  command,
  duration,
  errorMsg = null
) {
  return `
    <div class="progress-step-header">
      <span><strong>${escapeHTML(statusText)}</strong> Step ${stepNum}</span>
      ${duration ? `<span class="progress-step-time">${duration}s</span>` : ''}
    </div>
    <div class="progress-step-command">${escapeHTML(command)}</div>
    ${errorMsg ? `<div style="color: var(--color-error); font-size: var(--font-size-xs); margin-top: var(--spacing-xs);">Error: ${escapeHTML(errorMsg)}</div>` : ''}
  `;
}

function displayConflictHeader() {
  let header = document.getElementById('conflict-header');

  if (!header) {
    header = document.createElement('div');
    header.id = 'conflict-header';
    header.className = 'conflict-header';
    elements.progressSection
      .querySelector('h3')
      .insertAdjacentElement('afterend', header);
  }

  header.innerHTML = `
    <div class="conflict-title">CONFLICT</div>
    <div class="conflict-subtitle">Rollback Started...</div>
  `;
  header.style.display = 'flex';
}

function displayPlan(plan) {
  const commands = plan.commands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n');

  elements.commandsDisplay.innerHTML =
    `<div><span class="plan-label">Server:</span> ${escapeHTML(plan.serverKey)}</div>` +
    `<div><span class="plan-label">Directory:</span> ${escapeHTML(plan.directory)}</div>` +
    `<div><span class="plan-label">Branch:</span> ${escapeHTML(plan.branch)}</div>` +
    `<div style="margin-top: 8px;"><span class="plan-label">Commands:</span></div>` +
    `<div style="margin-top: 4px;">${escapeHTML(commands)}</div>`;

  showSection(elements.statusSection);
  elements.executeButton.disabled = false;
  elements.cancelButton.disabled = false;
  scrollToElement(elements.statusSection);
}

function displaySuccess(result) {
  hideSection(elements.progressSection);
  hideSection(elements.statusSection);
  showResultSection(
    'success',
    `Completed ${result.totalSteps} steps in ${result.totalDuration}s`
  );
}

function displayError(error) {
  hideSection(elements.progressSection);
  hideSection(elements.statusSection);

  if (error.isConflict) {
    showResultSection('conflict', error.message);
    return;
  }

  const parts = [
    error.failedAtStep &&
      error.failedCommand &&
      `Failed at Step ${error.failedAtStep}/${error.totalSteps}\nCommand: ${error.failedCommand}\nDuration: ${error.totalDuration}s`,
    error.stderr && `Error Output:\n${error.stderr}`,
    error.failureReason && `Reason: ${error.failureReason}`,
    error.exitCode && `Exit Code: ${error.exitCode}`,
    !error.stderr &&
      !error.failureReason &&
      (error.message || 'Unknown error occurred'),
  ]
    .filter(Boolean)
    .join('\n\n');

  showResultSection('error', parts);
}

function showError(title, error) {
  showResultSection('warning', `${title}\n\n${error.message || error}`);
}

function showResultSection(type, message) {
  const styles = RESULT_STYLES[type];
  showSection(elements.resultSection);
  Object.assign(elements.resultSection.style, styles);
  elements.outputDisplay.textContent = message;
  elements.outputDisplay.style.color = '#e5e7eb';
  scrollToElement(elements.resultSection);
}

function hideResults() {
  hideSection(elements.statusSection);
  hideSection(elements.progressSection);
  hideSection(elements.resultSection);
  state.currentPlan = null;
}

function showSection(element) {
  element.style.display = 'block';
}

function hideSection(element) {
  element.style.display = 'none';
}

function getOrCreateStepElement(stepId, className) {
  let element = document.getElementById(stepId);
  if (!element) {
    element = document.createElement('div');
    element.id = stepId;
    element.className = className;
    elements.progressSteps.appendChild(element);
  }
  return element;
}

function scrollToElement(element) {
  setTimeout(
    () => element.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    100
  );
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// QUEUE CONTROL FUNCTIONS
// ============================================

function attachQueueEventListeners() {
  elements.queueServerSelect.addEventListener(
    'change',
    handleQueueServerChange
  );
  elements.queueDirectorySelect.addEventListener(
    'change',
    handleQueueDirectoryChange
  );
  elements.queueCheckButton.addEventListener('click', handleQueueCheck);
  elements.queueStartButton.addEventListener('click', () =>
    handleQueueAction('start')
  );
  elements.queueStopButton.addEventListener('click', () =>
    handleQueueAction('stop')
  );
  elements.queueRestartButton.addEventListener('click', () =>
    handleQueueAction('restart')
  );
}

function handleQueueServerChange(e) {
  const serverKey = e.target.value;

  elements.queueDirectorySelect.innerHTML =
    '<option value="">Select directory...</option>';
  elements.queueDirectorySelect.disabled = true;
  resetQueueStatus();
  setQueueButtonsState(false);
  hideQueueResults();

  if (serverKey && state.servers[serverKey]) {
    state.servers[serverKey].allowedDirectories.forEach((dir) => {
      elements.queueDirectorySelect.appendChild(createOption(dir, dir));
    });
    elements.queueDirectorySelect.disabled = false;
  }
}

function handleQueueDirectoryChange() {
  const hasSelection =
    elements.queueServerSelect.value && elements.queueDirectorySelect.value;
  elements.queueCheckButton.disabled = !hasSelection;

  if (hasSelection) {
    updateQueueStatusDisplay(
      'unknown',
      'Click "Check Status" to fetch current state'
    );
    elements.queueProcessInfo.innerHTML = '';
  } else {
    resetQueueStatus();
  }

  setQueueButtonsState(false);
  hideQueueResults();
}

async function handleQueueCheck() {
  const serverKey = elements.queueServerSelect.value;
  const directory = elements.queueDirectorySelect.value;

  if (!serverKey || !directory) return;

  elements.queueCheckButton.disabled = true;
  updateQueueStatusDisplay('checking', 'Checking status...');

  try {
    const result = await window.igent.queue.checkStatus({
      serverKey,
      directory,
    });
    state.queueStatus = result;
    displayQueueStatus(result);
    updateQueueActionButtons(result);
  } catch (error) {
    updateQueueStatusDisplay(
      'error',
      `Failed to check status: ${error.message}`
    );
    setQueueButtonsState(false);
  } finally {
    elements.queueCheckButton.disabled = false;
  }
}

function displayQueueStatus(status) {
  if (status.isRunning) {
    updateQueueStatusDisplay('running', 'Queue is OPEN (Sidekiq running)');

    if (status.processInfo) {
      const info = status.processInfo;
      let infoHtml = `<div class="process-info-item"><strong>PID:</strong> ${status.pid || 'N/A'}</div>`;

      if (info.busyWorkers !== undefined) {
        infoHtml += `<div class="process-info-item"><strong>Workers:</strong> ${info.busyWorkers} of ${info.totalWorkers} busy</div>`;
      }

      if (info.fullLine) {
        infoHtml += `<div class="process-info-detail">${escapeHTML(info.fullLine)}</div>`;
      }

      elements.queueProcessInfo.innerHTML = infoHtml;
    }
  } else {
    updateQueueStatusDisplay('stopped', 'Queue is CLOSED (No Sidekiq process)');
    elements.queueProcessInfo.innerHTML = '';
  }
}

function updateQueueStatusDisplay(status, text) {
  const indicator = elements.queueStatusDisplay.querySelector(
    '.queue-status-indicator'
  );
  indicator.className = `queue-status-indicator ${status}`;
  indicator.querySelector('.status-text').textContent = text;
}

function updateQueueActionButtons(status) {
  if (state.isQueueExecuting) return;

  const isRunning = status?.isRunning || false;

  elements.queueStartButton.disabled = isRunning;
  elements.queueStopButton.disabled = !isRunning;
  elements.queueRestartButton.disabled = false;
}

function setQueueButtonsState(enabled) {
  elements.queueStartButton.disabled = !enabled;
  elements.queueStopButton.disabled = !enabled;
  elements.queueRestartButton.disabled = !enabled;
}

function resetQueueStatus() {
  state.queueStatus = null;
  updateQueueStatusDisplay('unknown', 'Select server and directory');
  elements.queueProcessInfo.innerHTML = '';
  elements.queueCheckButton.disabled = true;
}

async function handleQueueAction(action) {
  const serverKey = elements.queueServerSelect.value;
  const directory = elements.queueDirectorySelect.value;

  if (!serverKey || !directory) return;

  setQueueExecutionState(true);
  resetQueueProgress();

  try {
    const plan = await window.igent.queue.plan({
      serverKey,
      directory,
      action,
    });
    state.queuePlan = plan;

    const result = await window.igent.queue.execute(plan);

    if (result.success === false) {
      displayQueueError(result);
    } else {
      displayQueueSuccess(result);
    }

    state.lastQueueResult = result;
  } catch (error) {
    displayQueueError(error);
    state.lastQueueResult = null;
  } finally {
    setQueueExecutionState(false);

    // Update status and buttons after execution state reset
    if (state.lastQueueResult?.queueStatus) {
      state.queueStatus = state.lastQueueResult.queueStatus;
      displayQueueStatus(state.lastQueueResult.queueStatus);
      updateQueueActionButtons(state.lastQueueResult.queueStatus);
    } else if (state.lastQueueResult) {
      // Re-check status if not included in result
      await handleQueueCheck();
    }
  }
}

function setQueueExecutionState(isExecuting) {
  state.isQueueExecuting = isExecuting;
  elements.queueCheckButton.disabled = isExecuting;
  elements.queueStartButton.disabled = isExecuting;
  elements.queueStopButton.disabled = isExecuting;
  elements.queueRestartButton.disabled = isExecuting;
  elements.queueServerSelect.disabled = isExecuting;
  elements.queueDirectorySelect.disabled = isExecuting;
}

function resetQueueProgress() {
  hideSection(elements.queueResultSection);
  showSection(elements.queueProgressSection);

  elements.queueProgressSteps.innerHTML = '';
  setQueueProgressBar(0);
}

function setQueueProgressBar(percentage, gradient = null) {
  elements.queueProgressBar.style.width = `${percentage}%`;
  elements.queueProgressPercentage.textContent = `${percentage}%`;
  if (gradient) elements.queueProgressBar.style.background = gradient;
}

function setupQueueProgressListener() {
  window.igent.queue.onProgress(updateQueueProgress);
}

function updateQueueProgress(data) {
  const { status, currentStep, totalSteps } = data;

  if (totalSteps > 0) {
    const completed =
      status === 'running' ? Math.max(0, currentStep - 1) : currentStep || 0;
    setQueueProgressBar(Math.round((completed / totalSteps) * 100));
  }

  const handlers = {
    started: () => (elements.queueProgressSteps.innerHTML = ''),
    running: () => updateQueueStepDisplay(data),
    'step-complete': () => updateQueueStepDisplay(data),
    'step-failed': () => updateQueueStepDisplay(data),
    completed: () => setQueueProgressBar(100, PROGRESS_GRADIENTS.success),
    failed: () =>
      setQueueProgressBar(
        parseInt(elements.queueProgressPercentage.textContent),
        PROGRESS_GRADIENTS.error
      ),
  };

  handlers[status]?.();
}

function updateQueueStepDisplay(data) {
  const { currentStep, command, status, duration, error, stderr } = data;
  const stepElement = getOrCreateQueueStepElement(
    `queue-step-${currentStep}`,
    'progress-step'
  );
  const statusInfo = STEP_STATUS_MAP[status] || { class: '', text: 'Running' };

  stepElement.className = `progress-step ${statusInfo.class}`;
  stepElement.innerHTML = createStepHTML(
    statusInfo.text,
    currentStep,
    command,
    duration,
    status === 'step-failed' ? error || stderr : null
  );
  scrollToElement(stepElement);
}

function getOrCreateQueueStepElement(stepId, className) {
  let element = document.getElementById(stepId);
  if (!element) {
    element = document.createElement('div');
    element.id = stepId;
    element.className = className;
    elements.queueProgressSteps.appendChild(element);
  }
  return element;
}

function displayQueueSuccess(result) {
  hideSection(elements.queueProgressSection);

  let message = `Queue ${result.action} completed successfully in ${result.totalDuration}s`;

  if (result.alreadyRunning) {
    message = `Sidekiq is already running (PID: ${result.queueStatus?.pid || 'unknown'})`;
  } else if (result.alreadyStopped) {
    message = 'Sidekiq is not running, nothing to stop';
  }

  if (result.queueStatus) {
    message +=
      '\n\nCurrent Status: ' +
      (result.queueStatus.isRunning ? 'RUNNING' : 'STOPPED');
    if (result.queueStatus.pid) {
      message += ` (PID: ${result.queueStatus.pid})`;
    }
  }

  showQueueResultSection('success', message);
}

function displayQueueError(error) {
  hideSection(elements.queueProgressSection);

  const parts = [
    error.failedAtStep &&
      error.failedCommand &&
      `Failed at Step ${error.failedAtStep}/${error.totalSteps}\nCommand: ${error.failedCommand}\nDuration: ${error.totalDuration}s`,
    error.stderr && `Error Output:\n${error.stderr}`,
    error.failureReason && `Reason: ${error.failureReason}`,
    !error.stderr &&
      !error.failureReason &&
      (error.message || 'Unknown error occurred'),
  ]
    .filter(Boolean)
    .join('\n\n');

  showQueueResultSection('error', parts);
}

function showQueueResultSection(type, message) {
  const styles = RESULT_STYLES[type];
  showSection(elements.queueResultSection);
  Object.assign(elements.queueResultSection.style, styles);
  elements.queueOutputDisplay.textContent = message;
  elements.queueOutputDisplay.style.color = '#e5e7eb';
  scrollToElement(elements.queueResultSection);
}

function hideQueueResults() {
  hideSection(elements.queueProgressSection);
  hideSection(elements.queueResultSection);
}

// ============================================
// FILE EDITING FUNCTIONS
// ============================================

function attachFileEditEventListeners() {
  elements.fileEditServerSelect.addEventListener(
    'change',
    handleFileEditServerChange
  );
  elements.fileEditDirectorySelect.addEventListener(
    'change',
    handleFileEditDirectoryChange
  );
  elements.fileEditFunctionSelect.addEventListener(
    'change',
    handleFileEditFunctionChange
  );
  elements.fileEditPlanButton.addEventListener('click', handleFileEditPlan);
  elements.fileEditExecuteButton.addEventListener(
    'click',
    handleFileEditExecute
  );
  elements.fileEditCancelButton.addEventListener('click', handleFileEditCancel);
  elements.fileEditRestoreButton.addEventListener(
    'click',
    handleFileEditRestore
  );
}

function handleFileEditServerChange(e) {
  const serverKey = e.target.value;

  elements.fileEditDirectorySelect.innerHTML =
    '<option value="">Select directory...</option>';
  elements.fileEditDirectorySelect.disabled = true;
  elements.fileEditFunctionSelect.innerHTML =
    '<option value="">Select a function...</option>';
  elements.fileEditFunctionSelect.disabled = true;
  elements.fileEditInputsContainer.innerHTML = '';
  elements.fileEditPlanButton.disabled = true;
  resetFileEditRestoreStatus();
  hideFileEditResults();

  if (serverKey && state.servers[serverKey]) {
    state.servers[serverKey].allowedDirectories.forEach((dir) => {
      elements.fileEditDirectorySelect.appendChild(createOption(dir, dir));
    });
    elements.fileEditDirectorySelect.disabled = false;
  }
}

function handleFileEditDirectoryChange() {
  const hasSelection =
    elements.fileEditServerSelect.value &&
    elements.fileEditDirectorySelect.value;

  elements.fileEditFunctionSelect.innerHTML =
    '<option value="">Select a function...</option>';
  elements.fileEditFunctionSelect.disabled = true;
  elements.fileEditInputsContainer.innerHTML = '';
  elements.fileEditPlanButton.disabled = true;
  resetFileEditRestoreStatus();
  hideFileEditResults();

  if (hasSelection) {
    // Populate function select
    Object.entries(state.fileEditFunctions).forEach(([id, func]) => {
      elements.fileEditFunctionSelect.appendChild(createOption(id, func.name));
    });
    elements.fileEditFunctionSelect.disabled = false;
  }
}

function handleFileEditFunctionChange() {
  const functionId = elements.fileEditFunctionSelect.value;

  elements.fileEditInputsContainer.innerHTML = '';
  elements.fileEditPlanButton.disabled = true;
  resetFileEditRestoreStatus();
  hideFileEditResults();

  if (functionId && state.fileEditFunctions[functionId]) {
    const funcConfig = state.fileEditFunctions[functionId];
    renderFileEditInputs(funcConfig);
    validateFileEditForm();
    // Check for uncommitted changes in the target file
    checkFileEditChanges(funcConfig.targetFile);
  }
}

function renderFileEditInputs(funcConfig) {
  if (!funcConfig.inputs || funcConfig.inputs.length === 0) {
    validateFileEditForm();
    return;
  }

  // Show function info
  const infoDiv = document.createElement('div');
  infoDiv.className = 'file-edit-info';
  infoDiv.innerHTML = `
    <div class="file-edit-target">
      <span class="label">Target File:</span>
      <span class="value">${escapeHTML(funcConfig.targetFile)}</span>
    </div>
  `;
  elements.fileEditInputsContainer.appendChild(infoDiv);

  // Render input fields
  for (const inputDef of funcConfig.inputs) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = `file-edit-input-${inputDef.key}`;
    label.textContent = inputDef.label;

    const input = document.createElement('input');
    input.type = inputDef.type || 'text';
    input.id = `file-edit-input-${inputDef.key}`;
    input.className = 'form-control';
    input.placeholder = inputDef.placeholder || '';
    input.dataset.inputKey = inputDef.key;
    input.autocomplete = 'off';

    if (inputDef.required) input.required = true;

    input.addEventListener('input', validateFileEditForm);

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    elements.fileEditInputsContainer.appendChild(formGroup);
  }
}

function validateFileEditForm() {
  const hasServer = elements.fileEditServerSelect.value;
  const hasDirectory = elements.fileEditDirectorySelect.value;
  const hasFunction = elements.fileEditFunctionSelect.value;

  if (!hasServer || !hasDirectory || !hasFunction) {
    elements.fileEditPlanButton.disabled = true;
    return;
  }

  const funcConfig = state.fileEditFunctions[hasFunction];
  if (!funcConfig) {
    elements.fileEditPlanButton.disabled = true;
    return;
  }

  // Check all required inputs have values
  const inputs = elements.fileEditInputsContainer.querySelectorAll(
    'input[data-input-key]'
  );
  let allValid = true;

  inputs.forEach((input) => {
    if (input.required && !input.value.trim()) {
      allValid = false;
    }
  });

  elements.fileEditPlanButton.disabled = !allValid;
}

function getFileEditInputValues() {
  const inputs = elements.fileEditInputsContainer.querySelectorAll(
    'input[data-input-key]'
  );
  const values = {};

  inputs.forEach((input) => {
    values[input.dataset.inputKey] = input.value.trim();
  });

  return values;
}

async function handleFileEditPlan() {
  hideFileEditResults();
  elements.fileEditPlanButton.disabled = true;

  try {
    state.fileEditPlan = await window.igent.fileEdit.plan({
      serverKey: elements.fileEditServerSelect.value,
      directory: elements.fileEditDirectorySelect.value,
      functionId: elements.fileEditFunctionSelect.value,
      inputs: getFileEditInputValues(),
    });
    displayFileEditPlan(state.fileEditPlan);
  } catch (error) {
    showFileEditError('Planning failed', error);
  } finally {
    validateFileEditForm();
  }
}

function displayFileEditPlan(plan) {
  const commands = plan.commands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n');
  const inputs = Object.entries(plan.inputs || {})
    .map(
      ([key, value]) =>
        `<div><span class="plan-label">${escapeHTML(key)}:</span> ${escapeHTML(value)}</div>`
    )
    .join('');

  elements.fileEditCommandsDisplay.innerHTML =
    `<div><span class="plan-label">Server:</span> ${escapeHTML(plan.serverKey)}</div>` +
    `<div><span class="plan-label">Directory:</span> ${escapeHTML(plan.directory)}</div>` +
    `<div><span class="plan-label">Function:</span> ${escapeHTML(plan.functionName)}</div>` +
    `<div><span class="plan-label">Target File:</span> ${escapeHTML(plan.targetFile)}</div>` +
    (inputs
      ? `<div style="margin-top: 8px;"><span class="plan-label">Inputs:</span></div>${inputs}`
      : '') +
    `<div style="margin-top: 8px;"><span class="plan-label">Commands:</span></div>` +
    `<div style="margin-top: 4px;">${escapeHTML(commands)}</div>`;

  showSection(elements.fileEditStatusSection);
  elements.fileEditExecuteButton.disabled = false;
  elements.fileEditCancelButton.disabled = false;
  scrollToElement(elements.fileEditStatusSection);
}

async function handleFileEditExecute() {
  if (!state.fileEditPlan) {
    showFileEditError(
      'No plan available',
      new Error('Please create a plan first')
    );
    return;
  }

  setFileEditExecutionState(true);
  resetFileEditProgress();
  scrollToElement(elements.fileEditProgressSection);

  try {
    const result = await window.igent.fileEdit.execute(state.fileEditPlan);
    if (result.success === false) {
      displayFileEditError(result);
    } else {
      displayFileEditSuccess(result);
    }
  } catch (error) {
    displayFileEditError(error);
  } finally {
    setFileEditExecutionState(false);
  }
}

function handleFileEditCancel() {
  state.fileEditPlan = null;
  hideSection(elements.fileEditStatusSection);
}

function setFileEditExecutionState(isExecuting) {
  state.isFileEditExecuting = isExecuting;
  elements.fileEditExecuteButton.disabled = isExecuting;
  elements.fileEditCancelButton.disabled = isExecuting;
  elements.fileEditPlanButton.disabled = isExecuting;
  elements.fileEditServerSelect.disabled = isExecuting;
  elements.fileEditDirectorySelect.disabled = isExecuting;
  elements.fileEditFunctionSelect.disabled = isExecuting;

  // Disable input fields
  const inputs = elements.fileEditInputsContainer.querySelectorAll('input');
  inputs.forEach((input) => (input.disabled = isExecuting));

  if (!isExecuting) validateFileEditForm();
}

function resetFileEditProgress() {
  hideSection(elements.fileEditStatusSection);
  hideSection(elements.fileEditResultSection);
  showSection(elements.fileEditProgressSection);

  elements.fileEditProgressSteps.innerHTML = '';
  setFileEditProgressBar(0);
}

function setFileEditProgressBar(percentage, gradient = null) {
  elements.fileEditProgressBar.style.width = `${percentage}%`;
  elements.fileEditProgressPercentage.textContent = `${percentage}%`;
  if (gradient) elements.fileEditProgressBar.style.background = gradient;
}

function setupFileEditProgressListener() {
  window.igent.fileEdit.onProgress(updateFileEditProgress);
}

function updateFileEditProgress(data) {
  const { status, currentStep, totalSteps } = data;

  if (totalSteps > 0) {
    const completed =
      status === 'running' ? Math.max(0, currentStep - 1) : currentStep || 0;
    setFileEditProgressBar(Math.round((completed / totalSteps) * 100));
  }

  const handlers = {
    started: () => (elements.fileEditProgressSteps.innerHTML = ''),
    running: () => updateFileEditStepDisplay(data),
    'step-complete': () => updateFileEditStepDisplay(data),
    'step-failed': () => updateFileEditStepDisplay(data),
    completed: () => setFileEditProgressBar(100, PROGRESS_GRADIENTS.success),
    failed: () =>
      setFileEditProgressBar(
        parseInt(elements.fileEditProgressPercentage.textContent),
        PROGRESS_GRADIENTS.error
      ),
  };

  handlers[status]?.();
}

function updateFileEditStepDisplay(data) {
  const { currentStep, command, status, duration, error, stderr } = data;
  const stepElement = getOrCreateFileEditStepElement(
    `file-edit-step-${currentStep}`,
    'progress-step'
  );
  const statusInfo = STEP_STATUS_MAP[status] || { class: '', text: 'Running' };

  stepElement.className = `progress-step ${statusInfo.class}`;
  stepElement.innerHTML = createStepHTML(
    statusInfo.text,
    currentStep,
    command,
    duration,
    status === 'step-failed' ? error || stderr : null
  );
  scrollToElement(stepElement);
}

function getOrCreateFileEditStepElement(stepId, className) {
  let element = document.getElementById(stepId);
  if (!element) {
    element = document.createElement('div');
    element.id = stepId;
    element.className = className;
    elements.fileEditProgressSteps.appendChild(element);
  }
  return element;
}

function displayFileEditSuccess(result) {
  hideSection(elements.fileEditProgressSection);
  hideSection(elements.fileEditStatusSection);

  let message = `${result.functionName} completed successfully in ${result.totalDuration}s`;

  if (result.output) {
    message += `\n\nOutput:\n${result.output}`;
  }

  showFileEditResultSection('success', message);

  // Refresh restore status to show the file now has changes
  refreshFileEditRestoreStatus();
}

function displayFileEditError(error) {
  hideSection(elements.fileEditProgressSection);
  hideSection(elements.fileEditStatusSection);

  const parts = [
    error.failedAtStep &&
      error.failedCommand &&
      `Failed at Step ${error.failedAtStep}/${error.totalSteps}\nCommand: ${error.failedCommand}\nDuration: ${error.totalDuration}s`,
    error.stderr && `Error Output:\n${error.stderr}`,
    error.failureReason && `Reason: ${error.failureReason}`,
    !error.stderr &&
      !error.failureReason &&
      (error.message || 'Unknown error occurred'),
  ]
    .filter(Boolean)
    .join('\n\n');

  showFileEditResultSection('error', parts);
}

function showFileEditError(title, error) {
  showFileEditResultSection('warning', `${title}\n\n${error.message || error}`);
}

function showFileEditResultSection(type, message) {
  const styles = RESULT_STYLES[type];
  showSection(elements.fileEditResultSection);
  Object.assign(elements.fileEditResultSection.style, styles);
  elements.fileEditOutputDisplay.textContent = message;
  elements.fileEditOutputDisplay.style.color = '#e5e7eb';
  scrollToElement(elements.fileEditResultSection);
}

function hideFileEditResults() {
  hideSection(elements.fileEditStatusSection);
  hideSection(elements.fileEditProgressSection);
  hideSection(elements.fileEditResultSection);
  state.fileEditPlan = null;
}

// ============================================
// FILE EDITING - RESTORE FUNCTIONS
// ============================================

function resetFileEditRestoreStatus() {
  state.fileEditHasChanges = false;
  elements.fileEditRestoreButton.disabled = true;
  elements.fileEditRestoreStatus.textContent =
    'Select a function to check for changes';
  elements.fileEditRestoreStatus.className = 'restore-status-text';
  elements.fileEditRestoreSection.className = 'file-edit-restore-section';
}

async function checkFileEditChanges(targetFile) {
  const serverKey = elements.fileEditServerSelect.value;
  const directory = elements.fileEditDirectorySelect.value;

  if (!serverKey || !directory || !targetFile) {
    resetFileEditRestoreStatus();
    return;
  }

  // Show checking status
  elements.fileEditRestoreStatus.textContent = 'Checking for changes...';
  elements.fileEditRestoreStatus.className = 'restore-status-text checking';
  elements.fileEditRestoreButton.disabled = true;

  try {
    const result = await window.igent.fileEdit.checkChanges({
      serverKey,
      directory,
      targetFile,
    });

    state.fileEditHasChanges = result.hasChanges;

    if (result.hasChanges) {
      elements.fileEditRestoreStatus.textContent =
        'File has uncommitted changes';
      elements.fileEditRestoreStatus.className =
        'restore-status-text has-changes';
      elements.fileEditRestoreSection.className =
        'file-edit-restore-section has-changes';
      elements.fileEditRestoreButton.disabled = false;
    } else {
      elements.fileEditRestoreStatus.textContent = 'No changes detected';
      elements.fileEditRestoreStatus.className =
        'restore-status-text no-changes';
      elements.fileEditRestoreSection.className =
        'file-edit-restore-section no-changes';
      elements.fileEditRestoreButton.disabled = true;
    }
  } catch (error) {
    elements.fileEditRestoreStatus.textContent =
      'Could not check file status: ' + error.message;
    elements.fileEditRestoreStatus.className = 'restore-status-text error';
    elements.fileEditRestoreButton.disabled = true;
  }
}

async function handleFileEditRestore() {
  const functionId = elements.fileEditFunctionSelect.value;
  const funcConfig = state.fileEditFunctions[functionId];

  if (!funcConfig || !state.fileEditHasChanges) return;

  const serverKey = elements.fileEditServerSelect.value;
  const directory = elements.fileEditDirectorySelect.value;
  const targetFile = funcConfig.targetFile;

  // Disable buttons during operation
  elements.fileEditRestoreButton.disabled = true;
  elements.fileEditPlanButton.disabled = true;
  elements.fileEditRestoreStatus.textContent = 'Restoring file...';
  elements.fileEditRestoreStatus.className = 'restore-status-text checking';

  // Show progress section and set up listener
  resetFileEditProgress();
  window.igent.fileEdit.onRestoreProgress(updateFileEditProgress);

  try {
    const result = await window.igent.fileEdit.restore({
      serverKey,
      directory,
      targetFile,
    });

    window.igent.fileEdit.removeRestoreProgressListener();

    if (result.success) {
      state.fileEditHasChanges = false;
      elements.fileEditRestoreStatus.textContent =
        'File restored successfully!';
      elements.fileEditRestoreStatus.className = 'restore-status-text restored';
      elements.fileEditRestoreSection.className =
        'file-edit-restore-section restored';

      // Show success message
      displayRestoreSuccess(result);

      // Re-check after a short delay to update the UI
      setTimeout(() => {
        checkFileEditChanges(targetFile);
      }, 1500);
    } else {
      displayRestoreError(result);
      elements.fileEditRestoreStatus.textContent =
        'Restore failed: ' + (result.message || 'Unknown error');
      elements.fileEditRestoreStatus.className = 'restore-status-text error';
      elements.fileEditRestoreButton.disabled = false;
    }
  } catch (error) {
    window.igent.fileEdit.removeRestoreProgressListener();
    displayRestoreError({ message: error.message });
    elements.fileEditRestoreStatus.textContent =
      'Restore failed: ' + error.message;
    elements.fileEditRestoreStatus.className = 'restore-status-text error';
    elements.fileEditRestoreButton.disabled = false;
  }

  // Re-enable plan button
  validateFileEditForm();
}

function displayRestoreSuccess(result) {
  hideSection(elements.fileEditProgressSection);
  const message = `File restored and service restarted successfully!\n\nDuration: ${result.totalDuration}s\nTarget: ${result.targetFile}`;
  showFileEditResultSection('success', message);
}

function displayRestoreError(error) {
  hideSection(elements.fileEditProgressSection);
  const parts = [
    error.failedAtStep &&
      `Failed at Step ${error.failedAtStep}/${error.totalSteps}`,
    error.command && `Command: ${error.command}`,
    error.stderr && `Error Output:\n${error.stderr}`,
    error.message || 'Unknown error occurred',
  ]
    .filter(Boolean)
    .join('\n\n');

  showFileEditResultSection('error', parts);
}

// Refresh restore status after successful execution
function refreshFileEditRestoreStatus() {
  const functionId = elements.fileEditFunctionSelect.value;
  if (functionId && state.fileEditFunctions[functionId]) {
    const funcConfig = state.fileEditFunctions[functionId];
    checkFileEditChanges(funcConfig.targetFile);
  }
}

initialize();
