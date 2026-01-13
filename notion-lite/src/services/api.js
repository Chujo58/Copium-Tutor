
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const finalOptions = {
    credentials: "include", 
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  };

  console.log("[apiFetch] request", {
    url,
    method: finalOptions.method || "GET",
    credentials: finalOptions.credentials,
    body: finalOptions.body,
  });

  const res = await fetch(url, finalOptions);

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    console.warn("[apiFetch] failed to parse JSON", { url, status: res.status });
  }

  console.log("[apiFetch] response", {
    url,
    status: res.status,
    ok: res.ok,
    data,
  });

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}
