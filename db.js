const SUPABASE_URL = process.env.SUPABASE_URL || "https://oesdxbkzshbhyeznjtzf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lc2R4Ymt6c2hiaHllem5qdHpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY1ODIyMiwiZXhwIjoyMTAzMjM0MjIyfQ.ZlkjEBmUSZxZg3beyIxRyQrehsGv26i5vATLp1mr2GQ";

const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`
};

// Generic read operations
async function fetchTable(table) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers });
    if (!res.ok) {
      console.warn(`Supabase warning: could not fetch table "${table}" (status ${res.status}).`);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error(`Supabase connection error on table "${table}":`, err);
    return [];
  }
}

async function getRow(table, id) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=*`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error(`Error fetching row from "${table}" with ID "${id}":`, err);
    return null;
  }
}

// Special custom queries for security / checks
async function getEmployeByIdentifiant(identifiant) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/employes?identifiant=eq.${identifiant}&select=*`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error("Error fetching employee by identifier:", err);
    return null;
  }
}

async function countOtherAdmins(excludeId) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/employes?estAdmin=eq.true&id=neq.${excludeId}&select=id`, { headers });
    if (!res.ok) return 0;
    const data = await res.json();
    return data ? data.length : 0;
  } catch (err) {
    console.error("Error counting other admins:", err);
    return 0;
  }
}

// Generic write operations
async function insertRow(table, row) {
  const sanitized = { ...row };
  // Convert booleans
  if (table === "employes") {
    sanitized.estAdmin = !!row.estAdmin;
    sanitized.actif = !!row.actif;
  } else if (table === "notifications") {
    sanitized.lu = !!row.lu;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(sanitized)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Error inserting row into "${table}":`, errText);
    throw new Error(`Failed to insert into "${table}": ${errText}`);
  }
}

async function updateRow(table, id, fields) {
  const sanitized = { ...fields };
  // Convert booleans if present
  if (table === "employes") {
    if (fields.estAdmin !== undefined) sanitized.estAdmin = !!fields.estAdmin;
    if (fields.actif !== undefined) sanitized.actif = !!fields.actif;
  } else if (table === "notifications") {
    if (fields.lu !== undefined) sanitized.lu = !!fields.lu;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(sanitized)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Error updating row in "${table}" with ID "${id}":`, errText);
    throw new Error(`Failed to update "${table}": ${errText}`);
  }
}

async function deleteRow(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE",
    headers
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Error deleting row from "${table}" with ID "${id}":`, errText);
    throw new Error(`Failed to delete from "${table}": ${errText}`);
  }
}

// Global Operations (Setup, Boot and Reset)
async function getData() {
  const [
    clients,
    devis,
    commandes,
    stock,
    mouvements,
    ventes,
    finance,
    employes,
    notifications
  ] = await Promise.all([
    fetchTable("clients"),
    fetchTable("devis"),
    fetchTable("commandes"),
    fetchTable("stock"),
    fetchTable("mouvements"),
    fetchTable("ventes"),
    fetchTable("finance"),
    fetchTable("employes"),
    fetchTable("notifications")
  ]);

  return {
    clients: clients || [],
    devis: devis || [],
    commandes: commandes || [],
    stock: stock || [],
    mouvements: mouvements || [],
    ventes: ventes || [],
    finance: finance || [],
    employes: (employes || []).map(e => ({
      ...e,
      estAdmin: e.estAdmin === true || e.estAdmin === 1 || e.estAdmin === "true",
      actif: e.actif === true || e.actif === 1 || e.actif === "true"
    })),
    notifications: (notifications || []).map(n => ({
      ...n,
      lu: n.lu === true || n.lu === 1 || n.lu === "true"
    }))
  };
}

async function resetDatabase() {
  const tables = ["clients", "devis", "commandes", "stock", "mouvements", "ventes", "finance", "notifications"];
  await Promise.all(
    tables.map(table => fetch(`${SUPABASE_URL}/rest/v1/${table}?id=not.is.null`, { method: "DELETE", headers }))
  );
}

module.exports = {
  getData,
  getRow,
  insertRow,
  updateRow,
  deleteRow,
  getEmployeByIdentifiant,
  countOtherAdmins,
  resetDatabase
};
