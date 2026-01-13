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
  elements.fileEditServerSelect.addEventListener('change', handleServerChange);
  elements.fileEditDirectorySelect.addEventListener(
    'change',
    handleDirectoryChange
  );
  elements.fileEditFunctionSelect.addEventListener(
    'change',
    handleFunctionChange
  );
  elements.fileEditPlanButton.addEventListener('click', handlePlan);
  elements.fileEditExecuteButton.addEventListener('click', handleExecute);
  elements.fileEditCancelButton.addEventListener('click', handleCancel);
  elements.fileEditRestoreButton.addEventListener('click', handleRestore);
}

export function setupProgressListener() {
  window.igent.fileEdit.onProgress(updateProgress);
}

function handleServerChange(e) {
  const serverKey = e.target.value;

  elements.fileEditDirectorySelect.innerHTML =
    '<option value="">Select directory...</option>';
  elements.fileEditDirectorySelect.disabled = true;
  elements.fileEditFunctionSelect.innerHTML =
    '<option value="">Select a function...</option>';
  elements.fileEditFunctionSelect.disabled = true;
  elements.fileEditInputsContainer.innerHTML = '';
  elements.fileEditPlanButton.disabled = true;
  resetRestoreStatus();
  hideResults();

  if (serverKey && state.servers[serverKey]) {
    state.servers[serverKey].allowedDirectories.forEach((dir) => {
      elements.fileEditDirectorySelect.appendChild(createOption(dir, dir));
    });
    elements.fileEditDirectorySelect.disabled = false;
  }
}

function handleDirectoryChange() {
  const hasSelection =
    elements.fileEditServerSelect.value &&
    elements.fileEditDirectorySelect.value;

  elements.fileEditFunctionSelect.innerHTML =
    '<option value="">Select a function...</option>';
  elements.fileEditFunctionSelect.disabled = true;
  elements.fileEditInputsContainer.innerHTML = '';
  elements.fileEditPlanButton.disabled = true;
  resetRestoreStatus();
  hideResults();

  if (hasSelection) {
    Object.entries(state.fileEditConfigs).forEach(([id, func]) => {
      elements.fileEditFunctionSelect.appendChild(createOption(id, func.name));
    });
    elements.fileEditFunctionSelect.disabled = false;
  }
}

function handleFunctionChange() {
  const functionId = elements.fileEditFunctionSelect.value;

  elements.fileEditInputsContainer.innerHTML = '';
  elements.fileEditPlanButton.disabled = true;
  resetRestoreStatus();
  hideResults();

  if (functionId && state.fileEditConfigs[functionId]) {
    const funcConfig = state.fileEditConfigs[functionId];
    renderInputs(funcConfig);
    validateForm();
    checkChanges(funcConfig.targetFile);
  }
}

function renderInputs(funcConfig) {
  if (!funcConfig.inputs || funcConfig.inputs.length === 0) {
    validateForm();
    return;
  }

  const infoDiv = document.createElement('div');
  infoDiv.className = 'file-edit-info';
  infoDiv.innerHTML = `
    <div class="file-edit-target">
      <span class="label">Target File:</span>
      <span class="value">${escapeHTML(funcConfig.targetFile)}</span>
    </div>
  `;
  elements.fileEditInputsContainer.appendChild(infoDiv);

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

    input.addEventListener('input', validateForm);

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    elements.fileEditInputsContainer.appendChild(formGroup);
  }
}

