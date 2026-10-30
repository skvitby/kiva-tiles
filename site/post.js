/* =========================================================
   ГЕНЕРАТОР ПОСТОВ ДЛЯ СОЦСЕТЕЙ
   ---------------------------------------------------------
   Кнопка «Пост для соцсетей» видна в окне товара только
   в режиме менеджера: index.html?admin (см. script.js).
   Там же в шапке — кнопка «Мои посты»: Избранное и очередь.

   Стиль постов — длина, эмодзи, хэштеги, CTA, шаблоны —
   задаётся в voice.md. Здесь только логика, тексты не правьте.

   voice.md загружается через fetch, поэтому генератор работает
   на GitHub Pages или через локальный сервер (Live Server).
   При открытии файла двойным кликом браузер загрузку запретит.

   Публикация в Telegram и очередь — в telegram.js.

   1. Хранилище браузера и мелкие помощники
   2. Загрузка и разбор voice.md
   3. Открытие окна и вкладки
   4. Сборка поста
   5. Готовый пост: показ, правка, проверки
   6. Копирование
   7. Избранное
   8. Подключение кнопок
   ========================================================= */

let voice = null;          // настройки из voice.md — загружаются один раз
let postProduct = null;    // товар, для которого открыт генератор (null — окно открыто кнопкой «Мои посты»)
const postTurn = {};       // какой шаблон брать следующим — отдельно для каждого настроения

// Откуда взялся текст в поле «Готовый пост»:
// { platform, mood, productName, favId } — favId есть, если пост открыт из Избранного
let currentPost = null;
let postEdited = false;    // текст правили вручную и ещё не сохранили

const FAV_KEY = "kiva-favorites";   // где в браузере хранится Избранное

// Названия площадок для подписей
const PLATFORM_NAMES = { instagram: "Instagram", telegram: "Telegram", vk: "ВКонтакте" };


/* ---------- 1. ХРАНИЛИЩЕ БРАУЗЕРА И МЕЛКИЕ ПОМОЩНИКИ ---------- */

// Читает список или объект из localStorage. Если там пусто или ошибка — fallback
function loadStore(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (error) { return fallback; }
}

function saveStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    showToast("Не удалось сохранить: хранилище браузера недоступно");
  }
}

// Защищает текст перед вставкой в HTML: «<b>» покажется как текст, а не как разметка
function escapeHTML(text) {
  const codes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, char => codes[char]);
}

// 1730282400000 → «30.10 в 13:00»
function formatDateTime(ms) {
  const date = new Date(ms);
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) + " в " +
    date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

// Текст из поля «Готовый пост»
function postText() {
  return document.getElementById("postResult").value.trim();
}


/* ---------- 2. ЗАГРУЗКА И РАЗБОР VOICE.MD ---------- */

