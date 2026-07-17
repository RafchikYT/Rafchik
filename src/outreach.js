const fs = require('fs');
const path = require('path');

const config = require('./config');
const leads = require('./leads');

const TEMPLATE_PATH = path.join(__dirname, '..', 'data', 'outreach-message.txt');

const STOP_WORDS = ['стоп', 'stop', 'не пиши', 'не интересно', 'отписаться', 'удалите'];

function getTemplate() {
  return fs.readFileSync(TEMPLATE_PATH, 'utf-8');
}

function setTemplate(text) {
  fs.writeFileSync(TEMPLATE_PATH, text, 'utf-8');
}

function renderMessage(lead) {
  return getTemplate().replace(/\{\{\s*name\s*\}\}/g, lead.name);
}

function toWhatsAppId(phone) {
  return `${phone}@c.us`;
}

function isStopReply(text) {
  const lower = text.trim().toLowerCase();
  return STOP_WORDS.some((w) => lower.includes(w));
}

async function sendToLead(client, lead) {
  const id = toWhatsAppId(lead.phone);
  const text = renderMessage(lead);
  await client.sendMessage(id, text);
  leads.updateLead(lead.id, { status: 'sent', lastContactedAt: new Date().toISOString() });
}

function registerReplyHandler(client, bot, ownerChatId) {
  client.on('message', async (msg) => {
    const phone = msg.from.replace(/@c\.us$/, '');
    const lead = leads.findLeadByPhone(phone);
    if (!lead) return;

    if (isStopReply(msg.body)) {
      leads.updateLead(lead.id, { status: 'declined' });
      if (bot && ownerChatId) {
        await bot.sendMessage(ownerChatId, `${lead.name} (${lead.phone}) попросили больше не писать. Статус: declined.`);
      }
      return;
    }

    leads.updateLead(lead.id, { status: 'replied' });
    if (bot && ownerChatId) {
      await bot.sendMessage(ownerChatId, `Ответ от ${lead.name} (${lead.phone}):\n${msg.body}`);
    }
  });
}

let autoTimer = null;
let sentToday = 0;
let dayKey = new Date().toISOString().slice(0, 10);

function resetDailyCounterIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dayKey) {
    dayKey = today;
    sentToday = 0;
  }
}

function randomDelayMs() {
  const min = config.outreachMinDelaySec * 1000;
  const max = config.outreachMaxDelaySec * 1000;
  return Math.floor(min + Math.random() * (max - min));
}

function isAutoRunning() {
  return autoTimer !== null;
}

function stopAuto() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
}

function startAuto(client, onEvent) {
  if (autoTimer) return;

  const tick = async () => {
    resetDailyCounterIfNeeded();

    if (sentToday >= config.outreachDailyLimit) {
      autoTimer = setTimeout(tick, randomDelayMs());
      return;
    }

    const [next] = leads.getLeads('new');
    if (!next) {
      autoTimer = setTimeout(tick, randomDelayMs());
      return;
    }

    try {
      await sendToLead(client, next);
      sentToday += 1;
      onEvent(`Отправлено: ${next.name} (${next.phone})`);
    } catch (err) {
      onEvent(`Ошибка отправки для ${next.name}: ${err.message}`);
    }

    autoTimer = setTimeout(tick, randomDelayMs());
  };

  tick();
}

module.exports = {
  getTemplate,
  setTemplate,
  renderMessage,
  toWhatsAppId,
  isStopReply,
  sendToLead,
  registerReplyHandler,
  isAutoRunning,
  startAuto,
  stopAuto,
};
