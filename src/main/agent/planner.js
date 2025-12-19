export function planDeployment({ branch }) {
  if (!branch || typeof branch !== 'string') {
    throw new Error('Invalid branch name');
  }

  return [
    'cd ~/Desktop',
    'touch test-deployment.txt',
    'echo "completed" > test-deployment.txt',
    'cat test-deployment.txt',
    // 'cd /var/webs/app', // TODO: change test-server name
    // 'git fetch origin',
    // `git checkout ${branch}`,
    // `git pull origin ${branch}`,
  ];
}