// Превращает блоки ```settings имя в объект:
// { instagram: { length: "600", ... }, expert: { template: [...] }, ... }
function parseVoice(text) {
  const blocks = {};
  let current = null;

  text.split("\n").forEach(rawLine => {
    const line = rawLine.trim();

    if (line.startsWith("```settings")) {
      const name = line.replace("```settings", "").trim();
      current = blocks[name] = {};
      return;
    }
    if (line.startsWith("```")) { current = null; return; }
    if (!current || line === "" || line.startsWith("#")) return;

    const clean = line.replace(/\s+#.*$/, "");   // убираем комментарий
    const colon = clean.indexOf(":");
    if (colon === -1) return;

    const key = clean.slice(0, colon).trim();
    const value = clean.slice(colon + 1).trim();

    // Шаблонов несколько — собираем в список
    if (key === "template") {
      current.template = current.template || [];
      current.template.push(value);
    } else {
      current[key] = value;
    }
  });

  return blocks;
}

// Список через запятую → массив: "a, b, c" → ["a", "b", "c"]
function listOf(value) {
  return (value || "").split(",").map(item => item.trim()).filter(Boolean);
}

async function loadVoice() {
  try {
    const response = await fetch("voice.md");
    if (!response.ok) throw new Error(response.status);
    voice = parseVoice(await response.text());
  } catch (error) {
    voice = null;
  }
}


/* ---------- 3. ОТКРЫТИЕ ОКНА И ВКЛАДКИ ---------- */

// Из окна товара: форма заполнена данными товара
async function openPost(product) {
  postProduct = product;
  currentPost = null;

  // Предзаполняем поля из карточки товара
  document.getElementById("postProductName").textContent =
    `${product.name} · ${product.brand}, ${product.country}`;
  document.getElementById("postName").value = product.name;
  document.getElementById("postDesc").value = product.description;
  document.getElementById("postPrice").value = product.oldPrice
    ? `было ${formatPrice(product.oldPrice)} BYN, стало ${formatPrice(product.price)} BYN/м²`
    : `${formatPrice(product.price)} BYN/м²`;

  document.getElementById("postDescField").classList.remove("is-error");
  document.getElementById("postBack").hidden = false;
  document.getElementById("postNoProduct").hidden = true;
  setPost("");
  showTab("postTabPost");
  openLayer("postModal");

  if (!voice) await loadVoice();
  document.getElementById("postError").hidden = Boolean(voice);
  document.getElementById("postForm").hidden = !voice;
}

// Из шапки («Мои посты»): без товара — только Избранное, очередь и правка сохранённых постов
async function openMyPosts(tab) {
  postProduct = null;
  currentPost = null;

  document.getElementById("postProductName").textContent = "Избранное и запланированные посты";
  document.getElementById("postBack").hidden = true;
  document.getElementById("postForm").hidden = true;
  document.getElementById("postError").hidden = true;
  document.getElementById("postNoProduct").hidden = false;
  setPost("");
  showTab(tab);
  openLayer("postModal");

  // voice.md нужен для лимита длины и стоп-слов при правке
  if (!voice) await loadVoice();
}

// Показывает вкладку: postTabPost, postTabFav или postTabQueue
function showTab(id) {
  document.querySelectorAll("[data-tab]").forEach(tab => {
    tab.classList.toggle("is-active", tab.dataset.tab === id);
    tab.setAttribute("aria-selected", tab.dataset.tab === id);
  });
  document.querySelectorAll(".post__tab").forEach(panel => panel.hidden = panel.id !== id);

  if (id === "postTabFav") renderFavorites();
  if (id === "postTabQueue") renderQueue();   // telegram.js
  if (id === "postTabPost") fitPostHeight();
}


/* ---------- 4. СБОРКА ПОСТА ---------- */

function buildPost() {
  const moodKey = document.getElementById("postMood").value;
  const platformKey = document.getElementById("postForm").platform.value;
  const mood = voice[moodKey];
  const platform = voice[platformKey];
  const general = voice.general || {};

  if (!mood || !mood.template || !platform) {
    return { error: `В voice.md нет блока settings ${!platform ? platformKey : moodKey} или в нём нет шаблонов` };
  }

  // Шаблоны по очереди: каждое нажатие — следующий
  const turn = postTurn[moodKey] || 0;
  postTurn[moodKey] = turn + 1;
  let template = mood.template[turn % mood.template.length];

  // Эмодзи: столько, сколько разрешает площадка; лишние места убираем
  const emojiCount = Number(platform.emoji) || 0;
  listOf(mood.emoji).forEach((emoji, index) => {
    template = template.replaceAll(`{e${index + 1}}`, index < emojiCount ? emoji : "");
  });
  template = template.replace(/\{e\d\}/g, "");

  const values = {
    name: document.getElementById("postName").value.trim(),
    desc: document.getElementById("postDesc").value.trim(),
    price: document.getElementById("postPrice").value.trim(),
    brand: postProduct.brand,
    country: postProduct.country,
    type: postProduct.type.toLowerCase(),
    format: postProduct.format,
    address: general.address || "",
    phone: general.phone || ""
  };
  const fill = (template) =>
    template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));

  // «|» — новый абзац; чистим двойные пробелы, которые остались от убранных эмодзи
  const paragraphs = template.split("|")
    .map(part => fill(part.replace(/\s{2,}/g, " ").trim()))
    .filter(Boolean);
  if (platform.headline === "заглавные") paragraphs[0] = paragraphs[0].toUpperCase();

  const cta = fill(platform.cta || "");
  const tags = listOf(general.tags)
    .slice(0, Number(platform.hashtags) || 0)
    .map(tag => "#" + tag)
    .join(" ");

  const post = [...paragraphs, cta, tags].filter(Boolean).join("\n\n");
  return { post, platform: platformKey, mood: moodKey };
}


