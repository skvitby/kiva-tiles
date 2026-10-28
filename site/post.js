/* =========================================================
   ГЕНЕРАТОР ПОСТОВ ДЛЯ СОЦСЕТЕЙ
   ---------------------------------------------------------
   Кнопка «Пост для соцсетей» видна в окне товара только
   в режиме менеджера: index.html?admin (см. script.js).

   Стиль постов — длина, эмодзи, хэштеги, CTA, шаблоны —
   задаётся в voice.md. Здесь только логика, тексты не правьте.

   voice.md загружается через fetch, поэтому генератор работает
   на GitHub Pages или через локальный сервер (Live Server).
   При открытии файла двойным кликом браузер загрузку запретит.

   1. Загрузка и разбор voice.md
   2. Открытие окна
   3. Сборка поста
   4. Копирование
   ========================================================= */

let voice = null;          // настройки из voice.md — загружаются один раз
let postProduct = null;    // товар, для которого открыт генератор
const postTurn = {};       // какой шаблон брать следующим — отдельно для каждого настроения


/* ---------- 1. ЗАГРУЗКА И РАЗБОР VOICE.MD ---------- */

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


/* ---------- 2. ОТКРЫТИЕ ОКНА ---------- */

async function openPost(product) {
  postProduct = product;

  // Предзаполняем поля из карточки товара
  document.getElementById("postProductName").textContent =
    `${product.name} · ${product.brand}, ${product.country}`;
  document.getElementById("postName").value = product.name;
  document.getElementById("postDesc").value = product.description;
  document.getElementById("postPrice").value = product.oldPrice
    ? `было ${formatPrice(product.oldPrice)} BYN, стало ${formatPrice(product.price)} BYN/м²`
    : `${formatPrice(product.price)} BYN/м²`;

  document.getElementById("postDescField").classList.remove("is-error");
  showPost("");
  openLayer("postModal");

  if (!voice) await loadVoice();
  document.getElementById("postError").hidden = Boolean(voice);
  document.getElementById("postWork").hidden = !voice;
}

// Показывает готовый пост (пустая строка — подсказка вместо поста)
function showPost(text, limit) {
  const result = document.getElementById("postResult");
  const counter = document.getElementById("postCounter");
  const copy = document.getElementById("postCopy");

  result.textContent = text || "Заполните поля и нажмите «Сформировать пост». Повторное нажатие даёт другой вариант текста.";
  result.classList.toggle("is-empty", !text);
  copy.disabled = !text;

  counter.textContent = text ? `${text.length} / ${limit} символов` : "";
  counter.classList.toggle("is-over", Boolean(text) && text.length > limit);
  document.getElementById("postWarning").textContent = "";
}


/* ---------- 3. СБОРКА ПОСТА ---------- */

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
  return { post, limit: Number(platform.length) || 0, stopwords: listOf(general.stopwords) };
}

function setupPost() {
  const form = document.getElementById("postForm");
  const descField = document.getElementById("postDescField");
  const desc = document.getElementById("postDesc");

  desc.addEventListener("input", () => descField.classList.remove("is-error"));

  form.addEventListener("submit", event => {
    event.preventDefault();

    // Без описания пост не собираем
    if (!desc.value.trim()) {
      descField.classList.add("is-error");
      desc.focus();
      return;
    }

    const result = buildPost();
    if (result.error) {
      showPost("");
      document.getElementById("postWarning").textContent = result.error;
      return;
    }

    showPost(result.post, result.limit);

    // Предупреждения: стоп-слова и превышение длины
    const lower = result.post.toLowerCase();
    const found = result.stopwords.filter(word => lower.includes(word.toLowerCase()));
    const warnings = [];
    if (found.length) warnings.push(`Стоп-слова в тексте: ${found.join(", ")}`);
    if (result.post.length > result.limit) warnings.push("Пост длиннее лимита площадки — сократите описание");
    document.getElementById("postWarning").textContent = warnings.join(". ");
  });

  document.getElementById("postCopy").addEventListener("click", copyPost);
}


/* ---------- 4. КОПИРОВАНИЕ ---------- */

async function copyPost() {
  const text = document.getElementById("postResult").textContent;
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

setupPost();
