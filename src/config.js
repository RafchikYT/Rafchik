require('dotenv').config();

module.exports = {
  ownerNumber: process.env.OWNER_NUMBER || '',
  shopName: process.env.SHOP_NAME || 'Магазин',
  shopAddress: process.env.SHOP_ADDRESS || 'уточняется',
  shopHours: process.env.SHOP_HOURS || 'уточняется',

  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramOwnerId: process.env.TELEGRAM_OWNER_CHAT_ID || '',

  outreachDailyLimit: Number(process.env.OUTREACH_DAILY_LIMIT || 30),
  outreachMinDelaySec: Number(process.env.OUTREACH_MIN_DELAY_SEC || 45),
  outreachMaxDelaySec: Number(process.env.OUTREACH_MAX_DELAY_SEC || 120),

  rigaCenterLat: Number(process.env.RIGA_CENTER_LAT || 56.9496),
  rigaCenterLon: Number(process.env.RIGA_CENTER_LON || 24.1052),
  searchRadiusM: Number(process.env.SEARCH_RADIUS_M || 8000),
};