/* ---------- 5. ГОТОВЫЙ ПОСТ: ПОКАЗ, ПРАВКА, ПРОВЕРКИ ---------- */

// Кладёт текст в поле «Готовый пост» (пустая строка — очистить поле)
function setPost(text) {
  document.getElementById("postResult").value = text;
  postEdited = false;
  fitPostHeight();
  updatePostInfo();
}

// Поле растёт вместе с текстом, чтобы не прокручивать его внутри
function fitPostHeight() {
  const area = document.getElementById("postResult");
  if (area.offsetParent === null) return;   // вкладка скрыта — высоту не посчитать
  area.style.height = "auto";
  area.style.height = area.scrollHeight + 4 + "px";   // +4 — рамка сверху и снизу
}

// Лимит длины площадки из voice.md (0 — лимит неизвестен)
function postLimit() {
  const platform = currentPost && voice && voice[currentPost.platform];
  return platform ? Number(platform.length) || 0 : 0;
}

// Счётчик, предупреждения и доступность кнопок — после любого изменения текста
function updatePostInfo() {
  const text = postText();
  const limit = postLimit();
  const counter = document.getElementById("postCounter");

  counter.textContent = !text ? "" : limit ? `${text.length} / ${limit} символов` : `${text.length} символов`;
  counter.classList.toggle("is-over", limit > 0 && text.length > limit);

  // Предупреждения: стоп-слова и превышение длины
  const warnings = [];
  const stopwords = listOf(voice && voice.general && voice.general.stopwords);
  const found = stopwords.filter(word => text.toLowerCase().includes(word.toLowerCase()));
  if (found.length) warnings.push(`Стоп-слова в тексте: ${found.join(", ")}`);
  if (limit && text.length > limit) warnings.push("Пост длиннее лимита площадки — сократите текст");
  document.getElementById("postWarning").textContent = warnings.join(". ");

  document.getElementById("postCopy").disabled = !text;
  document.getElementById("postFav").disabled = !text;
  updateFavButton();
  updateTelegramButtons();   // telegram.js
}

// Ручная правка текста
function onPostInput() {
  // Текст набрали с нуля — считаем, что он для площадки, выбранной в форме
  if (!currentPost) {
    currentPost = {
      platform: document.getElementById("postForm").platform.value,
      mood: document.getElementById("postMood").value,
      productName: postProduct ? postProduct.name : "Без товара",
      favId: null
    };
  }
  postEdited = Boolean(postText());
  fitPostHeight();
  updatePostInfo();
}

// «Сформировать пост»
function onPostSubmit(event) {
  event.preventDefault();
  const desc = document.getElementById("postDesc");

  // Без описания пост не собираем
  if (!desc.value.trim()) {
    document.getElementById("postDescField").classList.add("is-error");
    desc.focus();
    return;
  }

  // Ручные правки не стираем без спроса
  if (postEdited && !confirm("Заменить отредактированный текст новым вариантом?")) return;

  const result = buildPost();
  if (result.error) {
    setPost("");
    document.getElementById("postWarning").textContent = result.error;
    return;
  }

  currentPost = { platform: result.platform, mood: result.mood, productName: postProduct.name, favId: null };
  setPost(result.post);
}


/* ---------- 6. КОПИРОВАНИЕ ---------- */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Запасной способ для старых браузеров
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  showToast("Пост скопирован");
}


/* ---------- 7. ИЗБРАННОЕ ----------
   Хранится в браузере (localStorage, ключ kiva-favorites) — список:
   { id, text, productName, platform, mood, savedAt }
   ----------------------------------------------------------- */

// «☆ В избранное» или «★ Обновить в избранном» — если пост открыт из Избранного
function updateFavButton() {
  document.getElementById("postFav").textContent =
    currentPost && currentPost.favId ? "★ Обновить в избранном" : "☆ В избранное";
}

