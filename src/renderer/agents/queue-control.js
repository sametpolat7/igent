import {
  state,
  elements,
  PROGRESS_GRADIENTS,
  STEP_STATUS_MAP,
  RESULT_STYLES,
  createOption,
  showSection,
  hideSection,
  scrollToElement,
  escapeHTML,
  createStepHTML,
} from '../index.js';

export function attachEventListeners() {
  elements.queueServerSelect.addEventListener('change', handleServerChange);
  elements.queueDirectorySelect.addEventListener(
    'change',
    handleDirectoryChange
  );
  elements.queueCheckButton.addEventListener('click', handleCheck);
  elements.queueStartButton.addEventListener('click', () =>
    handleAction('start')
  );
  elements.queueStopButton.addEventListener('click', () =>
    handleAction('stop')
  );
  elements.queueRestartButton.addEventListener('click', () =>
    handleAction('restart')
  );
}

export function setupProgressListener() {
  window.igent.queue.onProgress(updateProgress);
}

function handleServerChange(e) {
  const serverKey = e.target.value;

  elements.queueDirectorySelect.innerHTML =
    '<option value="">Select directory...</option>';
  elements.queueDirectorySelect.disabled = true;
  resetStatus();
  setButtonsState(false);
  hideResults();

  if (serverKey && state.servers[serverKey]) {
    state.servers[serverKey].allowedDirectories.forEach((dir) => {
      elements.queueDirectorySelect.appendChild(createOption(dir, dir));
    });
    elements.queueDirectorySelect.disabled = false;
  }
}

function handleDirectoryChange() {
  const hasSelection =
    elements.queueServerSelect.value && elements.queueDirectorySelect.value;
  elements.queueCheckButton.disabled = !hasSelection;

  if (hasSelection) {
    updateStatusDisplay(
      'unknown',
      'Click "Check Status" to fetch current state'
    );
    elements.queueProcessInfo.innerHTML = '';
  } else {
    resetStatus();
  }

  setButtonsState(false);
  hideResults();
}

async function handleCheck() {
  const serverKey = elements.queueServerSelect.value;
  const directory = elements.queueDirectorySelect.value;

  if (!serverKey || !directory) return;

  elements.queueCheckButton.disabled = true;
  updateStatusDisplay('checking', 'Checking status...');

  try {
    const result = await window.igent.queue.checkStatus({
      serverKey,
      directory,
    });
    state.queueStatus = result;
    displayStatus(result);
    updateActionButtons(result);
  } catch (error) {
    updateStatusDisplay('error', `Failed to check status: ${error.message}`);
    setButtonsState(false);
  } finally {
    elements.queueCheckButton.disabled = false;
  }
}

function displayStatus(status) {
  if (status.isRunning) {
    updateStatusDisplay('running', 'Queue is OPEN (Sidekiq running)');

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
    updateStatusDisplay('stopped', 'Queue is CLOSED (No Sidekiq process)');
    elements.queueProcessInfo.innerHTML = '';
  }
}

function updateStatusDisplay(status, text) {
  const indicator = elements.queueStatusDisplay.querySelector(
    '.queue-status-indicator'
  );
  indicator.className = `queue-status-indicator ${status}`;
  indicator.querySelector('.status-text').textContent = text;
}

function updateActionButtons(status) {
  if (state.isQueueExecuting) return;

  const isRunning = status?.isRunning || false;

  elements.queueStartButton.disabled = isRunning;
  elements.queueStopButton.disabled = !isRunning;
  elements.queueRestartButton.disabled = false;
}

function setButtonsState(enabled) {
  elements.queueStartButton.disabled = !enabled;
  elements.queueStopButton.disabled = !enabled;
  elements.queueRestartButton.disabled = !enabled;
}

function resetStatus() {
  state.queueStatus = null;
  updateStatusDisplay('unknown', 'Select server and directory');
  elements.queueProcessInfo.innerHTML = '';
  elements.queueCheckButton.disabled = true;
}

async function handleAction(action) {
  const serverKey = elements.queueServerSelect.value;
  const directory = elements.queueDirectorySelect.value;

  if (!serverKey || !directory) return;

  setExecutionState(true);
  resetProgress();

  try {
    const plan = await window.igent.queue.plan({
      serverKey,
      directory,
      action,
    });
    state.queuePlan = plan;

    const result = await window.igent.queue.execute(plan);

    if (result.success === false) {
      displayError(result);
    } else {
      displaySuccess(result);
    }

    state.lastQueueResult = result;
  } catch (error) {
    displayError(error);
    state.lastQueueResult = null;
  } finally {
    setExecutionState(false);

    if (state.lastQueueResult?.queueStatus) {
      state.queueStatus = state.lastQueueResult.queueStatus;
      displayStatus(state.lastQueueResult.queueStatus);
      updateActionButtons(state.lastQueueResult.queueStatus);
    } else if (state.lastQueueResult) {
      await handleCheck();
    }
  }
}

function setExecutionState(isExecuting) {
  state.isQueueExecuting = isExecuting;
  elements.queueCheckButton.disabled = isExecuting;
  elements.queueStartButton.disabled = isExecuting;
  elements.queueStopButton.disabled = isExecuting;
  elements.queueRestartButton.disabled = isExecuting;
  elements.queueServerSelect.disabled = isExecuting;
  elements.queueDirectorySelect.disabled = isExecuting;
}

function resetProgress() {
  hideSection(elements.queueResultSection);
  showSection(elements.queueProgressSection);

  elements.queueProgressSteps.innerHTML = '';
  setProgressBar(0);
}

function setProgressBar(percentage, gradient = null) {
  elements.queueProgressBar.style.width = `${percentage}%`;
  elements.queueProgressPercentage.textContent = `${percentage}%`;
  if (gradient) elements.queueProgressBar.style.background = gradient;
}

function updateProgress(data) {
  const { status, currentStep, totalSteps } = data;

  if (totalSteps > 0) {
    const completed =
      status === 'running' ? Math.max(0, currentStep - 1) : currentStep || 0;
    setProgressBar(Math.round((completed / totalSteps) * 100));
  }

  const handlers = {
    started: () => (elements.queueProgressSteps.innerHTML = ''),
    running: () => updateStepDisplay(data),
    'step-complete': () => updateStepDisplay(data),
    'step-failed': () => updateStepDisplay(data),
    completed: () => setProgressBar(100, PROGRESS_GRADIENTS.success),
    failed: () =>
      setProgressBar(
        parseInt(elements.queueProgressPercentage.textContent),
        PROGRESS_GRADIENTS.error
      ),
  };

  handlers[status]?.();
}

function updateStepDisplay(data) {
  const { currentStep, command, status, duration, error, stderr } = data;
  const stepElement = getOrCreateStepElement(
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

function getOrCreateStepElement(stepId, className) {
  let element = document.getElementById(stepId);
  if (!element) {
    element = document.createElement('div');
    element.id = stepId;
    element.className = className;
    elements.queueProgressSteps.appendChild(element);
  }
  return element;
}

function displaySuccess(result) {
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

  showResultSection('success', message);
}

function displayError(error) {
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

  showResultSection('error', parts);
}

function showResultSection(type, message) {
  const styles = RESULT_STYLES[type];
  showSection(elements.queueResultSection);
  Object.assign(elements.queueResultSection.style, styles);
  elements.queueOutputDisplay.textContent = message;
  elements.queueOutputDisplay.style.color = '#e5e7eb';
  scrollToElement(elements.queueResultSection);
}

function hideResults() {
  hideSection(elements.queueProgressSection);
  hideSection(elements.queueResultSection);
}
