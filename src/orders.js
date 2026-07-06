const fs = require('fs');
const path = require('path');

const ORDERS_PATH = path.join(__dirname, '..', 'data', 'orders.json');

function loadOrders() {
  if (!fs.existsSync(ORDERS_PATH)) return [];
  return JSON.parse(fs.readFileSync(ORDERS_PATH, 'utf-8'));
}

function saveOrder(order) {
  const orders = loadOrders();
  const record = { id: orders.length + 1, createdAt: new Date().toISOString(), ...order };
  orders.push(record);
  fs.writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2), 'utf-8');
  return record;
}

module.exports = { loadOrders, saveOrder };
