/* =========================================================
   ПУБЛИКАЦИЯ В TELEGRAM И ОТЛОЖЕННЫЕ ПОСТЫ
   ---------------------------------------------------------
   Пост уходит в канал через Telegram Bot API прямо из браузера.
   Токен бота и адрес канала менеджер вводит в «Настройках Telegram»
   в окне генератора. Они хранятся только в этом браузере
   (localStorage), в коде и репозитории их нет.

   У ботов Telegram нет отложенной публикации, поэтому очередь
   проверяет сам сайт: пока он открыт с ?admin — раз в 30 секунд.
   Если в назначенное время сайт был закрыт, пост помечается
   «Пропущен» и сам не уходит — менеджер решает, публиковать ли.

   Как создать бота и подключить канал — README.md.

   1. Настройки: токен и канал
   2. Запросы к Telegram
   3. Публикация сейчас
   4. Очередь
   5. Плашка «Не опубликовано вовремя»
   6. Подключение кнопок и запуск
   ========================================================= */

const TG_SETTINGS_KEY = "kiva-telegram";   // где в браузере хранятся токен и канал
const QUEUE_KEY = "kiva-queue";            // где в браузере хранится очередь
const QUEUE_CHECK_EVERY = 30;              // как часто проверять очередь, в секундах
const MISSED_AFTER = 5;                    // через сколько минут после назначенного времени пост считается пропущенным
const TG_MAX_LENGTH = 4096;                // лимит Telegram на длину одного сообщения

const TG_NO_RIGHTS = "Бот не админ канала или у него нет права «Публикация сообщений»";


/* ---------- 1. НАСТРОЙКИ: ТОКЕН И КАНАЛ ---------- */

// { token, chat } или null, если настроек нет
function tgSettings() {
  return loadStore(TG_SETTINGS_KEY, null);
}

function tgReady() {
  const settings = tgSettings();
  return Boolean(settings && settings.token && settings.chat);
}

