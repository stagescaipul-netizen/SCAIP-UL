import type { Config } from '@netlify/functions';

const autoValiderDiffere = async () => {
  const baseUrl = (
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/$/, '');
  const secret = process.env.CRON_SECRET?.trim();

  if (!baseUrl || !secret) {
    console.error('Validation différée non exécutée : URL ou CRON_SECRET manquant.');
    return;
  }

  const response = await fetch(`${baseUrl}/api/cron/validation-differee`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
  });

  const body = await response.text();
  if (!response.ok && response.status !== 207) {
    console.error('Validation différée échouée', { status: response.status, body });
    return;
  }

  console.log('Validation différée exécutée', { status: response.status, body });
};

export const config: Config = {
  schedule: '*/5 * * * *',
};

export default autoValiderDiffere;
