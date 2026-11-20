import { getToken } from './auth.jsx';
import { getConfig } from './config.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const FIELDS = 'Title,AgentEmail,Team,BreakType,StartTime,EndTime,DurationMinutes,Status';

let listBasePromise = null;

async function graph(urlOrPath, { method = 'GET', body } = {}) {
  const token = await getToken();
  const res = await fetch(urlOrPath.startsWith('http') ? urlOrPath : GRAPH + urlOrPath, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error?.message || '';
    } catch {
      /* ignore */
    }
    throw new Error(`SharePoint request failed (${res.status}). ${detail}`.trim());
  }
  return res.status === 204 ? null : res.json();
}

function listBase() {
  if (!listBasePromise) {
    const { siteHostname, sitePath, listName } = getConfig();
    listBasePromise = graph(`/sites/${siteHostname}:${sitePath}`)
      .then(site => `/sites/${site.id}/lists/${encodeURIComponent(listName)}`)
      .catch(err => {
        listBasePromise = null;
        throw err;
      });
  }
  return listBasePromise;
}

const escapeOData = s => String(s).replace(/'/g, "''");

export async function queryItems(filter) {
  const base = await listBase();
  let url = `${base}/items?$expand=fields($select=${FIELDS})&$top=999`;
  if (filter) url += `&$filter=${encodeURIComponent(filter)}`;
  const items = [];
  while (url) {
    const page = await graph(url);
    items.push(...page.value);
    url = page['@odata.nextLink'] || null;
  }
  return items.map(i => ({ id: i.id, ...i.fields }));
}

export async function createItem(fields) {
  const base = await listBase();
  const item = await graph(`${base}/items`, { method: 'POST', body: { fields } });
  return { id: item.id, ...item.fields };
}

export async function updateItem(id, fields) {
  const base = await listBase();
  return graph(`${base}/items/${id}/fields`, { method: 'PATCH', body: fields });
}

export { escapeOData };
