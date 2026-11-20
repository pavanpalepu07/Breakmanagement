let config = null;

export async function loadConfig() {
  const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Could not load config.json');
  config = await res.json();
  return config;
}

export function getConfig() {
  return config;
}

export function isConfigured() {
  return config && !String(config.clientId).startsWith('REPLACE') && !String(config.tenantId).startsWith('REPLACE');
}
