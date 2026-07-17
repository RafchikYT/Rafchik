const config = require('./config');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const CATEGORY_TAGS = {
  cafe: { tag: 'amenity', value: 'cafe', label: 'Кафе' },
  restaurant: { tag: 'amenity', value: 'restaurant', label: 'Рестораны' },
  bar: { tag: 'amenity', value: 'bar', label: 'Бары' },
  fastfood: { tag: 'amenity', value: 'fast_food', label: 'Фастфуд' },
  bakery: { tag: 'shop', value: 'bakery', label: 'Пекарни' },
  hairdresser: { tag: 'shop', value: 'hairdresser', label: 'Парикмахерские' },
  beauty: { tag: 'shop', value: 'beauty', label: 'Салоны красоты' },
  spa: { tag: 'leisure', value: 'spa', label: 'СПА' },
  dentist: { tag: 'amenity', value: 'dentist', label: 'Стоматологии' },
  clinic: { tag: 'amenity', value: 'clinic', label: 'Клиники' },
  gym: { tag: 'leisure', value: 'fitness_centre', label: 'Фитнес-залы' },
  hotel: { tag: 'tourism', value: 'hotel', label: 'Отели' },
  autoservice: { tag: 'shop', value: 'car_repair', label: 'Автосервисы' },
  carwash: { tag: 'shop', value: 'car_wash', label: 'Автомойки' },
  pharmacy: { tag: 'amenity', value: 'pharmacy', label: 'Аптеки' },
  clothes: { tag: 'shop', value: 'clothes', label: 'Магазины одежды' },
};

function buildQuery(tag, value, lat, lon, radius) {
  const filter = `["${tag}"="${value}"]`;
  return `
    [out:json][timeout:25];
    (
      node${filter}(around:${radius},${lat},${lon});
      way${filter}(around:${radius},${lat},${lon});
    );
    out center tags;
  `;
}

async function fetchOverpass(query) {
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Overpass API недоступен');
}

function normalizePhone(raw) {
  if (!raw) return null;
  const first = raw.split(/[;,]/)[0].trim();
  let digits = first.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits.startsWith('371')) {
    digits = digits.replace(/^0+/, '');
    digits = `371${digits}`;
  }
  return digits.length >= 9 ? digits : null;
}

function buildAddress(tags) {
  const parts = [];
  if (tags['addr:street']) {
    parts.push(tags['addr:housenumber'] ? `${tags['addr:street']} ${tags['addr:housenumber']}` : tags['addr:street']);
  }
  parts.push(tags['addr:city'] || 'Рига');
  return parts.join(', ');
}

function parseElements(elements, categoryKey) {
  const results = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name;
    const rawPhone = tags.phone || tags['contact:phone'] || tags['phone:mobile'];
    const phone = normalizePhone(rawPhone);
    if (!name || !phone) continue;
    results.push({
      name,
      phone,
      address: buildAddress(tags),
      category: categoryKey,
      source: `osm:${el.type}/${el.id}`,
    });
  }
  return results;
}

async function searchCategory(categoryKey) {
  const category = CATEGORY_TAGS[categoryKey];
  if (!category) throw new Error(`Неизвестная категория: ${categoryKey}`);

  const query = buildQuery(
    category.tag,
    category.value,
    config.rigaCenterLat,
    config.rigaCenterLon,
    config.searchRadiusM
  );
  const data = await fetchOverpass(query);
  return parseElements(data.elements || [], categoryKey);
}

module.exports = { CATEGORY_TAGS, searchCategory, normalizePhone };
