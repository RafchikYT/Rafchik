const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'catalog.json');

function getCatalog() {
  const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
  return JSON.parse(raw);
}

function findProduct(id) {
  return getCatalog().find((p) => p.id === id);
}

function formatCatalog() {
  const items = getCatalog();
  const lines = items.map((p) => `${p.id}. ${p.name} — ${p.price}₽/${p.unit}`);
  return ['Каталог товаров:', ...lines, '', 'Напишите номер товара, чтобы заказать его.'].join('\n');
}

module.exports = { getCatalog, findProduct, formatCatalog };
