document.getElementById('version').innerText =
  'Agent version: ' + window.igent.version();

let plannedCommands = [];

document.getElementById('plan').onclick = async () => {
  const branch = document.getElementById('branch').value;

  try {
    plannedCommands = await window.igent.planDeploy(branch);
    document.getElementById('output').innerText = plannedCommands.join('\n');
    document.getElementById('execute').disabled = false;
  } catch (err) {
    document.getElementById('output').innerText = err.message;
  }
};

document.getElementById('execute').onclick = async () => {
  const confirmed = confirm('Execute these commands?');
  if (!confirmed) return;

  document.getElementById('execute').disabled = true;

  try {
    const results = await window.igent.execute(plannedCommands);
    document.getElementById('output').innerText = JSON.stringify(
      results,
      null,
      2
    );
  } catch (err) {
    document.getElementById('output').innerText = JSON.stringify(err, null, 2);
  }
};
