document.getElementById('version').innerText =
  'Agent version: ' + window.igent.version();

document.getElementById('plan').onclick = async () => {
  const branch = document.getElementById('branch').value;

  try {
    const commands = await window.igent.planDeploy(branch);
    document.getElementById('output').innerText = commands.join('');
  } catch (err) {
    document.getElementById('output').innerText = err.message;
  }
};
