/* =========================================================
   ЛОГИКА САЙТА KIVA
   ---------------------------------------------------------
   Файл разбит на разделы. Каждый раздел — маленькие функции
   с понятными именами. Данные о товарах лежат в products.js.

   1. Вспомогательные функции
   2. Каталог и фильтры
   3. Outlet
   4. Карточка товара (всплывающее окно)
   5. Корзина
   6. Окна: открыть / закрыть
   7. Формы
   8. Таймер акции
   9. Красота: появление при прокрутке, движение плиток, шапка, меню
   ========================================================= */


/* ---------- 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---------- */

// Режим менеджера: index.html?admin — показывает генератор постов (post.js)
const IS_ADMIN = new URLSearchParams(location.search).has("admin");

// Форматирует число как цену: 1234.5 → "1 234,50"
function formatPrice(number) {
  return number.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Находит плитку по id
function findProduct(id) {
  return PRODUCTS.find(product => product.id === id);
}

// Находит сопутствующий товар по id
function findAccessory(id) {
  return ACCESSORIES.find(item => item.id === id);
}

// Показывает уведомление внизу экрана на 2,5 секунды
let toastTimer;
function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2500);
}

// Возвращает HTML бейджа: «Скидка», «Хит», «Новинка»
function badgeHTML(product) {
  if (product.badge === "sale" && product.oldPrice) {
    const percent = Math.round((1 - product.price / product.oldPrice) * 100);
    return `<span class="badge badge--sale">−${percent}%</span>`;
  }
  if (product.badge === "hit") return `<span class="badge badge--hit">Хит</span>`;
  if (product.badge === "new") return `<span class="badge badge--new">Новинка</span>`;
  return "";
}

// Возвращает HTML строки наличия
function stockHTML(product) {
  if (product.inStock) return `<span class="stock">● В наличии в Минске</span>`;
  return `<span class="stock stock--order">○ Под заказ, 10–14 дней</span>`;
}


/* ---------- 2. КАТАЛОГ И ФИЛЬТРЫ ---------- */

// Текущие значения фильтров
const filters = {
  room: "all",        // помещение
  texture: "all",     // текстура
  maxPrice: 150,      // максимальная цена за м²
  stockOnly: false,   // только в наличии
  sort: "popular"     // сортировка
};

// HTML одной карточки товара
function cardHTML(product) {
  // Для Outlet вместо формата показываем остаток
  const meta = product.outletLeft
    ? `${product.format} · осталось <b>${product.outletLeft} м²</b>`
    : `${product.type} · ${product.format}`;

  const oldPrice = product.oldPrice ? `<s>${formatPrice(product.oldPrice)}</s>` : "";

  return `
    <article class="card" data-id="${product.id}">
      <div class="card__image">
        <div class="tex tex-${product.texture}"></div>
        <div class="card__badge">${badgeHTML(product)}</div>
        <span class="card__hint">Подробнее и расчёт</span>
      </div>
      <div class="card__body">
        <span class="card__brand">${product.brand} · ${product.country}</span>
        <h3 class="card__name">${product.name}</h3>
        <span class="card__meta">${meta}</span>
        ${stockHTML(product)}
        <div class="card__bottom">
          <div class="price">${oldPrice}<b>${formatPrice(product.price)}</b> <small>BYN/м²</small></div>
          <button class="add-btn" data-add="${product.id}" aria-label="Добавить в корзину">+</button>
        </div>
      </div>
    </article>`;
}

// Отбирает товары по фильтрам и сортирует
function getFilteredProducts() {
  let list = PRODUCTS.filter(product => product.outletLeft === null); // Outlet показываем отдельно

  if (filters.room !== "all") list = list.filter(p => p.rooms.includes(filters.room));
  if (filters.texture !== "all") list = list.filter(p => p.texture === filters.texture);
  if (filters.stockOnly) list = list.filter(p => p.inStock);
  list = list.filter(p => p.price <= filters.maxPrice);

  if (filters.sort === "cheap") list.sort((a, b) => a.price - b.price);
  if (filters.sort === "expensive") list.sort((a, b) => b.price - a.price);

  return list;
}

// Рисует каталог
function renderCatalog() {
  const grid = document.getElementById("catalogGrid");
  const list = getFilteredProducts();

  document.getElementById("catalogCount").textContent = `Найдено товаров: ${list.length}`;

  if (list.length === 0) {
    grid.innerHTML = `<p class="empty">Ничего не нашлось 🙁 Попробуйте убрать часть фильтров или <a href="#lead"><b>спросите консультанта</b></a>.</p>`;
    return;
  }
  grid.innerHTML = list.map(cardHTML).join("");
}

