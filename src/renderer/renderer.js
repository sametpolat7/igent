const state = {
  servers: {},
  currentPlan: null,
  isExecuting: false,
  currentView: 'server-update',
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
  attachEventListeners();
  setupProgressListener();
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
    });
  } catch (error) {
    showError('Failed to load server configuration', error);
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

initialize();