// Адрес канала в любом виде → как ждёт Telegram:
// «kiva_test», «t.me/kiva_test», «https://t.me/kiva_test» → «@kiva_test»; «-100…» не меняем
function normalizeChat(value) {
  const chat = value.trim().replace(/^(https?:\/\/)?t\.me\//, "");
  if (chat === "" || chat.startsWith("@") || /^-?\d+$/.test(chat)) return chat;
  return "@" + chat;
}

// Значения из полей настроек (ещё не сохранённые)
function settingsFromForm() {
  return {
    token: document.getElementById("tgToken").value.trim(),
    chat: normalizeChat(document.getElementById("tgChat").value)
  };
}

// Строка под настройками: type — "ok", "error" или пусто
function setTgStatus(text, type) {
  const status = document.getElementById("tgStatus");
  status.textContent = text;
  status.className = "tg__status" + (type ? ` is-${type}` : "");
}

function fillSettingsForm() {
  const settings = tgSettings() || { token: "", chat: "" };
  document.getElementById("tgToken").value = settings.token;
  document.getElementById("tgChat").value = settings.chat;
}

function saveSettings() {
  const settings = settingsFromForm();
  if (!settings.token || !settings.chat) {
    setTgStatus("Заполните токен и канал", "error");
    return;
  }
  saveStore(TG_SETTINGS_KEY, settings);
  document.getElementById("tgChat").value = settings.chat;
  setTgStatus("Настройки сохранены в этом браузере", "ok");
  updateTelegramButtons();
}

function forgetSettings() {
  try { localStorage.removeItem(TG_SETTINGS_KEY); } catch (error) { /* хранилище недоступно — удалять нечего */ }
  fillSettingsForm();
  setTgStatus("Токен и канал удалены из браузера", "ok");
  updateTelegramButtons();
}

// «Проверить подключение»: токен верный? канал есть? бот в нём админ?
async function checkConnection() {
  const settings = settingsFromForm();
  if (!settings.token || !settings.chat) {
    setTgStatus("Заполните токен и канал", "error");
    return;
  }

  setTgStatus("Проверяем…");
  try {
    const bot = await telegram("getMe", {}, settings);
    const chat = await telegram("getChat", { chat_id: settings.chat }, settings);
    const member = await telegram("getChatMember", { chat_id: settings.chat, user_id: bot.id }, settings);
    if (member.status !== "administrator" || member.can_post_messages === false) throw new Error(TG_NO_RIGHTS);
    setTgStatus(`✓ Бот @${bot.username} подключён к каналу «${chat.title}». Не забудьте сохранить`, "ok");
  } catch (error) {
    setTgStatus(error.message, "error");
  }
}


/* ---------- 2. ЗАПРОСЫ К TELEGRAM ---------- */

// Вызывает метод Bot API, например telegram("sendMessage", { chat_id, text }).
// Возвращает ответ Telegram или выбрасывает ошибку с понятным текстом
async function telegram(method, params, settings = tgSettings()) {
  if (!settings || !settings.token) throw new Error("Сначала заполните настройки Telegram");

  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${settings.token}/${method}`, {
      method: "POST",
      body: new URLSearchParams(params)   // обычная форма: браузер не делает лишний CORS-запрос
    });
  } catch (error) {
    throw new Error("Нет связи с Telegram. Проверьте интернет и попробуйте ещё раз");
  }

  const data = await response.json().catch(() => ({ ok: false, error_code: response.status }));
  if (!data.ok) throw new Error(tgErrorText(data));
  return data.result;
}

// Ответ Telegram с ошибкой → сообщение для менеджера
function tgErrorText(data) {
  const text = (data.description || "").toLowerCase();

  if (data.error_code === 401 || data.error_code === 404) return "Неверный токен бота. Скопируйте его из @BotFather ещё раз";
  if (text.includes("chat not found")) return "Канал не найден. Проверьте адрес: @имя_канала или -100…";
  if (data.error_code === 403 || text.includes("rights") || text.includes("not a member") || text.includes("inaccessible")) return TG_NO_RIGHTS;
  if (text.includes("too long")) return `Пост длиннее ${TG_MAX_LENGTH} символов — сократите текст`;
  return `Telegram ответил: «${data.description || data.error_code}»`;
}

// Отправляет текст в канал из настроек
function sendToChannel(text) {
  const settings = tgSettings();
  if (!settings) throw new Error("Сначала заполните настройки Telegram");
  // parse_mode не указываем: текст уходит как есть, символы * _ < > не ломают отправку
  return telegram("sendMessage", { chat_id: settings.chat, text }, settings);
}


/* ---------- 3. ПУБЛИКАЦИЯ СЕЙЧАС ---------- */

// Кнопки «Опубликовать» и «Запланировать» + подсказка под ними
function updateTelegramButtons() {
  const text = postText();
  const ready = tgReady();
  const tooLong = text.length > TG_MAX_LENGTH;
  const blocked = !text || !ready || tooLong;

  document.getElementById("tgPublish").disabled = blocked;
  document.getElementById("tgScheduleToggle").disabled = blocked;
  if (blocked) toggleSchedule(false);

  let hint = "";
  if (!ready) hint = "Чтобы публиковать, заполните «Настройки Telegram» ниже";
  else if (tooLong) hint = `Пост длиннее ${TG_MAX_LENGTH} символов — Telegram его не примет`;
  else if (text && currentPost && currentPost.platform !== "telegram") {
    hint = `Пост собран для ${PLATFORM_NAMES[currentPost.platform]} — длина и хэштеги могут не подойти Telegram`;
  }
  document.getElementById("tgHint").textContent = hint;
}

async function publishNow() {
  const button = document.getElementById("tgPublish");
  if (!confirm(`Опубликовать пост в канал ${tgSettings().chat}?`)) return;

  button.disabled = true;
  button.textContent = "Публикуем…";
  try {
    await sendToChannel(postText());
    showToast("✓ Пост опубликован в канале");
    updateTelegramButtons();
  } catch (error) {
    document.getElementById("tgHint").textContent = error.message;   // текст поста остаётся в поле
  } finally {
    button.textContent = "Опубликовать в Telegram";
    button.disabled = false;
  }
}


/* ---------- 4. ОЧЕРЕДЬ ----------
   Хранится в браузере (localStorage, ключ kiva-queue) — список:
   { id, text, productName, platform, at, status, error, publishedAt, sendingSince }
   at — время публикации в миллисекундах.
   status: waiting — ждёт · sending — отправляется · missed — пропущен ·
           error — ошибка · published — опубликован
   ----------------------------------------------------------- */

// Если открыто несколько вкладок, очередь меняет только одна за раз —
// так один пост не уйдёт дважды. В старых браузерах — без блокировки
function withQueueLock(work) {
  if (navigator.locks) return navigator.locks.request(QUEUE_KEY, work);
  return Promise.resolve(work());
}

// Читает очередь, даёт её изменить и сохраняет — всё под блокировкой
function changeQueue(change) {
  return withQueueLock(() => {
    const queue = loadStore(QUEUE_KEY);
    const result = change(queue);
    saveStore(QUEUE_KEY, queue);
    return result;
  });
}

// Дата → значение для поля datetime-local: «2026-10-30T14:00»
function toLocalInput(date) {
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Показывает или прячет блок выбора даты
function toggleSchedule(show) {
  const box = document.getElementById("tgSchedule");
  const input = document.getElementById("tgScheduleAt");
  box.hidden = !show;
  document.getElementById("tgScheduleToggle").setAttribute("aria-expanded", show);
  if (!show) return;

  // Раньше чем через минуту — нельзя; по умолчанию — начало следующего часа
  const now = new Date();
  input.min = toLocalInput(new Date(now.getTime() + 60 * 1000));
  if (!input.value || new Date(input.value) < now) {
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    input.value = toLocalInput(nextHour);
  }
}

async function addToQueue() {
  const field = document.getElementById("tgScheduleField");
  const input = document.getElementById("tgScheduleAt");
  const at = new Date(input.value).getTime();   // время по часам компьютера

  if (!input.value || isNaN(at) || at < Date.now() + 60 * 1000) {
    field.classList.add("is-error");
    input.focus();
    return;
  }
  field.classList.remove("is-error");

  const item = {
    id: Date.now(),
    text: postText(),
    productName: currentPost.productName,
    platform: currentPost.platform,
    at,
    status: "waiting",
    error: ""
  };
  await changeQueue(queue => { queue.push(item); });

  toggleSchedule(false);
  showToast(`Пост запланирован на ${formatDateTime(at)}`);
  refreshQueue();
}

// Главная проверка — раз в 30 секунд, пока сайт открыт с ?admin
async function checkQueue() {
  const now = Date.now();

  // Под блокировкой решаем, что отправить, а что пометить пропущенным
  const toSend = await changeQueue(queue => {
    const due = [];
    queue.forEach(item => {
      // Вкладку закрыли прямо во время отправки — статус неизвестен
      if (item.status === "sending" && now - item.sendingSince > 2 * 60 * 1000) {
        item.status = "error";
        item.error = "Отправка прервалась. Проверьте канал, прежде чем повторять";
      }
      if (item.status !== "waiting" || item.at > now) return;

      if (now - item.at > MISSED_AFTER * 60 * 1000) {
        item.status = "missed";     // время давно прошло — сами не публикуем
      } else {
        item.status = "sending";
        item.sendingSince = now;
        due.push(item);
      }
    });
    return due;
  });

  for (const item of toSend) {
    const ok = await sendQueued(item);
    showToast(ok ? "✓ Запланированный пост опубликован" : "Не удалось опубликовать запланированный пост — см. «Очередь»");
  }
  refreshQueue();
}

// Отправляет пост из очереди и записывает результат. Возвращает true, если получилось
async function sendQueued(item) {
  let change;
  try {
    await sendToChannel(item.text);
    change = { status: "published", publishedAt: Date.now(), error: "" };
  } catch (error) {
    change = { status: "error", error: error.message };
  }
  await changeQueue(queue => {
    const found = queue.find(entry => entry.id === item.id);
    if (found) Object.assign(found, change);
  });
  return change.status === "published";
}

// «Опубликовать сейчас» и «Повторить» — для пропущенных и с ошибкой
async function publishQueued(id) {
  const item = await changeQueue(queue => {
    const found = queue.find(entry => entry.id === id);
    if (!found || (found.status !== "missed" && found.status !== "error")) return null;
    found.status = "sending";
    found.sendingSince = Date.now();
    return found;
  });
  if (!item) return false;

  refreshQueue();
  const ok = await sendQueued(item);
  refreshQueue();
  return ok;
}

function removeFromQueue(id) {
  return changeQueue(queue => {
    const index = queue.findIndex(entry => entry.id === id);
    if (index !== -1) queue.splice(index, 1);
  });
}

// Подпись статуса и кнопки для каждого статуса
function queueItemHTML(item) {
  const statuses = {
    waiting: "Ожидает",
    sending: "Отправляется…",
    missed: "Пропущен — сайт был закрыт",
    error: `Ошибка: ${item.error}`,
    published: `Опубликован ${item.publishedAt ? formatDateTime(item.publishedAt) : ""}`
  };
  const buttons = {
    waiting: [["cancel", "Отменить"]],
    sending: [],
    missed: [["publish", "Опубликовать сейчас"], ["cancel", "Отменить"]],
    error: [["publish", "Повторить"], ["cancel", "Отменить"]],
    published: [["remove", "Убрать из списка"]]
  };

  return `
    <article class="saved__item">
      <p class="saved__meta">${escapeHTML(item.productName)} · на ${formatDateTime(item.at)}</p>
      <p class="saved__text">${escapeHTML(item.text)}</p>
      <p class="saved__status is-${item.status}">${escapeHTML(statuses[item.status])}</p>
      <div class="saved__buttons">
        ${buttons[item.status].map(([action, label]) =>
          `<button type="button" data-queue-action="${action}" data-id="${item.id}">${label}</button>`).join("")}
      </div>
    </article>`;
}

function renderQueue() {
  const queue = loadStore(QUEUE_KEY).sort((a, b) => a.at - b.at);
  document.getElementById("queueList").innerHTML = queue.length
    ? queue.map(queueItemHTML).join("")
    : `<p class="saved__empty">Здесь появятся запланированные посты</p>`;
}

// Счётчик на вкладке «Очередь» — всё, что ещё не опубликовано
function updateQueueCount() {
  const active = loadStore(QUEUE_KEY).filter(item => item.status !== "published").length;
  document.querySelectorAll("[data-queue-count]").forEach(count => count.textContent = active);
}

// Обновляет всё, что показывает очередь
function refreshQueue() {
  renderQueue();
  updateQueueCount();
  updateMissedAlert();
}

async function onQueueClick(event) {
  const button = event.target.closest("[data-queue-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.queueAction;

  if (action === "cancel" && confirm("Отменить публикацию этого поста?")) await removeFromQueue(id);
  if (action === "remove") await removeFromQueue(id);
  if (action === "publish") {
    if (!tgReady()) { showToast("Сначала заполните настройки Telegram"); return; }
    if (!confirm(`Опубликовать пост сейчас в канал ${tgSettings().chat}?`)) return;
    showToast(await publishQueued(id) ? "✓ Пост опубликован в канале" : "Не удалось опубликовать — см. текст ошибки");
  }
  refreshQueue();
}


/* ---------- 5. ПЛАШКА «НЕ ОПУБЛИКОВАНО ВОВРЕМЯ» ---------- */

function missedPosts() {
  return loadStore(QUEUE_KEY).filter(item => item.status === "missed");
}

function updateMissedAlert() {
  const count = IS_ADMIN ? missedPosts().length : 0;
  document.getElementById("queueAlert").hidden = count === 0;
  document.getElementById("queueAlertCount").textContent = count;
}

async function publishAllMissed() {
  const missed = missedPosts();
  if (!tgReady()) { showToast("Сначала заполните настройки Telegram"); return; }
  if (!confirm(`Опубликовать сейчас пропущенные посты (${missed.length}) в канал ${tgSettings().chat}?`)) return;

  let published = 0;
  for (const item of missed) {
    if (await publishQueued(item.id)) published++;
  }
  showToast(published === missed.length
    ? `✓ Опубликовано постов: ${published}`
    : `Опубликовано ${published} из ${missed.length} — остальные см. в «Очереди»`);
}


/* ---------- 6. ПОДКЛЮЧЕНИЕ КНОПОК И ЗАПУСК ---------- */

function setupTelegram() {
  fillSettingsForm();

  document.getElementById("tgShowToken").addEventListener("click", event => {
    const input = document.getElementById("tgToken");
    input.type = input.type === "password" ? "text" : "password";
    event.target.textContent = input.type === "password" ? "показать" : "скрыть";
  });
  document.getElementById("tgCheck").addEventListener("click", checkConnection);
  document.getElementById("tgSave").addEventListener("click", saveSettings);
  document.getElementById("tgForget").addEventListener("click", forgetSettings);

  document.getElementById("tgPublish").addEventListener("click", publishNow);
  document.getElementById("tgScheduleToggle").addEventListener("click", () => {
    toggleSchedule(document.getElementById("tgSchedule").hidden);
  });
  document.getElementById("tgScheduleAdd").addEventListener("click", addToQueue);
  document.getElementById("tgScheduleAt").addEventListener("input", () => {
    document.getElementById("tgScheduleField").classList.remove("is-error");
  });

  document.getElementById("queueList").addEventListener("click", onQueueClick);
  document.getElementById("queueAlertPublish").addEventListener("click", publishAllMissed);
  document.getElementById("queueAlertOpen").addEventListener("click", () => openMyPosts("postTabQueue"));

  // Очередь или Избранное изменили в другой вкладке — обновляем и здесь
  window.addEventListener("storage", event => {
    if (event.key === QUEUE_KEY) refreshQueue();
    if (event.key === FAV_KEY) updateFavCount();
  });

  updateTelegramButtons();
  updateQueueCount();
}

setupTelegram();

// Очередь проверяем только в режиме менеджера
if (IS_ADMIN) {
  checkQueue();
  setInterval(checkQueue, QUEUE_CHECK_EVERY * 1000);
}
