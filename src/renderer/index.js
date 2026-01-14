// Central entry point for the renderer process.
// Agent-specific logic is delegated to individual agent modules.

import * as ServerUpdateAgent from './agents/server-update.js';
import * as QueueControlAgent from './agents/queue-control.js';
import * as FileEditingAgent from './agents/file-editing.js';

// Shared Application State
export const state = {
  servers: {},

  // Server Update Agent State
  currentPlan: null,
  isExecuting: false,

  // View management
  currentView: 'server-update',

  // Queue Control Agent State
  queuePlan: null,
  queueStatus: null,
  isQueueExecuting: false,
  lastQueueResult: null,

  // File Editing Agent State
  fileEditConfigs: {},
  fileEditPlan: null,
  isFileEditExecuting: false,
  fileEditHasChanges: false,
};

// DOM Element References
export const elements = {
  // Navigation
  navTabs: document.querySelectorAll('.nav-tab'),
  viewContainers: document.querySelectorAll('.view-container'),

  // Server Update View Elements
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

  // Queue Control View Elements
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

  // File Edit View Elements
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

// Shared Constants
export const PROGRESS_GRADIENTS = {
  success: 'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)',
  error: 'linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)',
};

export const RESULT_STYLES = {
  success: {
    background: '#34d399',
    color: '#ffffff',
  },
  conflict: {
    background: '#fdb230',
    color: '#ffffff',
  },
  error: {
    background: '#ef4444',
    color: '#ffffff',
  },
  warning: {
    background: '#fde68a',
    color: '#78350f',
  },
};

export const CONFLICT_LABELS = {
  UNMERGED_INDEX: 'Repository has unmerged paths that block stashing',
  STASH_CONFLICT: 'Stashed changes conflict with pulled updates',
  MERGE_CONFLICT: 'Local and remote branches have conflicting changes',
  UNMERGED_FILE: 'Index contains unmerged files after stash pop',
};

export const STEP_STATUS_MAP = {
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

// Shared Utility Functions

// Create an option element for select dropdowns
export function createOption(value, text) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  return option;
}

// Show a DOM section
export function showSection(element) {
  element.style.display = 'block';
}

// Hide a DOM section
export function hideSection(element) {
  element.style.display = 'none';
}

// Scroll to an element smoothly
export function scrollToElement(element) {
  setTimeout(
    () => element.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    100
  );
}

// Escape HTML to prevent XSS
export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Create HTML for a progress step
export function createStepHTML(
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

// Toggle active class on elements based on a match function
function toggleActive(elements, matchFn) {
  elements.forEach((el) => el.classList.toggle('active', matchFn(el)));
}

// View Management
function setupViewSwitching() {
  elements.navTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => switchView(e.target.dataset.view));
  });
}

// Switch the current view
function switchView(viewName) {
  state.currentView = viewName;
  toggleActive(elements.navTabs, (tab) => tab.dataset.view === viewName);
  toggleActive(
    elements.viewContainers,
    (container) => container.id === `view-${viewName}`
  );
}

// Data Loading
async function loadServers() {
  try {
    state.servers = await window.igent.getServers();
    Object.keys(state.servers).forEach((key) => {
      elements.serverSelect.appendChild(createOption(key, key));
      elements.queueServerSelect.appendChild(createOption(key, key));
      elements.fileEditServerSelect.appendChild(createOption(key, key));
    });
  } catch (error) {
    console.error('Failed to load server configuration:', error);
  }
}

// Load file editing functions
async function loadFileEditConfigs() {
  try {
    state.fileEditConfigs = await window.igent.fileEdit.getFunctions();
  } catch (error) {
    console.error('Failed to load file edit configs:', error);
  }
}

async function initialize() {
  setupViewSwitching();

  await loadServers();
  await loadFileEditConfigs();

  ServerUpdateAgent.attachEventListeners();
  ServerUpdateAgent.setupProgressListener();

  QueueControlAgent.attachEventListeners();
  QueueControlAgent.setupProgressListener();

  FileEditingAgent.attachEventListeners();
  FileEditingAgent.setupProgressListener();
}

initialize();