function updateFavCount() {
  document.querySelectorAll("[data-fav-count]").forEach(count => count.textContent = loadStore(FAV_KEY).length);
}

function saveFavorite() {
  const favorites = loadStore(FAV_KEY);
  const existing = currentPost.favId && favorites.find(item => item.id === currentPost.favId);

  if (existing) {
    // Пост открыт из Избранного — правим ту же запись, без копии
    existing.text = postText();
    existing.savedAt = Date.now();
    showToast("★ Изменения сохранены в Избранном");
  } else {
    const item = {
      id: Date.now(),
      text: postText(),
      productName: currentPost.productName,
      platform: currentPost.platform,
      mood: currentPost.mood,
      savedAt: Date.now()
    };
    favorites.unshift(item);   // новые — сверху
    currentPost.favId = item.id;
    showToast("★ Пост сохранён в Избранное");
  }

  saveStore(FAV_KEY, favorites);
  postEdited = false;   // правки сохранены — повторная генерация их не потеряет
  updateFavButton();
  updateFavCount();
}

function renderFavorites() {
  const favorites = loadStore(FAV_KEY);
  const list = document.getElementById("favList");

  if (favorites.length === 0) {
    list.innerHTML = `<p class="saved__empty">Здесь появятся сохранённые посты</p>`;
    return;
  }

  list.innerHTML = favorites.map(item => `
    <article class="saved__item">
      <p class="saved__meta">${escapeHTML(item.productName)} · ${PLATFORM_NAMES[item.platform] || ""} · ${formatDateTime(item.savedAt)}</p>
      <p class="saved__text">${escapeHTML(item.text)}</p>
      <div class="saved__buttons">
        <button type="button" data-fav-action="open" data-id="${item.id}">Открыть</button>
        <button type="button" data-fav-action="copy" data-id="${item.id}">Скопировать</button>
        <button type="button" data-fav-action="delete" data-id="${item.id}">Удалить</button>
      </div>
    </article>`).join("");
}

// Пост из Избранного → в поле «Готовый пост», где его можно править и публиковать
function openFavorite(item) {
  currentPost = { platform: item.platform, mood: item.mood, productName: item.productName, favId: item.id };

  // Переключаем площадку и настроение в форме — как было при сохранении
  const form = document.getElementById("postForm");
  const radio = form.querySelector(`input[name="platform"][value="${item.platform}"]`);
  if (radio) radio.checked = true;
  if (item.mood) document.getElementById("postMood").value = item.mood;

  showTab("postTabPost");
  setPost(item.text);
}

function onFavoritesClick(event) {
  const button = event.target.closest("[data-fav-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const favorites = loadStore(FAV_KEY);
  const item = favorites.find(fav => fav.id === id);
  if (!item) return;

  if (button.dataset.favAction === "open") openFavorite(item);
  if (button.dataset.favAction === "copy") copyText(item.text);
  if (button.dataset.favAction === "delete" && confirm("Удалить пост из Избранного?")) {
    saveStore(FAV_KEY, favorites.filter(fav => fav.id !== id));
    if (currentPost && currentPost.favId === id) currentPost.favId = null;
    updateFavButton();
    updateFavCount();
    renderFavorites();
  }
}


/* ---------- 8. ПОДКЛЮЧЕНИЕ КНОПОК ---------- */

function setupPost() {
  const descField = document.getElementById("postDescField");

  document.getElementById("postDesc").addEventListener("input", () => descField.classList.remove("is-error"));
  document.getElementById("postForm").addEventListener("submit", onPostSubmit);
  document.getElementById("postResult").addEventListener("input", onPostInput);
  document.getElementById("postCopy").addEventListener("click", () => copyText(postText()));
  document.getElementById("postFav").addEventListener("click", saveFavorite);
  document.getElementById("favList").addEventListener("click", onFavoritesClick);

  // Вкладки
  document.querySelectorAll("[data-tab]").forEach(tab => {
    tab.addEventListener("click", () => showTab(tab.dataset.tab));
  });

  updateFavCount();
}

setupPost();
