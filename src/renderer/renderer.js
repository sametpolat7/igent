const state = {
  servers: {},
  currentPlan: null,
  isExecuting: false,
  currentView: 'git-deployment',
};

const elements = {
  // Navigation
  navTabs: document.querySelectorAll('.nav-tab'),
  viewContainers: document.querySelectorAll('.view-container'),

  // Git Deployment View
  serverSelect: document.getElementById('server'),
  directorySelect: document.getElementById('directory'),
  branchInput: document.getElementById('branch'),
  deployButton: document.getElementById('deploy'),
  statusSection: document.getElementById('status'),
  commandsDisplay: document.getElementById('commands'),
  executeButton: document.getElementById('execute'),
  cancelButton: document.getElementById('cancel'),
  progressSection: document.getElementById('progress'),
  progressBar: document.getElementById('progress-bar'),
  progressStatus: document.getElementById('progress-status'),
  progressSteps: document.getElementById('progress-steps'),
  resultSection: document.getElementById('result'),
  outputDisplay: document.getElementById('output'),
};

async function initialize() {
  setupViewSwitching();
  await loadServers();
  attachEventListeners();
  setupProgressListener();
  console.log('[Renderer] Application initialized');
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
  elements.deployButton.addEventListener('click', handleDeploy);
  elements.executeButton.addEventListener('click', handleExecute);
  elements.cancelButton.addEventListener('click', handleCancel);
}

function handleServerChange(event) {
  const serverKey = event.target.value;

  elements.directorySelect.innerHTML =
    '<option value="">Select a directory...</option>';
  elements.directorySelect.disabled = true;
  elements.deployButton.disabled = true;

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
  elements.deployButton.disabled = !isValid;
}

async function handleDeploy() {
  const serverKey = elements.serverSelect.value;
  const directory = elements.directorySelect.value;
  const branch = elements.branchInput.value.trim();

  hideResults();

  elements.deployButton.disabled = true;

  try {
    state.currentPlan = await window.igent.planDeploy({
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
    showError('No deployment plan', new Error('Please plan deployment first'));
    return;
  }

  state.isExecuting = true;
  elements.executeButton.disabled = true;
  elements.cancelButton.disabled = true;
  elements.deployButton.disabled = true;

  // Hide results and show progress
  elements.resultSection.style.display = 'none';
  elements.progressSection.style.display = 'block';
  elements.progressSteps.innerHTML = '';
  elements.progressBar.style.width = '0%';
  elements.progressStatus.textContent = 'Initializing...';

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
  const { status, currentStep, totalSteps, message } = data;

  // Update progress bar
  if (totalSteps > 0) {
    const percentage = ((currentStep || 0) / totalSteps) * 100;
    elements.progressBar.style.width = `${percentage}%`;
  }

  // Update status message
  elements.progressStatus.textContent = message;

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
      break;

    case 'failed':
      elements.progressBar.style.width = '100%';
      elements.progressBar.style.background =
        'linear-gradient(90deg, #f56565 0%, #e53e3e 100%)';
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
  elements.commandsDisplay.innerText =
    `Server: ${plan.serverKey}\n` +
    `Directory: ${plan.directory}\n` +
    `Branch: ${plan.branch}\n` +
    `Commands:\n${plan.commands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}`;

  elements.statusSection.style.display = 'block';
  elements.executeButton.disabled = false;
  elements.cancelButton.disabled = false;
}

function displaySuccess(result) {
  elements.progressSection.style.display = 'none';
  elements.statusSection.style.display = 'none';
  elements.resultSection.style.display = 'block';
  elements.resultSection.style.background = '#d4edda';
  elements.resultSection.style.color = '#155724';
  elements.resultSection.style.borderLeft = '4px solid #28a745';

  let output = 'DEPLOYMENT SUCCESSFUL\n\n';
  output += `Completed ${result.totalSteps} steps in ${result.totalDuration}s`;

  elements.outputDisplay.innerText = output;
}

function displayError(error) {
  elements.progressSection.style.display = 'none';
  elements.statusSection.style.display = 'none';
  elements.resultSection.style.display = 'block';
  elements.resultSection.style.background = '#f8d7da';
  elements.resultSection.style.color = '#721c24';
  elements.resultSection.style.borderLeft = '4px solid #dc3545';

  let errorMessage = 'DEPLOYMENT FAILED\n\n';

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

  elements.outputDisplay.innerText = errorMessage;
}

function showError(title, error) {
  console.error(`[Renderer] ${title}:`, error);

  elements.resultSection.style.display = 'block';
  elements.resultSection.style.background = '#f8d7da';
  elements.resultSection.style.color = '#721c24';
  elements.resultSection.style.borderLeft = '4px solid #dc3545';

  elements.outputDisplay.innerText = `${title}\n\n${error.message || error}`;
}

function hideResults() {
  elements.statusSection.style.display = 'none';
  elements.progressSection.style.display = 'none';
  elements.resultSection.style.display = 'none';
  state.currentPlan = null;
}

initialize();
