const { createWhatsAppClient } = require('./whatsappClient');
const { registerOrderHandlers } = require('./index');
const { registerReplyHandler } = require('./outreach');
const { startTelegramBot } = require('./telegramBot');
const config = require('./config');

const client = createWhatsAppClient();

registerOrderHandlers(client);

const bot = startTelegramBot(client);
registerReplyHandler(client, bot, config.telegramOwnerId);

client.initialize();
