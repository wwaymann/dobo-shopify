// lib/sendDesignEmail.js
export async function sendDesignEmail(attrs, { meta = {}, links = {}, to, attachAll = false } = {}) {
  try {
    const res = await fetch("/api/send-design-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attrs, meta, links, to, attachAll }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      console.warn("sendDesignEmail FAIL", data);
      return { ok: false, error: data?.error || `HTTP ${res.status}` };
    }
    console.log("sendDesignEmail OK", data);
    return data;
  } catch (e) {
    console.warn("sendDesignEmail error", e);
    return { ok: false, error: String(e?.message || e) };
  }
}