// Создаёт кнопки помещений над каталогом
function renderRoomChips() {
  const box = document.getElementById("roomChips");
  let html = `<button class="chip is-active" data-chip="all">Все</button>`;
  for (const key in ROOM_NAMES) {
    html += `<button class="chip" data-chip="${key}">${ROOM_NAMES[key]}</button>`;
  }
  box.innerHTML = html;
}

// Делает активной нужную кнопку помещения
function setRoom(room) {
  filters.room = room;
  document.querySelectorAll(".chip").forEach(chip => {
    chip.classList.toggle("is-active", chip.dataset.chip === room);
  });
  renderCatalog();
}

// Заполняет список текстур
function renderTextureOptions() {
  const select = document.getElementById("textureSelect");
  for (const key in TEXTURE_NAMES) {
    select.innerHTML += `<option value="${key}">${TEXTURE_NAMES[key]}</option>`;
  }
}

// Подключает все фильтры
function setupFilters() {
  renderRoomChips();
  renderTextureOptions();

  // Клик по кнопке помещения над каталогом
  document.getElementById("roomChips").addEventListener("click", event => {
    const chip = event.target.closest(".chip");
    if (chip) setRoom(chip.dataset.chip);
  });

  // Клик по большой карточке помещения — включаем фильтр и едем к каталогу
  document.querySelectorAll("[data-room]").forEach(card => {
    card.addEventListener("click", () => {
      setRoom(card.dataset.room);
      document.getElementById("catalog").scrollIntoView();
    });
  });

  document.getElementById("textureSelect").addEventListener("change", event => {
    filters.texture = event.target.value;
    renderCatalog();
  });

  document.getElementById("priceRange").addEventListener("input", event => {
    filters.maxPrice = Number(event.target.value);
    document.getElementById("priceValue").textContent = event.target.value;
    renderCatalog();
  });

  document.getElementById("sortSelect").addEventListener("change", event => {
    filters.sort = event.target.value;
    renderCatalog();
  });

  document.getElementById("stockOnly").addEventListener("change", event => {
    filters.stockOnly = event.target.checked;
    renderCatalog();
  });
}


/* ---------- 3. OUTLET ---------- */

function renderOutlet() {
  const list = PRODUCTS.filter(product => product.outletLeft !== null);
  document.getElementById("outletList").innerHTML = list.map(cardHTML).join("");
}


/* ---------- 4. КАРТОЧКА ТОВАРА ---------- */

// HTML «интерьера»: стена из выбранной плитки + деревянный пол
function interiorHTML(product) {
  const floor = product.texture === "wood" ? "concrete" : "wood";
  return `
    <div class="interior">
      <div class="interior__wall tex-${product.texture}"></div>
      <div class="interior__floor tex-${floor}"></div>
      <div class="interior__mirror"></div>
      <div class="interior__tub"></div>
    </div>`;
}

// Три вида в галерее: плитка, крупно, в интерьере
function galleryViews(product) {
  return [
    { title: "Плитка", html: `<div class="tex tex-${product.texture}"></div>` },
    { title: "Крупно", html: `<div class="tex tex-${product.texture} zoom"></div>` },
    { title: "В интерьере", html: interiorHTML(product) }
  ];
}

