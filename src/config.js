require('dotenv').config();

module.exports = {
  ownerNumber: process.env.OWNER_NUMBER || '',
  shopName: process.env.SHOP_NAME || 'Магазин',
  shopAddress: process.env.SHOP_ADDRESS || 'уточняется',
  shopHours: process.env.SHOP_HOURS || 'уточняется',
};
