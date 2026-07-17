const TelegramBot = require('node-telegram-bot-api');

const config = require('./config');
const leads = require('./leads');
const discovery = require('./discovery');
const outreach = require('./outreach');

const HELP_TEXT = [
  'Бот управления рассылкой NFC-визиток по Риге.',
  '',
  '/search <категория> — найти бизнесы (см. /categories)',
  '/categories — список категорий для поиска',
  '/leads [статус] — список лидов (new, sent, replied, interested, declined)',
  '/send <id> — отправить сообщение конкретному лиду вручную',
  '/auto on|off — включить/выключить автоотправку (с лимитами и задержками)',
  '/interested <id> — отметить как заинтересованного',
  '/decline <id> — отметить как отказавшегося',
  '/stats — статистика по лидам',
  '/message — показать текущий шаблон сообщения (редактируется в data/outreach-message.txt)',
].join('\n');

function startTelegramBot(whatsappClient) {
  if (!config.telegramToken) {
    console.log('TELEGRAM_BOT_TOKEN не задан — Telegram-бот не запущен.');
    return null;
  }

  const bot = new TelegramBot(config.telegramToken, { polling: true });
  const ownerId = config.telegramOwnerId;

  function isOwner(msg) {
    return !ownerId || String(msg.chat.id) === String(ownerId);
  }

  function reply(msg, text) {
    return bot.sendMessage(msg.chat.id, text);
  }

  bot.onText(/^\/(start|help)$/, (msg) => {
    if (!isOwner(msg)) return;
    reply(msg, HELP_TEXT);
  });

  bot.onText(/^\/categories$/, (msg) => {
    if (!isOwner(msg)) return;
    const lines = Object.entries(discovery.CATEGORY_TAGS).map(([key, v]) => `${key} — ${v.label}`);
    reply(msg, lines.join('\n'));
  });

  bot.onText(/^\/search (\S+)$/, async (msg, match) => {
    if (!isOwner(msg)) return;
    const key = match[1].trim().toLowerCase();
    if (!discovery.CATEGORY_TAGS[key]) {
      reply(msg, `Неизвестная категория "${key}". Используйте /categories.`);
      return;
    }
    await reply(msg, `Ищу «${discovery.CATEGORY_TAGS[key].label}» в Риге...`);
    try {
      const found = await discovery.searchCategory(key);
      const added = leads.addLeads(found);
      reply(msg, `Найдено объектов: ${found.length}. Добавлено новых лидов (с телефоном, без дублей): ${added}.`);
    } catch (err) {
      reply(msg, `Ошибка поиска: ${err.message}`);
    }
  });

  bot.onText(/^\/leads(?:\s+(\S+))?$/, (msg, match) => {
    if (!isOwner(msg)) return;
    const status = match[1];
    const list = leads.getLeads(status).slice(0, 20);
    if (!list.length) {
      reply(msg, 'Лидов не найдено.');
      return;
    }
    const lines = list.map(
      (l) => `#${l.id} [${l.status}] ${l.name} — ${l.phone}${l.address ? ` — ${l.address}` : ''}`
    );
    reply(msg, lines.join('\n'));
  });

  bot.onText(/^\/send (\d+)$/, async (msg, match) => {
    if (!isOwner(msg)) return;
    const id = Number(match[1]);
    const lead = leads.findLead(id);
    if (!lead) {
      reply(msg, `Лид #${id} не найден.`);
      return;
    }
    try {
      await outreach.sendToLead(whatsappClient, lead);
      reply(msg, `Отправлено: ${lead.name} (${lead.phone})`);
    } catch (err) {
      reply(msg, `Ошибка отправки: ${err.message}`);
    }
  });

  bot.onText(/^\/(interested|decline) (\d+)$/, (msg, match) => {
    if (!isOwner(msg)) return;
    const status = match[1] === 'interested' ? 'interested' : 'declined';
    const id = Number(match[2]);
    const updated = leads.updateLead(id, { status });
    reply(msg, updated ? `Лид #${id} -> ${status}` : `Лид #${id} не найден.`);
  });

  bot.onText(/^\/auto (on|off)$/, (msg, match) => {
    if (!isOwner(msg)) return;
    if (match[1] === 'on') {
      if (outreach.isAutoRunning()) {
        reply(msg, 'Автоотправка уже включена.');
        return;
      }
      outreach.startAuto(whatsappClient, (text) => bot.sendMessage(msg.chat.id, text));
      reply(
        msg,
        `Автоотправка включена: до ${config.outreachDailyLimit} сообщений в день, ` +
          `задержка ${config.outreachMinDelaySec}-${config.outreachMaxDelaySec} сек между отправками.`
      );
    } else {
      outreach.stopAuto();
      reply(msg, 'Автоотправка остановлена.');
    }
  });

  bot.onText(/^\/stats$/, (msg) => {
    if (!isOwner(msg)) return;
    const s = leads.stats();
    const lines = [`Всего лидов: ${s.total}`, ...Object.entries(s.byStatus).map(([k, v]) => `${k}: ${v}`)];
    reply(msg, lines.join('\n'));
  });

  bot.onText(/^\/message$/, (msg) => {
    if (!isOwner(msg)) return;
    reply(msg, outreach.getTemplate());
  });

  bot.on('polling_error', (err) => console.error('Telegram polling error:', err.message));

  console.log('Telegram-бот запущен.');
  return bot;
}

module.exports = { startTelegramBot };
