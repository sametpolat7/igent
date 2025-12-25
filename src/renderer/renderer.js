const state = {
  servers: {},
  currentPlan: null,
  isExecuting: false,
  currentView: 'server-update',
};

const elements = {
  navTabs: document.querySelectorAll('.nav-tab'),
  viewContainers: document.querySelectorAll('.view-container'),
  clock: document.getElementById('clock'),
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

async function initialize() {
  setupViewSwitching();
  await loadServers();
  attachEventListeners();
  setupProgressListener();
  startClock();
}

function startClock() {
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    elements.clock.textContent = `${hours}:${minutes}:${seconds}`;
  }
  updateClock();
  setInterval(updateClock, 1000);
}

function setupViewSwitching() {
  elements.navTabs.forEach((tab) => {
    tab.addEventListener('click', (event) => {
      const targetView = event.target.dataset.view;
      switchView(targetView);
    });
  });
}

function switchView(viewName) {
  state.currentView = viewName;

  elements.navTabs.forEach((tab) => {
    if (tab.dataset.view === viewName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  elements.viewContainers.forEach((container) => {
    if (container.id === `view-${viewName}`) {
      container.classList.add('active');
    } else {
      container.classList.remove('active');
    }
  });
}

async function loadServers() {
  try {
    state.servers = await window.igent.getServers();

    Object.keys(state.servers).forEach((serverKey) => {
      const option = document.createElement('option');
      option.value = serverKey;
      option.textContent = serverKey;
      elements.serverSelect.appendChild(option);
    });
  } catch (error) {
    showError('Failed to load server configuration', error);
  }
}

function attachEventListeners() {
  elements.serverSelect.addEventListener('change', handleServerChange);
  elements.directorySelect.addEventListener('change', validateForm);
  elements.branchInput.addEventListener('input', validateForm);
  elements.planButton.addEventListener('click', handleUpdate);
  elements.executeButton.addEventListener('click', handleExecute);
  elements.cancelButton.addEventListener('click', handleCancel);
}

function handleServerChange(event) {
  const serverKey = event.target.value;

  elements.directorySelect.innerHTML =
    '<option value="">Select directory...</option>';
  elements.directorySelect.disabled = true;
  elements.planButton.disabled = true;

  hideResults();

  if (serverKey && state.servers[serverKey]) {
    const directories = state.servers[serverKey].allowedDirectories;

    directories.forEach((directory) => {
      const option = document.createElement('option');
      option.value = directory;
      option.textContent = directory;
      elements.directorySelect.appendChild(option);
    });

    elements.directorySelect.disabled = false;
  }
}

function validateForm() {
  const server = elements.serverSelect.value;
  const directory = elements.directorySelect.value;
  const branch = elements.branchInput.value.trim();

  const isValid = server && directory && branch;
  elements.planButton.disabled = !isValid;
}

async function handleUpdate() {
  const serverKey = elements.serverSelect.value;
  const directory = elements.directorySelect.value;
  const branch = elements.branchInput.value.trim();

  hideResults();

  elements.planButton.disabled = true;

  try {
    state.currentPlan = await window.igent.plan({
      serverKey,
      directory,
      branch,
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

  state.isExecuting = true;
  elements.executeButton.disabled = true;
  elements.cancelButton.disabled = true;
  elements.planButton.disabled = true;

  elements.statusSection.style.display = 'none';
  elements.resultSection.style.display = 'none';
  elements.progressSection.style.display = 'block';
  elements.progressSteps.innerHTML = '';
  elements.progressBar.style.width = '0%';
  elements.progressPercentage.textContent = '0%';

  elements.progressWrapper.style.display = 'flex';
  const conflictHeader = document.getElementById('conflict-header');
  if (conflictHeader) {
    conflictHeader.style.display = 'none';
  }

  setTimeout(() => {
    elements.progressSection.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, 100);

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
    state.isExecuting = false;
    validateForm();
  }
}

function handleCancel() {
  state.currentPlan = null;
  elements.statusSection.style.display = 'none';
}

function setupProgressListener() {
  window.igent.onProgress((progressData) => {
    updateProgress(progressData);
  });
}

function updateProgress(data) {
  const { status, currentStep, totalSteps } = data;

  if (totalSteps > 0) {
    let completedSteps = currentStep || 0;

    if (status === 'running') {
      completedSteps = Math.max(0, currentStep - 1);
    }

    const percentage = Math.round((completedSteps / totalSteps) * 100);
    elements.progressBar.style.width = `${percentage}%`;
    elements.progressPercentage.textContent = `${percentage}%`;
  }

  switch (status) {
    case 'started':
      elements.progressSteps.innerHTML = '';
      break;

    case 'running':
    case 'step-complete':
    case 'step-failed':
      updateStepDisplay(data);
      break;

    case 'conflict-detected':
      displayConflictStep(data);
      elements.progressWrapper.style.display = 'none';
      displayConflictHeader();
      break;

    case 'rollback-running':
    case 'rollback-step-complete':
    case 'rollback-step-warning':
      displayRollbackStep(data);
      break;

    case 'rollback-completed':
      displayRollbackComplete(data);
      break;

    case 'completed':
      elements.progressBar.style.width = '100%';
      elements.progressPercentage.textContent = '100%';
      elements.progressBar.style.background =
        'linear-gradient(90deg, #10b981 0%, #059669 100%)';
      break;

    case 'failed':
      elements.progressBar.style.background =
        'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
      break;
  }
}

function updateStepDisplay(data) {
  const { currentStep, command, status, duration, error, stderr } = data;
  const stepId = `step-${currentStep}`;
  const stepElement = getOrCreateStepElement(stepId, 'progress-step');

  let stepClass = 'progress-step';
  let statusText = 'Running';

  if (status === 'running') {
    stepClass += ' running';
    statusText = 'Running';
  } else if (status === 'step-complete') {
    stepClass += ' success';
    statusText = 'Completed';
  } else if (status === 'step-failed') {
    stepClass += ' failed';
    statusText = 'Failed';
  }

  stepElement.className = stepClass;

  let content = `
    <div class="progress-step-header">
      <span><strong>${statusText}</strong> Step ${currentStep}</span>
      ${duration ? `<span class="progress-step-time">${duration}s</span>` : ''}
    </div>
    <div class="progress-step-command">${command}</div>
  `;

  if (status === 'step-failed') {
    content += `<div style="color: #e53e3e; font-size: 11px; margin-top: 4px;">Error: ${error || stderr}</div>`;
  }

  stepElement.innerHTML = content;
  stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function displayConflictStep(data) {
  const { currentStep, conflictType, totalSteps } = data;
  const stepElement = getOrCreateStepElement(
    'step-conflict',
    'progress-step conflict'
  );

  const conflictLabel = getConflictLabel(conflictType);

  stepElement.innerHTML = `
    <div class="progress-step-header">
      <span><strong>CONFLICT DETECTED</strong> at Step ${currentStep}/${totalSteps}</span>
    </div>
    <div class="progress-step-command">${conflictLabel}</div>
    <div class="progress-step-info">Starting automatic rollback...</div>
  `;

  stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function displayRollbackStep(data) {
  const { rollbackStep, totalRollbackSteps, command, status, duration } = data;
  const stepId = `rollback-step-${rollbackStep}`;
  const stepElement = getOrCreateStepElement(stepId, 'progress-step rollback');

  let stepClass = 'progress-step rollback';
  let statusText = 'Rolling back';

  if (status === 'rollback-running') {
    stepClass += ' rollback-running';
    statusText = 'Rolling back';
  } else if (status === 'rollback-step-complete') {
    stepClass += ' rollback-complete';
    statusText = 'Rolled back';
  } else if (status === 'rollback-step-warning') {
    stepClass += ' rollback-warning';
    statusText = 'Rolled back with warning';
  }

  stepElement.className = stepClass;

  stepElement.innerHTML = `
    <div class="progress-step-header">
      <span><strong>${statusText}</strong> Step ${rollbackStep}/${totalRollbackSteps}</span>
      ${duration ? `<span class="progress-step-time">${duration}s</span>` : ''}
    </div>
    <div class="progress-step-command">${command}</div>
  `;

  stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function getConflictLabel(conflictType) {
  const labels = {
    UNMERGED_INDEX: 'Repository has unmerged paths that block stashing',
    STASH_CONFLICT: 'Stashed changes conflict with pulled updates',
    MERGE_CONFLICT: 'Local and remote branches have conflicting changes',
    UNMERGED_FILE: 'Index contains unmerged files after stash pop',
  };
  return labels[conflictType] || `Git conflict: ${conflictType}`;
}

function displayConflictHeader() {
  let conflictHeader = document.getElementById('conflict-header');

  if (!conflictHeader) {
    conflictHeader = document.createElement('div');
    conflictHeader.id = 'conflict-header';
    conflictHeader.className = 'conflict-header';

    elements.progressSection
      .querySelector('h3')
      .insertAdjacentElement('afterend', conflictHeader);
  }

  conflictHeader.innerHTML = `
    <div class="conflict-title">CONFLICT!</div>
    <div class="conflict-subtitle">Rollback Started...</div>
  `;

  conflictHeader.style.display = 'flex';
}

function cleanErrorMessage(message) {
  if (!message) return '';
  return message
    .replace(/^Error invoking remote method '[^']+': /, '')
    .replace(/^Error: /, '')
    .replace(/^Execution error: /, '');
}

function displayPlan(plan) {
  elements.commandsDisplay.innerHTML =
    `<strong>Server:</strong> ${plan.serverKey}\n` +
    `<strong>Directory:</strong> ${plan.directory}\n` +
    `<strong>Branch:</strong> ${plan.branch}\n\n` +
    `<strong>Commands:</strong>\n${plan.commands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}`;

  elements.statusSection.style.display = 'block';
  elements.executeButton.disabled = false;
  elements.cancelButton.disabled = false;
  scrollToElement(elements.statusSection);
}

function displaySuccess(result) {
  elements.progressSection.style.display = 'none';
  elements.statusSection.style.display = 'none';
  elements.resultSection.style.display = 'block';
  elements.resultSection.style.background = '#10b981';
  elements.resultSection.style.color = '#ffffff';
  elements.resultSection.style.borderColor = '#059669';

  elements.outputDisplay.innerHTML = `Completed ${result.totalSteps} steps in ${result.totalDuration}s`;
  elements.outputDisplay.style.color = '#e5e7eb';
  scrollToElement(elements.resultSection);
}

function displayError(error) {
  elements.progressSection.style.display = 'none';
  elements.statusSection.style.display = 'none';
  elements.resultSection.style.display = 'block';

  if (error.isConflict) {
    elements.resultSection.style.background = '#fbbf24';
    elements.resultSection.style.color = '#ffffff';
    elements.resultSection.style.borderColor = '#f59e0b';

    let conflictMessage = cleanErrorMessage(error.message || error.error);

    elements.outputDisplay.innerHTML = conflictMessage;
    elements.outputDisplay.style.color = '#e5e7eb';
  } else {
    elements.resultSection.style.background = '#ef4444';
    elements.resultSection.style.color = '#ffffff';
    elements.resultSection.style.borderColor = '#dc2626';

    let errorMessage = '';

    if (error.failedAtStep && error.failedCommand) {
      errorMessage += `Failed at Step ${error.failedAtStep}/${error.totalSteps}\n`;
      errorMessage += `Command: ${error.failedCommand}\n`;
      errorMessage += `Duration: ${error.totalDuration}s\n\n`;
    }

    if (error.stderr) {
      errorMessage += `Error Output:\n${error.stderr}\n\n`;
    }

    if (error.error) {
      errorMessage += `Message: ${cleanErrorMessage(error.error)}\n`;
    }

    if (error.exitCode) {
      errorMessage += `Exit Code: ${error.exitCode}\n`;
    }

    if (!error.stderr && !error.error) {
      errorMessage +=
        cleanErrorMessage(error.message) || 'Unknown error occurred';
    }

    elements.outputDisplay.innerHTML = errorMessage;
    elements.outputDisplay.style.color = '#e5e7eb';
  }

  scrollToElement(elements.resultSection);
}

function showError(title, error) {
  elements.resultSection.style.display = 'block';
  elements.resultSection.style.background = '#fee2e2';
  elements.resultSection.style.color = '#991b1b';

  elements.outputDisplay.innerText = `${title}\n\n${error.message || error}`;
}

function hideResults() {
  elements.statusSection.style.display = 'none';
  elements.progressSection.style.display = 'none';
  elements.resultSection.style.display = 'none';
  state.currentPlan = null;
}

function getOrCreateStepElement(stepId, className) {
  let stepElement = document.getElementById(stepId);
  if (!stepElement) {
    stepElement = document.createElement('div');
    stepElement.id = stepId;
    stepElement.className = className;
    elements.progressSteps.appendChild(stepElement);
  }
  return stepElement;
}

function scrollToElement(element) {
  setTimeout(() => {
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

initialize();
