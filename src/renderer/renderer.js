const state = {
  servers: {},
  currentPlan: null,
  isExecuting: false,
};

const elements = {
  serverSelect: document.getElementById('server'),
  directorySelect: document.getElementById('directory'),
  branchInput: document.getElementById('branch'),
  deployButton: document.getElementById('deploy'),
  statusSection: document.getElementById('status'),
  commandsDisplay: document.getElementById('commands'),
  executeButton: document.getElementById('execute'),
  cancelButton: document.getElementById('cancel'),
  resultSection: document.getElementById('result'),
  outputDisplay: document.getElementById('output'),
};

async function initialize() {
  await loadServers();
  attachEventListeners();
  console.log('[Renderer] Application initialized');
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
  elements.statusSection.style.display = 'none';
  elements.resultSection.style.display = 'block';
  elements.resultSection.style.background = '#d4edda';
  elements.resultSection.style.color = '#155724';
  elements.resultSection.style.borderLeft = '4px solid #28a745';

  elements.outputDisplay.innerText =
    '✓ DEPLOYMENT SUCCESSFUL\n\n' +
    (result.stdout || 'Deployment completed without output');
}

function displayError(error) {
  elements.statusSection.style.display = 'none';
  elements.resultSection.style.display = 'block';
  elements.resultSection.style.background = '#f8d7da';
  elements.resultSection.style.color = '#721c24';
  elements.resultSection.style.borderLeft = '4px solid #dc3545';

  let errorMessage = '✗ DEPLOYMENT FAILED\n\n';

  if (error.stderr) {
    errorMessage += `Error Output:\n${error.stderr}\n\n`;
  }

  if (error.stdout) {
    errorMessage += `Standard Output:\n${error.stdout}\n\n`;
  }

  if (error.error) {
    errorMessage += `Error: ${error.error}\n`;
  }

  if (error.exitCode) {
    errorMessage += `Exit Code: ${error.exitCode}\n`;
  }

  if (!error.stderr && !error.stdout && !error.error) {
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
  elements.resultSection.style.display = 'none';
  state.currentPlan = null;
}

initialize();
