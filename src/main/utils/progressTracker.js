import { logDebug, logInfo } from './logger.js';

export class ProgressTracker {
  constructor(operationName, totalSteps, callback) {
    this.operationName = operationName;
    this.totalSteps = totalSteps;
    this.callback = callback;
    this.currentStep = 0;
    this.startTime = Date.now();
    this.stepStartTime = null;
  }

  emit(status, data = {}) {
    const progressData = {
      status,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      timestamp: new Date().toISOString(),
      ...data,
    };

    this.logToConsole(status, data);

    if (this.callback) {
      this.callback(progressData);
    }

    return progressData;
  }

  logToConsole(status, data) {
    const { command, duration, error, stderr } = data;

    switch (status) {
      case 'started':
        logInfo(
          this.operationName,
          `Starting operation (${this.totalSteps} steps)`
        );
        break;

      case 'running':
        logInfo(
          this.operationName,
          `[${this.currentStep}/${this.totalSteps}] Running: ${command}`
        );
        break;

      case 'step-complete':
        logInfo(
          this.operationName,
          `[${this.currentStep}/${this.totalSteps}] Completed in ${duration}s`
        );
        break;

      case 'step-failed':
        logInfo(
          this.operationName,
          `[${this.currentStep}/${this.totalSteps}] FAILED after ${duration}s`
        );
        if (stderr) {
          logDebug(this.operationName, `Error output: ${stderr}`);
        }
        if (error) {
          logDebug(this.operationName, `Error message: ${error}`);
        }
        break;

      case 'completed':
        logInfo(
          this.operationName,
          `Completed all ${this.totalSteps} steps in ${duration}s`
        );
        break;

      case 'failed':
        logInfo(
          this.operationName,
          `FAILED at step ${this.currentStep}/${this.totalSteps} after ${duration}s`
        );
        break;
    }
  }

  start(message) {
    this.startTime = Date.now();
    return this.emit('started', { message });
  }

  stepStart(command) {
    this.currentStep++;
    this.stepStartTime = Date.now();
    return this.emit('running', {
      command,
      message: `Executing step ${this.currentStep}/${this.totalSteps}`,
    });
  }

  stepComplete(command, stdout = '', stderr = '') {
    const duration = this.getStepDuration();
    return this.emit('step-complete', {
      command,
      success: true,
      duration,
      stdout,
      stderr,
      message: `Step ${this.currentStep}/${this.totalSteps} completed (${duration}s)`,
    });
  }

  stepFailed(command, error, stdout = '', stderr = '', exitCode = null) {
    const duration = this.getStepDuration();
    return this.emit('step-failed', {
      command,
      success: false,
      error,
      stdout,
      stderr,
      exitCode,
      duration,
      message: `Step ${this.currentStep}/${this.totalSteps} failed (${duration}s)`,
    });
  }

  complete() {
    const duration = this.getTotalDuration();
    return this.emit('completed', {
      duration,
      message: `Operation completed successfully in ${duration}s`,
    });
  }

  failed() {
    const duration = this.getTotalDuration();
    return this.emit('failed', {
      duration,
      message: `Operation failed at step ${this.currentStep}/${this.totalSteps} after ${duration}s`,
    });
  }

  getStepDuration() {
    if (!this.stepStartTime) return '0.00';
    return ((Date.now() - this.stepStartTime) / 1000).toFixed(2);
  }

  getTotalDuration() {
    return ((Date.now() - this.startTime) / 1000).toFixed(2);
  }
}
