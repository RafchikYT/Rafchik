const fs = require('fs');
const path = require('path');

const LEADS_PATH = path.join(__dirname, '..', 'data', 'leads.json');

function loadLeads() {
  if (!fs.existsSync(LEADS_PATH)) return [];
  return JSON.parse(fs.readFileSync(LEADS_PATH, 'utf-8'));
}

function saveLeads(leads) {
  fs.writeFileSync(LEADS_PATH, JSON.stringify(leads, null, 2), 'utf-8');
}

function addLeads(found) {
  const leads = loadLeads();
  const existingPhones = new Set(leads.map((l) => l.phone));
  let nextId = leads.reduce((max, l) => Math.max(max, l.id), 0) + 1;
  let added = 0;

  for (const item of found) {
    if (!item.phone || existingPhones.has(item.phone)) continue;
    existingPhones.add(item.phone);
    leads.push({
      id: nextId++,
      name: item.name,
      phone: item.phone,
      address: item.address || '',
      category: item.category || '',
      status: 'new',
      notes: '',
      createdAt: new Date().toISOString(),
      lastContactedAt: null,
    });
    added += 1;
  }

  saveLeads(leads);
  return added;
}

function getLeads(status) {
  const leads = loadLeads();
  return status ? leads.filter((l) => l.status === status) : leads;
}

function findLead(id) {
  return loadLeads().find((l) => l.id === id);
}

function findLeadByPhone(phone) {
  return loadLeads().find((l) => l.phone === phone);
}

function updateLead(id, patch) {
  const leads = loadLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leads[idx] = { ...leads[idx], ...patch };
  saveLeads(leads);
  return leads[idx];
}

function stats() {
  const leads = loadLeads();
  const byStatus = {};
  for (const l of leads) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  return { total: leads.length, byStatus };
}

module.exports = { loadLeads, saveLeads, addLeads, getLeads, findLead, findLeadByPhone, updateLead, stats };
