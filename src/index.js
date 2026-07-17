const config = require('./config');
const { findProduct, formatCatalog } = require('./catalog');
const { saveOrder } = require('./orders');
const { getSession, resetSession } = require('./sessions');
const { findLeadByPhone } = require('./leads');

const CANCEL_WORDS = ['отмена', 'стоп', 'cancel'];
const YES_WORDS = ['да', 'д', 'ага', 'yes', 'подтверждаю'];
const NO_WORDS = ['нет', 'н', 'no'];

function faqAnswer(text) {
  if (/адрес|где вы|находитесь/.test(text)) {
    return `Наш адрес: ${config.shopAddress}`;
  }
  if (/час|время работы|график/.test(text)) {
    return `Часы работы: ${config.shopHours}`;
  }
  return null;
}

function registerOrderHandlers(client) {
  async function notifyOwner(order, customerChatId) {
    if (!config.ownerNumber) return;
    const text = [
      'Новый заказ через WhatsApp-бота:',
      `Клиент: ${customerChatId}`,
      `Товар: ${order.productName}`,
      `Количество: ${order.quantity}`,
      `Сумма: ${order.total}₽`,
    ].join('\n');
    await client.sendMessage(config.ownerNumber, text);
  }

  client.on('message', async (msg) => {
    const chatId = msg.from;
    if (config.ownerNumber && chatId === config.ownerNumber) return; // owner messages не обрабатываем как клиента

    // Сообщения от бизнесов, которым мы писали рассылку, обрабатывает outreach-модуль, а не сценарий заказа
    const phone = chatId.replace(/@c\.us$/, '');
    if (findLeadByPhone(phone)) return;

    const text = msg.body.trim().toLowerCase();
    const session = getSession(chatId);

    if (CANCEL_WORDS.includes(text)) {
      resetSession(chatId);
      await msg.reply('Заказ отменён. Напишите «меню», чтобы начать заново.');
      return;
    }

    const faq = faqAnswer(text);
    if (faq) {
      await msg.reply(faq);
      return;
    }

    if (session.state === 'idle') {
      const productId = Number(text);
      if (Number.isInteger(productId) && findProduct(productId)) {
        const product = findProduct(productId);
        session.state = 'awaiting_quantity';
        session.cart = { productId: product.id };
        await msg.reply(`Вы выбрали «${product.name}» (${product.price}₽/${product.unit}). Сколько штук нужно?`);
        return;
      }

      // Любое нераспознанное сообщение в состоянии ожидания — показываем каталог
      await msg.reply(`Здравствуйте! Это ${config.shopName}.\n\n${formatCatalog()}`);
      return;
    }

    if (session.state === 'awaiting_quantity') {
      const quantity = Number(text);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        await msg.reply('Пожалуйста, укажите количество числом, например: 2');
        return;
      }
      const product = findProduct(session.cart.productId);
      session.cart.quantity = quantity;
      session.cart.total = product.price * quantity;
      session.state = 'awaiting_confirmation';
      await msg.reply(
        `Проверьте заказ:\n${product.name} x${quantity} = ${session.cart.total}₽\n\nПодтвердить заказ? (да/нет)`
      );
      return;
    }

    if (session.state === 'awaiting_confirmation') {
      if (YES_WORDS.includes(text)) {
        const product = findProduct(session.cart.productId);
        const order = {
          productId: product.id,
          productName: product.name,
          quantity: session.cart.quantity,
          total: session.cart.total,
          customer: chatId,
        };
        saveOrder(order);
        await notifyOwner(order, chatId);
        await msg.reply('Спасибо! Ваш заказ принят, скоро с вами свяжутся для уточнения деталей.');
        resetSession(chatId);
        return;
      }
      if (NO_WORDS.includes(text)) {
        resetSession(chatId);
        await msg.reply('Заказ отменён. Напишите «меню», чтобы выбрать что-то другое.');
        return;
      }
      await msg.reply('Пожалуйста, ответьте «да» или «нет».');
      return;
    }

    // Фоллбэк — не поняли сообщение
    await msg.reply(`Здравствуйте! Это ${config.shopName}.\n\n${formatCatalog()}`);
  });
}

module.exports = { registerOrderHandlers };