function validateForm() {
  const hasServer = elements.fileEditServerSelect.value;
  const hasDirectory = elements.fileEditDirectorySelect.value;
  const hasFunction = elements.fileEditFunctionSelect.value;

  if (!hasServer || !hasDirectory || !hasFunction) {
    elements.fileEditPlanButton.disabled = true;
    return;
  }

  const funcConfig = state.fileEditConfigs[hasFunction];
  if (!funcConfig) {
    elements.fileEditPlanButton.disabled = true;
    return;
  }

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

function getInputValues() {
  const inputs = elements.fileEditInputsContainer.querySelectorAll(
    'input[data-input-key]'
  );
  const values = {};

  inputs.forEach((input) => {
    values[input.dataset.inputKey] = input.value.trim();
  });

  return values;
}

async function handlePlan() {
  hideResults();
  elements.fileEditPlanButton.disabled = true;

  try {
    state.fileEditPlan = await window.igent.fileEdit.plan({
      serverKey: elements.fileEditServerSelect.value,
      directory: elements.fileEditDirectorySelect.value,
      functionId: elements.fileEditFunctionSelect.value,
      inputs: getInputValues(),
    });
    displayPlan(state.fileEditPlan);
  } catch (error) {
    showError('Planning failed', error);
  } finally {
    validateForm();
  }
}

function displayPlan(plan) {
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

function handleCancel() {
  state.fileEditPlan = null;
  hideSection(elements.fileEditStatusSection);
}

async function handleExecute() {
  if (!state.fileEditPlan) {
    showError('No plan available', new Error('Please create a plan first'));
    return;
  }

  setExecutionState(true);
  resetProgress();
  scrollToElement(elements.fileEditProgressSection);

  try {
    const result = await window.igent.fileEdit.execute(state.fileEditPlan);
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
  state.isFileEditExecuting = isExecuting;
  elements.fileEditExecuteButton.disabled = isExecuting;
  elements.fileEditCancelButton.disabled = isExecuting;
  elements.fileEditPlanButton.disabled = isExecuting;
  elements.fileEditServerSelect.disabled = isExecuting;
  elements.fileEditDirectorySelect.disabled = isExecuting;
  elements.fileEditFunctionSelect.disabled = isExecuting;

  const inputs = elements.fileEditInputsContainer.querySelectorAll('input');
  inputs.forEach((input) => (input.disabled = isExecuting));

  if (!isExecuting) validateForm();
}

function resetProgress() {
  hideSection(elements.fileEditStatusSection);
  hideSection(elements.fileEditResultSection);
  showSection(elements.fileEditProgressSection);

  elements.fileEditProgressSteps.innerHTML = '';
  setProgressBar(0);
}

function setProgressBar(percentage, gradient = null) {
  elements.fileEditProgressBar.style.width = `${percentage}%`;
  elements.fileEditProgressPercentage.textContent = `${percentage}%`;
  if (gradient) elements.fileEditProgressBar.style.background = gradient;
}

function updateProgress(data) {
  const { status, currentStep, totalSteps } = data;

  if (totalSteps > 0) {
    const completed =
      status === 'running' ? Math.max(0, currentStep - 1) : currentStep || 0;
    setProgressBar(Math.round((completed / totalSteps) * 100));
  }

  const handlers = {
    started: () => (elements.fileEditProgressSteps.innerHTML = ''),
    running: () => updateStepDisplay(data),
    'step-complete': () => updateStepDisplay(data),
    'step-failed': () => updateStepDisplay(data),
    completed: () => setProgressBar(100, PROGRESS_GRADIENTS.success),
    failed: () =>
      setProgressBar(
        parseInt(elements.fileEditProgressPercentage.textContent),
        PROGRESS_GRADIENTS.error
      ),
  };

  handlers[status]?.();
}

function updateStepDisplay(data) {
  const { currentStep, command, status, duration, error, stderr } = data;
  const stepElement = getOrCreateStepElement(
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

function getOrCreateStepElement(stepId, className) {
  let element = document.getElementById(stepId);
  if (!element) {
    element = document.createElement('div');
    element.id = stepId;
    element.className = className;
    elements.fileEditProgressSteps.appendChild(element);
  }
  return element;
}

function displaySuccess(result) {
  hideSection(elements.fileEditProgressSection);
  hideSection(elements.fileEditStatusSection);

  let message = `${result.functionName} completed successfully in ${result.totalDuration}s`;

  if (result.output) {
    message += `\n\nOutput:\n${result.output}`;
  }

  showResultSection('success', message);

  refreshRestoreStatus();
}

function displayError(error) {
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

  showResultSection('error', parts);
}

function showError(title, error) {
  showResultSection('warning', `${title}\n\n${error.message || error}`);
}

function showResultSection(type, message) {
  const styles = RESULT_STYLES[type];
  showSection(elements.fileEditResultSection);
  Object.assign(elements.fileEditResultSection.style, styles);
  elements.fileEditOutputDisplay.textContent = message;
  elements.fileEditOutputDisplay.style.color = '#e5e7eb';
  scrollToElement(elements.fileEditResultSection);
}

function hideResults() {
  hideSection(elements.fileEditStatusSection);
  hideSection(elements.fileEditProgressSection);
  hideSection(elements.fileEditResultSection);
  state.fileEditPlan = null;
}

function resetRestoreStatus() {
  state.fileEditHasChanges = false;
  elements.fileEditRestoreButton.disabled = true;
  elements.fileEditRestoreStatus.textContent =
    'Select a function to check for changes';
  elements.fileEditRestoreStatus.className = 'restore-status-text';
  elements.fileEditRestoreSection.className = 'file-edit-restore-section';
}

async function checkChanges(targetFile) {
  const serverKey = elements.fileEditServerSelect.value;
  const directory = elements.fileEditDirectorySelect.value;

  if (!serverKey || !directory || !targetFile) {
    resetRestoreStatus();
    return;
  }

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

async function handleRestore() {
  const functionId = elements.fileEditFunctionSelect.value;
  const funcConfig = state.fileEditConfigs[functionId];

  if (!funcConfig) return;

  const targetFile = funcConfig.targetFile;
  if (!targetFile) return;

  await checkChanges(targetFile);
  if (!state.fileEditHasChanges) {
    return;
  }

  const serverKey = elements.fileEditServerSelect.value;
  const directory = elements.fileEditDirectorySelect.value;

  elements.fileEditRestoreButton.disabled = true;
  elements.fileEditPlanButton.disabled = true;
  elements.fileEditRestoreStatus.textContent = 'Restoring file...';
  elements.fileEditRestoreStatus.className = 'restore-status-text checking';

  resetProgress();
  window.igent.fileEdit.onRestoreProgress(updateProgress);

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

      displayRestoreSuccess(result);

      setTimeout(() => {
        checkChanges(targetFile);
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

  validateForm();
}

function displayRestoreSuccess(result) {
  hideSection(elements.fileEditProgressSection);
  const message = `File restored and service restarted successfully!\n\nDuration: ${result.totalDuration}s\nTarget: ${result.targetFile}`;
  showResultSection('success', message);
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

  showResultSection('error', parts);
}

function refreshRestoreStatus() {
  const functionId = elements.fileEditFunctionSelect.value;
  if (functionId && state.fileEditConfigs[functionId]) {
    const funcConfig = state.fileEditConfigs[functionId];
    checkChanges(funcConfig.targetFile);
  }
}