// Открывает карточку товара
function openProduct(id) {
  const product = findProduct(id);
  const views = galleryViews(product);

  const roomsTags = product.rooms.map(room => `<span>${ROOM_NAMES[room]}</span>`).join("");
  const oldPrice = product.oldPrice ? `<s>${formatPrice(product.oldPrice)} BYN</s>` : "";

  const thumbs = views.map((view, index) => `
    <button class="thumb ${index === 0 ? "is-active" : ""}" data-view="${index}">
      ${view.html}<span>${view.title}</span>
    </button>`).join("");

  const extras = ACCESSORIES.map(item => `
    <div class="extra">
      <span>${item.name}</span>
      <button data-add-extra="${item.id}">+ ${formatPrice(item.price)} BYN</button>
    </div>`).join("");

  document.getElementById("productModalBody").innerHTML = `
    <div class="product">
      <div class="product__gallery">
        <div class="product__main" id="mainView">${views[0].html}</div>
        <div class="product__thumbs">${thumbs}</div>
      </div>

      <div class="product__info">
        <span class="card__brand">${product.brand} · ${product.country}</span>
        <h2>${product.name}</h2>
        ${stockHTML(product)}

        <div class="product__price">
          <b>${formatPrice(product.price)} BYN/м²</b> ${oldPrice} ${badgeHTML(product)}
        </div>

        <p class="muted">${product.description}</p>
        <div class="rooms-tags">${roomsTags}</div>

        <dl class="specs">
          <dt>Материал</dt><dd>${product.type}</dd>
          <dt>Формат</dt><dd>${product.format} см</dd>
          <dt>Поверхность</dt><dd>${product.surface}</dd>
          <dt>В коробке</dt><dd>${product.m2PerBox} м²</dd>
          ${product.outletLeft ? `<dt>Остаток</dt><dd>${product.outletLeft} м²</dd>` : ""}
        </dl>

        <div class="calc">
          <h4>Сколько нужно?</h4>
          <div class="calc__row">
            <label><span>Площадь, м²</span><input type="number" id="calcArea" min="0" step="0.5" value="6"></label>
            <label><span>Запас на подрезку</span>
              <select id="calcReserve">
                <option value="0.1">+10% прямая</option>
                <option value="0.15">+15% диагональ</option>
              </select>
            </label>
          </div>
          <p class="calc__result" id="calcResult"></p>
        </div>

        <div class="product__buttons">
          <button class="btn btn--coral" id="addFromModal">В корзину</button>
          <button class="btn btn--outline" id="quickFromModal">Купить в 1 клик</button>
        </div>
        ${IS_ADMIN ? `<button class="btn btn--admin" id="postFromModal">Пост для соцсетей <small>менеджер</small></button>` : ""}

        <div class="extras">
          <h4>С этим берут</h4>
          ${extras}
        </div>
      </div>
    </div>`;

  // Переключение видов в галерее
  document.querySelectorAll(".thumb").forEach(thumb => {
    thumb.addEventListener("click", () => {
      document.querySelectorAll(".thumb").forEach(t => t.classList.remove("is-active"));
      thumb.classList.add("is-active");
      document.getElementById("mainView").innerHTML = views[thumb.dataset.view].html;
    });
  });

  // Калькулятор: считаем при каждом изменении
  const updateCalc = () => {
    const boxes = calcBoxes(product);
    const area = boxes * product.m2PerBox;
    document.getElementById("calcResult").innerHTML =
      `Нужно <b>${boxes} кор.</b> (${formatPrice(area)} м²) — <b>${formatPrice(area * product.price)} BYN</b>`;
  };
  document.getElementById("calcArea").addEventListener("input", updateCalc);
  document.getElementById("calcReserve").addEventListener("change", updateCalc);
  updateCalc();

  // Кнопки
  document.getElementById("addFromModal").addEventListener("click", () => {
    addToCart("tile", product.id, calcBoxes(product));
  });
  document.getElementById("quickFromModal").addEventListener("click", () => openQuickBuy(product));
  if (IS_ADMIN) document.getElementById("postFromModal").addEventListener("click", () => openPost(product));
  document.querySelectorAll("[data-add-extra]").forEach(button => {
    button.addEventListener("click", () => addToCart("extra", Number(button.dataset.addExtra), 1));
  });

  openLayer("productModal");
}

// Сколько коробок нужно по данным калькулятора (минимум 1)
function calcBoxes(product) {
  const area = Number(document.getElementById("calcArea").value) || 0;
  const reserve = Number(document.getElementById("calcReserve").value);
  const needM2 = area * (1 + reserve);
  return Math.max(1, Math.ceil(needM2 / product.m2PerBox));
}

// Клики по карточкам в каталоге и Outlet
function setupCards() {
  ["catalogGrid", "outletList"].forEach(id => {
    document.getElementById(id).addEventListener("click", event => {
      // Клик по «+» — сразу в корзину (1 коробка), окно не открываем
      const addButton = event.target.closest("[data-add]");
      if (addButton) {
        addToCart("tile", Number(addButton.dataset.add), 1);
        addButton.classList.add("is-added");
        addButton.textContent = "✓";
        return;
      }
      // Клик по остальной карточке — открываем подробности
      const card = event.target.closest(".card");
      if (card) openProduct(Number(card.dataset.id));
    });
  });
}


/* ---------- 5. КОРЗИНА ---------- */

/*
  Корзина — массив позиций:
  { type: "tile",  id: 1,   qty: 5 }   ← плитка, qty = коробки
  { type: "extra", id: 101, qty: 2 }   ← клей/затирка, qty = штуки
*/
let cart = loadCart();

// Сохраняем корзину в браузере, чтобы она не пропала после перезагрузки
function saveCart() {
  try { localStorage.setItem("kiva-cart", JSON.stringify(cart)); } catch (error) { /* хранилище недоступно — не страшно */ }
}

