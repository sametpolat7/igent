import {
  state,
  elements,
  PROGRESS_GRADIENTS,
  STEP_STATUS_MAP,
  CONFLICT_LABELS,
  RESULT_STYLES,
  createOption,
  showSection,
  hideSection,
  scrollToElement,
  escapeHTML,
  createStepHTML,
} from '../index.js';

export function attachEventListeners() {
  elements.serverSelect.addEventListener('change', handleServerChange);
  elements.directorySelect.addEventListener('change', validateForm);
  elements.branchInput.addEventListener('input', validateForm);
  elements.planButton.addEventListener('click', handlePlan);
}

export function attachExecuteHandlers() {
  elements.executeButton.onclick = handleExecute;
  elements.cancelButton.onclick = handleCancel;
}

export function setupProgressListener() {
  window.igent.onProgress(updateProgress);
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

async function handlePlan() {
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

function displayPlan(plan) {
  const commands = plan.commands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n');

  elements.commandsDisplay.innerHTML =
    `<div><span class="plan-label">Server:</span> ${escapeHTML(plan.serverKey)}</div>` +
    `<div><span class="plan-label">Directory:</span> ${escapeHTML(plan.directory)}</div>` +
    `<div><span class="plan-label">Branch:</span> ${escapeHTML(plan.branch)}</div>` +
    `<div style="margin-top: 8px;"><span class="plan-label">Commands:</span></div>` +
    `<div style="margin-top: 4px;">${escapeHTML(commands)}</div>`;

  attachExecuteHandlers();
  showSection(elements.statusSection);
  elements.executeButton.disabled = false;
  elements.cancelButton.disabled = false;
  scrollToElement(elements.statusSection);
}

function handleCancel() {
  state.currentPlan = null;
  hideSection(elements.statusSection);
}

async function handleExecute() {
  if (!state.currentPlan) {
    showError('No plan available', new Error('Please create a plan first'));
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
