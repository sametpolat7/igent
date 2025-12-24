const state = {
  servers: {},
  currentPlan: null,
  isExecuting: false,
  currentView: 'server-update',
};

const elements = {
  // Navigation
  navTabs: document.querySelectorAll('.nav-tab'),
  viewContainers: document.querySelectorAll('.view-container'),

  // Clock
  clock: document.getElementById('clock'),

  // Server Update View
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
  console.log('[Renderer] Application initialized');
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
  // Update state
  state.currentView = viewName;

  // Update tab active states
  elements.navTabs.forEach((tab) => {
    if (tab.dataset.view === viewName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update view container active states
  elements.viewContainers.forEach((container) => {
    if (container.id === `view-${viewName}`) {
      container.classList.add('active');
    } else {
      container.classList.remove('active');
    }
  });

  console.log(`[Renderer] Switched to view: ${viewName}`);
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

    console.log('[Renderer] Servers loaded:', Object.keys(state.servers));
  } catch (error) {
    showError('Failed to load servers', error);
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
    '<option value="">Select a directory...</option>';
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

    console.log('[Renderer] Plan created:', state.currentPlan);

    displayPlan(state.currentPlan);
  } catch (error) {
    showError('Planning failed', error);
  } finally {
    validateForm();
  }
}

async function handleExecute() {
  if (!state.currentPlan) {
    showError('No update plan', new Error('Please plan update first'));
    return;
  }

  state.isExecuting = true;
  elements.executeButton.disabled = true;
  elements.cancelButton.disabled = true;
  elements.planButton.disabled = true;

  // Hide plan section, results and show progress
  elements.statusSection.style.display = 'none';
  elements.resultSection.style.display = 'none';
  elements.progressSection.style.display = 'block';
  elements.progressSteps.innerHTML = '';
  elements.progressBar.style.width = '0%';
  elements.progressPercentage.textContent = '0%';

  // Smooth scroll to progress section
  setTimeout(() => {
    elements.progressSection.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, 100);

  try {
    console.log('[Renderer] Starting execution...');

    const result = await window.igent.execute(state.currentPlan);

    console.log('[Renderer] Execution completed:', result);

    displaySuccess(result);
  } catch (error) {
    console.error('[Renderer] Execution failed:', error);

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
    console.log('[Renderer] Progress update:', progressData);
    updateProgress(progressData);
  });
}

function updateProgress(data) {
  const { status, currentStep, totalSteps } = data;

  // Update progress bar
  if (totalSteps > 0) {
    let completedSteps = currentStep || 0;

    // If currently running a step, show progress up to but not including this step
    if (status === 'running') {
      completedSteps = Math.max(0, currentStep - 1);
    }

    const percentage = Math.round((completedSteps / totalSteps) * 100);
    elements.progressBar.style.width = `${percentage}%`;
    elements.progressPercentage.textContent = `${percentage}%`;
  }

  // Handle different statuses
  switch (status) {
    case 'started':
      elements.progressSteps.innerHTML = '';
      break;

    case 'running':
    case 'step-complete':
    case 'step-failed':
      updateStepDisplay(data);
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

  let stepElement = document.getElementById(stepId);

  if (!stepElement) {
    stepElement = document.createElement('div');
    stepElement.id = stepId;
    stepElement.className = 'progress-step';
    elements.progressSteps.appendChild(stepElement);
  }

  // Determine step status class
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

  // Build step content
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

  // Auto-scroll to latest step
  stepElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  // Smooth scroll to status section
  setTimeout(() => {
    elements.statusSection.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, 100);
}

function displaySuccess(result) {
  elements.progressSection.style.display = 'none';
  elements.statusSection.style.display = 'none';
  elements.resultSection.style.display = 'block';
  elements.resultSection.style.background = '#d1fae5';
  elements.resultSection.style.color = '#065f46';

  let output = '<strong>Process Successful</strong>\n\n';
  output += `Completed ${result.totalSteps} steps in ${result.totalDuration}s`;

  elements.outputDisplay.innerHTML = output;

  // Smooth scroll to result section
  setTimeout(() => {
    elements.resultSection.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, 100);
}

function displayError(error) {
  elements.progressSection.style.display = 'none';
  elements.statusSection.style.display = 'none';
  elements.resultSection.style.display = 'block';
  elements.resultSection.style.background = '#fee2e2';
  elements.resultSection.style.color = '#991b1b';

  let errorMessage = '<strong>Process Failed</strong>\n\n';

  if (error.failedAtStep && error.failedCommand) {
    errorMessage += `Failed at Step ${error.failedAtStep}/${error.totalSteps}\n`;
    errorMessage += `Command: ${error.failedCommand}\n`;
    errorMessage += `Duration: ${error.totalDuration}s\n\n`;
  }

  if (error.stderr) {
    errorMessage += `Error Output:\n${error.stderr}\n\n`;
  }

  if (error.error) {
    errorMessage += `Message: ${error.error}\n`;
  }

  if (error.exitCode) {
    errorMessage += `Exit Code: ${error.exitCode}\n`;
  }

  if (!error.stderr && !error.error) {
    errorMessage += error.message || 'Unknown error occurred';
  }

  elements.outputDisplay.innerHTML = errorMessage;

  // Smooth scroll to result section
  setTimeout(() => {
    elements.resultSection.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, 100);
}

function showError(title, error) {
  console.error(`[Renderer] ${title}:`, error);

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

initialize();