function loadCart() {
  try { return JSON.parse(localStorage.getItem("kiva-cart")) || []; } catch (error) { return []; }
}

// Цена одной позиции
function itemPrice(item) {
  if (item.type === "tile") {
    const product = findProduct(item.id);
    return product.price * product.m2PerBox * item.qty;
  }
  return findAccessory(item.id).price * item.qty;
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + itemPrice(item), 0);
}

function addToCart(type, id, qty) {
  const existing = cart.find(item => item.type === type && item.id === id);
  if (existing) existing.qty += qty;
  else cart.push({ type, id, qty });

  saveCart();
  renderCart();

  const name = type === "tile" ? findProduct(id).name : findAccessory(id).name;
  showToast(`✓ ${name} — в корзине`);

  // Счётчик «подпрыгивает»
  document.querySelectorAll(".cart-btn__count").forEach(counter => {
    counter.classList.remove("bump");
    void counter.offsetWidth; // перезапуск анимации
    counter.classList.add("bump");
  });
}

function changeQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  saveCart();
  renderCart();
}

function removeItem(index) {
  cart.splice(index, 1);
  saveCart();
  renderCart();
}

// HTML одной строки корзины
function cartItemHTML(item, index) {
  let image, name, meta;

  if (item.type === "tile") {
    const product = findProduct(item.id);
    image = `<div class="tex tex-${product.texture}"></div>`;
    name = product.name;
    meta = `${item.qty} кор. · ${formatPrice(item.qty * product.m2PerBox)} м²`;
  } else {
    image = "🧰";
    name = findAccessory(item.id).name;
    meta = `${item.qty} шт.`;
  }

  return `
    <div class="cart-item">
      <div class="cart-item__img">${image}</div>
      <div>
        <div class="cart-item__name">${name}</div>
        <div class="cart-item__meta">${meta}</div>
        <div class="qty">
          <button data-qty="${index}" data-delta="-1" aria-label="Меньше">−</button>
          <span>${item.qty}</span>
          <button data-qty="${index}" data-delta="1" aria-label="Больше">+</button>
        </div>
      </div>
      <div>
        <div class="cart-item__price">${formatPrice(itemPrice(item))}</div>
        <button class="cart-item__remove" data-remove="${index}">удалить</button>
      </div>
    </div>`;
}

// Перерисовывает корзину, сумму, счётчики и полосу доставки
function renderCart() {
  const itemsBox = document.getElementById("cartItems");
  const total = cartTotal();

  itemsBox.innerHTML = cart.length
    ? cart.map(cartItemHTML).join("")
    : `<p class="empty">Корзина пока пустая.<br>Загляните в <a href="#catalog" data-close><b>каталог</b></a> 🧱</p>`;

  document.getElementById("cartTotal").textContent = `${formatPrice(total)} BYN`;

  // Счётчик позиций на кнопках корзины
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll("[data-cart-count]").forEach(counter => counter.textContent = count);

  // Бесплатная доставка
  const left = FREE_DELIVERY_FROM - total;
  document.getElementById("deliveryText").innerHTML = left > 0
    ? `До бесплатной доставки по Минску — <b>${formatPrice(left)} BYN</b>`
    : `🎉 Доставка по Минску — бесплатно`;
  document.getElementById("deliveryFill").style.width = Math.min(100, total / FREE_DELIVERY_FROM * 100) + "%";
}

function setupCart() {
  // Кнопки «+», «−», «удалить» внутри корзины
  document.getElementById("cartItems").addEventListener("click", event => {
    const qtyButton = event.target.closest("[data-qty]");
    const removeButton = event.target.closest("[data-remove]");
    if (qtyButton) changeQty(Number(qtyButton.dataset.qty), Number(qtyButton.dataset.delta));
    if (removeButton) removeItem(Number(removeButton.dataset.remove));
  });

  renderCart();
}


/* ---------- 6. ОКНА: ОТКРЫТЬ / ЗАКРЫТЬ ---------- */

// Открывает окно или корзину по id
function openLayer(id) {
  closeLayers();
  document.getElementById(id).classList.add("is-open");
  document.getElementById("overlay").classList.add("is-open");
  document.body.classList.add("no-scroll");
}

// Закрывает все окна
function closeLayers() {
  document.querySelectorAll(".modal, .drawer").forEach(layer => layer.classList.remove("is-open"));
  document.getElementById("overlay").classList.remove("is-open");
  document.body.classList.remove("no-scroll");
}

// Закрывает окно. Из генератора постов — возврат в карточку товара
// (если генератор открыт кнопкой «Мои посты», товара нет — просто закрываем)
function closeTopLayer() {
  if (document.getElementById("postModal").classList.contains("is-open") && postProduct) {
    openProduct(postProduct.id);   // postProduct — товар генератора, см. post.js
    return;
  }
  closeLayers();
}

