/* =========================================================
   ТОВАРЫ МАГАЗИНА
   ---------------------------------------------------------
   Здесь хранится весь ассортимент, который показывает сайт.
   Чтобы добавить товар — скопируйте один блок { ... },
   вставьте после последнего и поменяйте значения.
   Не забудьте запятую между блоками!

   Все данные — условные (учебный прототип).
   ========================================================= */

/*
  Описание полей плитки:
  id          — уникальный номер (не повторяется)
  name        — название коллекции
  brand       — фабрика
  country     — страна производства
  type        — вид материала
  texture     — рисунок плитки. Одно из значений:
                marble, wood, concrete, stone, terrazzo, sage, clay, ink, sky
                (для каждого есть класс .tex-... в styles.css)
  rooms       — где можно использовать:
                bathroom, kitchen, floor, hallway, facade
  format      — размер плитки, см
  surface     — поверхность
  price       — цена за 1 м², BYN
  oldPrice    — старая цена (если товар со скидкой), иначе null
  m2PerBox    — сколько м² в одной коробке
  inStock     — true = есть в Минске, false = под заказ
  outletLeft  — для товаров Outlet: сколько м² осталось, иначе null
  badge       — плашка на карточке: "hit", "new", "sale" или null
  description — короткое описание для карточки товара
*/
const PRODUCTS = [
  {
    id: 1,
    name: "Calacatta Light",
    brand: "Керамин",
    country: "Беларусь",
    type: "Керамогранит",
    texture: "marble",
    rooms: ["bathroom", "floor", "hallway"],
    format: "60×120",
    surface: "Полированная",
    price: 62.9,
    oldPrice: 74.0,
    m2PerBox: 1.44,
    inStock: true,
    outletLeft: null,
    badge: "sale",
    description: "Светлый мрамор с мягкими серыми прожилками. Крупный формат визуально расширяет ванную и даёт минимум швов."
  },
  {
    id: 2,
    name: "Natural Oak",
    brand: "Italon",
    country: "Италия",
    type: "Керамогранит",
    texture: "wood",
    rooms: ["floor", "hallway", "kitchen"],
    format: "20×120",
    surface: "Матовая",
    price: 74.5,
    oldPrice: null,
    m2PerBox: 1.2,
    inStock: true,
    outletLeft: null,
    badge: "hit",
    description: "Тёплое дерево, которое не боится воды и тёплого пола. Выглядит как паркет, служит как камень."
  },
  {
    id: 3,
    name: "Urban Concrete",
    brand: "Cersanit",
    country: "Польша",
    type: "Керамогранит",
    texture: "concrete",
    rooms: ["floor", "hallway", "kitchen"],
    format: "60×60",
    surface: "Матовая",
    price: 38.9,
    oldPrice: null,
    m2PerBox: 1.44,
    inStock: true,
    outletLeft: null,
    badge: "hit",
    description: "Спокойный серый бетон для лофта и минимализма. Нескользкая поверхность — подходит для прихожей."
  },
  {
    id: 4,
    name: "Terra Clay",
    brand: "Equipe",
    country: "Испания",
    type: "Настенная плитка",
    texture: "clay",
    rooms: ["kitchen", "bathroom"],
    format: "7,5×30",
    surface: "Глянцевая",
    price: 96.0,
    oldPrice: null,
    m2PerBox: 0.5,
    inStock: false,
    outletLeft: null,
    badge: "new",
    description: "Терракотовый «кабанчик» ручной работы с живым оттенком. Яркий фартук, который делает кухню."
  },
  {
    id: 5,
    name: "Terrazzo Soft",
    brand: "Atlas Concorde",
    country: "Италия",
    type: "Керамогранит",
    texture: "terrazzo",
    rooms: ["kitchen", "bathroom", "floor"],
    format: "60×60",
    surface: "Матовая",
    price: 88.0,
    oldPrice: null,
    m2PerBox: 1.08,
    inStock: false,
    outletLeft: null,
    badge: "new",
    description: "Венецианское терраццо с цветной крошкой. Добавляет интерьеру игривости без лишней пестроты."
  },
  {
    id: 6,
    name: "Sage Mono",
    brand: "Керамин",
    country: "Беларусь",
    type: "Настенная плитка",
    texture: "sage",
    rooms: ["bathroom", "kitchen"],
    format: "30×60",
    surface: "Сатинированная",
    price: 34.5,
    oldPrice: null,
    m2PerBox: 1.08,
    inStock: true,
    outletLeft: null,
    badge: null,
    description: "Шалфейный зелёный — главный цвет сезона. Отлично сочетается с деревом и латунью."
  },
  {
    id: 7,
    name: "Keravette",
    brand: "Stroeher",
    country: "Германия",
    type: "Клинкер",
    texture: "stone",
    rooms: ["facade", "hallway"],
    format: "24×11,5",
    surface: "Структурная",
    price: 112.0,
    oldPrice: null,
    m2PerBox: 0.5,
    inStock: true,
    outletLeft: null,
    badge: null,
    description: "Морозостойкий клинкер для крыльца, ступеней и фасада. Не выцветает и не боится соли."
  },
  {
    id: 8,
    name: "Graphite Stone",
    brand: "Italon",
    country: "Италия",
    type: "Керамогранит",
    texture: "ink",
    rooms: ["bathroom", "floor", "facade"],
    format: "120×120",
    surface: "Матовая",
    price: 129.0,
    oldPrice: null,
    m2PerBox: 1.44,
    inStock: false,
    outletLeft: null,
    badge: null,
    description: "Глубокий графит большого формата для смелых интерьеров. Эффектно смотрится с подсветкой."
  },
  {
    id: 9,
    name: "Sky Glaze",
    brand: "Equipe",
    country: "Испания",
    type: "Настенная плитка",
    texture: "sky",
    rooms: ["bathroom", "kitchen"],
    format: "10×10",
    surface: "Глянцевая",
    price: 79.0,
    oldPrice: null,
    m2PerBox: 0.5,
    inStock: true,
    outletLeft: null,
    badge: "hit",
    description: "Небесно-голубая глазурь с переливами. Маленький формат — для акцентной стены в душевой."
  },
  /* ---------- Outlet: остатки партий ---------- */
  {
    id: 10,
    name: "Marble Classic",
    brand: "Керамин",
    country: "Беларусь",
    type: "Керамогранит",
    texture: "marble",
    rooms: ["bathroom", "floor"],
    format: "60×120",
    surface: "Лаппатированная",
    price: 39.9,
    oldPrice: 58.7,
    m2PerBox: 1.44,
    inStock: true,
    outletLeft: 23,
    badge: "sale",
    description: "Остаток партии: классический мрамор по цене стандартной плитки. Хватит на ванную до 8 м²."
  },
  {
    id: 11,
    name: "Wood Ash",
    brand: "Cersanit",
    country: "Польша",
    type: "Керамогранит",
    texture: "wood",
    rooms: ["floor", "hallway"],
    format: "20×60",
    surface: "Матовая",
    price: 24.9,
    oldPrice: 39.9,
    m2PerBox: 1.2,
    inStock: true,
    outletLeft: 41,
    badge: "sale",
    description: "Остаток партии: светлый ясень для пола в прихожей или на кухне."
  },
  {
    id: 12,
    name: "Beton Grey",
    brand: "Cersanit",
    country: "Польша",
    type: "Керамогранит",
    texture: "concrete",
    rooms: ["floor", "hallway", "facade"],
    format: "60×60",
    surface: "Матовая",
    price: 22.0,
    oldPrice: 36.6,
    m2PerBox: 1.44,
    inStock: true,
    outletLeft: 14,
    badge: "sale",
    description: "Остаток партии: универсальный серый бетон. Подойдёт для балкона, гаража или прихожей."
  }
];

