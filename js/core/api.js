export async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'No fue posible completar la operación.');
  }

  return data;
}