// «Купить в 1 клик»
function openQuickBuy(product) {
  document.getElementById("quickProductName").textContent = `${product.name} · ${formatPrice(product.price)} BYN/м²`;
  openLayer("quickModal");
}

function setupLayers() {
  // Любая кнопка с data-open-cart открывает корзину
  document.querySelectorAll("[data-open-cart]").forEach(button => {
    button.addEventListener("click", () => openLayer("cartDrawer"));
  });

  // Закрытие: крестик, клик по затемнению, клавиша Esc
  document.addEventListener("click", event => {
    if (event.target.closest("[data-close]")) closeTopLayer();
  });
  document.getElementById("overlay").addEventListener("click", closeTopLayer);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeTopLayer();
  });

  // Кнопка «Мои посты» в шапке — только для менеджера: Избранное и очередь (post.js)
  if (IS_ADMIN) {
    const myPosts = document.getElementById("myPosts");
    myPosts.hidden = false;
    myPosts.addEventListener("click", () => openMyPosts("postTabQueue"));
  }
}


/* ---------- 7. ФОРМЫ ----------
   В прототипе заявки никуда не отправляются — показываем сообщение.
   На реальном сайте здесь будет отправка на сервер или в CRM.
   --------------------------------------------------------------- */
function setupForms() {
  document.getElementById("leadForm").addEventListener("submit", event => {
    event.preventDefault();
    event.target.reset();
    showToast("✓ Спасибо! Перезвоним в течение 15 минут");
  });

  document.getElementById("quickForm").addEventListener("submit", event => {
    event.preventDefault();
    event.target.reset();
    closeLayers();
    showToast("✓ Заявка принята — менеджер скоро позвонит");
  });

  document.getElementById("orderForm").addEventListener("submit", event => {
    event.preventDefault();
    if (cart.length === 0) {
      showToast("Корзина пустая — добавьте товары");
      return;
    }
    cart = [];
    saveCart();
    renderCart();
    event.target.reset();
    closeLayers();
    showToast("🎉 Заказ оформлен! Менеджер подтвердит его по телефону");
  });
}


/* ---------- 8. ТАЙМЕР АКЦИИ ----------
   Считает время до конца текущего месяца.
   ----------------------------------------- */
function startTimer() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1); // 1-е число следующего месяца

  const tick = () => {
    const secondsLeft = Math.max(0, Math.floor((end - new Date()) / 1000));
    const days = Math.floor(secondsLeft / 86400);
    const hours = String(Math.floor(secondsLeft % 86400 / 3600)).padStart(2, "0");
    const minutes = String(Math.floor(secondsLeft % 3600 / 60)).padStart(2, "0");
    const seconds = String(secondsLeft % 60).padStart(2, "0");
    const text = `${days} д ${hours}:${minutes}:${seconds}`;
    document.querySelectorAll("[data-timer]").forEach(timer => timer.textContent = text);
  };

  tick();
  setInterval(tick, 1000);
}


/* ---------- 9. КРАСОТА ---------- */

// Блоки с классом .reveal плавно появляются, когда доходят до экрана
function setupReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target); // анимация только один раз
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll(".reveal").forEach(block => observer.observe(block));
}

// Плитки на первом экране слегка двигаются за мышью
function setupMosaic() {
  const mosaic = document.getElementById("mosaic");
  const tiles = mosaic.querySelectorAll("[data-depth]");

  mosaic.parentElement.addEventListener("mousemove", event => {
    // Положение мыши от -0.5 до 0.5 относительно центра экрана
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    tiles.forEach(tile => {
      const depth = Number(tile.dataset.depth);
      tile.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
    });
  });
}

// Тень у шапки после начала прокрутки
function setupHeader() {
  const header = document.getElementById("header");
  window.addEventListener("scroll", () => {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  });
}

// Меню-бургер на телефоне
function setupBurger() {
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");

  burger.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    burger.classList.toggle("is-open", isOpen);
    burger.setAttribute("aria-expanded", isOpen);
  });

  // После клика по пункту меню закрываем его
  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      burger.classList.remove("is-open");
    });
  });
}


/* ---------- ЗАПУСК ----------
   Всё стартует здесь, по порядку.
   ---------------------------- */
setupFilters();
renderCatalog();
renderOutlet();
setupCards();
setupCart();
setupLayers();
setupForms();
startTimer();
setupReveal();
setupMosaic();
setupHeader();
setupBurger();
