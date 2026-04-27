import apiClient from './client';

// baseURL in apiClient is already '/api', so paths here are relative to that
const BASE = '/admin/billing';

export const getBillingReport = (params = {}) =>
  apiClient.get(`${BASE}/report`, { params }).then(r => r.data);

export const updateSessionBilling = (id, data) =>
  apiClient.put(`${BASE}/sessions/${id}`, data).then(r => r.data);

export const batchUpdateBillingStatus = (ids, billingStatus) =>
  apiClient.post(`${BASE}/sessions/batch-status`, { ids, billingStatus }).then(r => r.data);

export const getBillingReference = () =>
  apiClient.get(`${BASE}/reference`).then(r => r.data);

/**
 * Trigger a file download by hitting the export endpoint with the auth token.
 * The browser receives the file response and initiates a download.
 */
export const downloadBillingExport = async (format, params = {}) => {
  const token = localStorage.getItem('token');
  const query = new URLSearchParams({ format, ...params }).toString();
  const url   = `/api${BASE}/export?${query}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Export failed');
  }

  const blob     = await response.blob();
  const filename = response.headers.get('Content-Disposition')
    ?.match(/filename="?([^"]+)"?/)?.[1]
    || `billing_report.${format}`;

  const objUrl = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = objUrl;
  a.download   = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objUrl);
};