/* =========================================================
   СОПУТСТВУЮЩИЕ ТОВАРЫ
   Показываются в карточке плитки в блоке «С этим берут».
   Цена — за штуку (мешок, ведро, упаковку).
   ========================================================= */
const ACCESSORIES = [
  { id: 101, name: "Клей для керамогранита, 25 кг", price: 21.5 },
  { id: 102, name: "Затирка влагостойкая, 2 кг",   price: 14.9 },
  { id: 103, name: "Крестики СВП, 100 шт",          price: 9.9  }
];

/* Названия помещений — для фильтров и карточек */
const ROOM_NAMES = {
  bathroom: "Ванная",
  kitchen: "Кухня",
  floor: "Пол",
  hallway: "Прихожая",
  facade: "Фасад и крыльцо"
};

/* Названия текстур — для фильтра */
const TEXTURE_NAMES = {
  marble: "Мрамор",
  wood: "Дерево",
  concrete: "Бетон",
  stone: "Камень",
  terrazzo: "Терраццо",
  sage: "Цветная (зелёная)",
  clay: "Цветная (терракота)",
  sky: "Цветная (голубая)",
  ink: "Тёмная"
};

/* Сумма заказа, с которой доставка по Минску бесплатная, BYN */
const FREE_DELIVERY_FROM = 500;
