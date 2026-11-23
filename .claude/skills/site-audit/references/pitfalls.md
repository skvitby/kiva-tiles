# Ловушки и экономия токенов

Найдено на пилотном аудите. Читать перед работой в браузере.

## Защита от ботов (JS-заглушка)

Признак — заголовок «Секундочку…», «One moment, please», «Just a moment» и страница в 10–15 КБ без содержимого.

- **curl** часто получает реальную страницу, **встроенный fetch Node и headless-Chrome (Lighthouse)** — заглушку: защита смотрит на отпечаток соединения, а не только на User-Agent. Поэтому `seo_check.mjs` ходит через curl.
- **Playwright** проходит заглушку за 2–5 секунд: после `browser_navigate` подождите `browser_wait_for` с `textGone` заголовка заглушки.
- Не подменяйте User-Agent на поисковых роботов и не обходите защиту другими способами — это вне рамок аудита. Факт заглушки — сам по себе находка для критерия 2.16 «Роботы получают содержимое».
- **Lighthouse** на таком сайте измеряет заглушку и ставит ~100 баллов. Признак — вес страницы около 13 КБ и 2 запроса. Такие цифры в отчёт не идут; скорость меряйте в браузере (ниже).
- Защита может включиться после серии запросов. Если скрипт вдруг выдаёт robots 200 с HTML-содержимым или 404-страница отвечает 200 — проверьте одну страницу curl вручную и сделайте паузу.

## Кириллица в адресах

- curl с некодированным кириллическим путём может получить 404 на рабочей странице. Кодируйте URL (`new URL()` в Node делает это сам).
- `fetch` изнутри страницы тоже: некодированный путь может молча вернуть **другую** страницу (например, пустой раздел) — и вы сделаете ложный вывод «раздел пустой». Всегда `fetch(encodeURI(path))`, а если путь уже из `href` — берите `a.href` (он закодирован).
- Git Bash превращает аргумент `/Контакты/` в `C:/Program Files/Git/Контакты/`. Передавайте в `--pages` полные URL.

## Скорость

Замер «без кэша» честен только при **первом** заходе на сайт в сессии браузера. Поэтому листинг открывайте первым, сразу снимите выражение «Скорость», и только потом — остальное. Если первым уже открыта другая страница — пометьте замер «с частичным кэшем».

## Скриншоты

- Скриншот может падать по таймауту «waiting for fonts to load»: на странице не догружается шрифт. Подождите 10–20 с и повторите один раз; если снова — зафиксируйте как факт (тяжёлые ресурсы) и не тратьте попытки.
- Сохраняйте только ключевые: `filename` относительно корня проекта, в папку скриншотов из контекста. Служебные снимки Playwright пишет в `.playwright-mcp/` — её не коммитят.

## Экономия токенов

- `browser_navigate` и другие действия возвращают ссылку на файл снимка — не читайте его целиком. Данные берите `browser_evaluate`.
- Скриншот через Read стоит ~1–2 тыс. токенов; смотрите только те, по которым делаете вывод о вёрстке.
- Блок 2 почти целиком закрывает `seo_check.mjs` — не повторяйте эти проверки вручную.

## Готовые выражения для browser_evaluate

Сводка страницы (заголовки, ссылки меню, формы, мессенджеры, текст). В конструкторах часто нет тегов `nav`/`header` — тогда смотрите `allLinks`:

```js
() => { const t = s => [...document.querySelectorAll(s)];
  const links = s => [...new Set(t(s).map(a => a.innerText.trim().slice(0, 40) + ' → ' + decodeURI(a.getAttribute('href') || '')).filter(x => !x.startsWith(' →')))];
  return { title: document.title, h: t('h1,h2,h3').map(e => e.tagName + ': ' + e.innerText.trim().slice(0, 80)).slice(0, 20),
    nav: links('nav a, header a').slice(0, 25), allLinks: links('a').slice(0, 40),
    forms: t('form').length, fields: t('input,select,textarea').filter(i => i.type !== 'hidden').map(i => (i.placeholder || i.name) + ':' + i.type).slice(0, 20),
    messengers: t('a[href*="viber"],a[href*="t.me"],a[href*="wa.me"],a[href*="whatsapp"]').length,
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 2000) }; }
```

Карточка товара (фото, alt, кнопки, текст):

```js
() => { const t = s => [...document.querySelectorAll(s)];
  return { title: document.title, h1: t('h1').map(e => e.innerText.trim()),
    imgs: t('img').filter(i => i.naturalWidth > 150).map(i => ({ alt: i.alt, w: i.naturalWidth })).slice(0, 10),
    buttons: t('button, .btn, [type=submit]').map(b => b.innerText.trim()).filter(Boolean).slice(0, 10),
    text: (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 1800) }; }
```

Ещё 2–4 карточки без перехода (дешевле навигации). Ограничение: фото из JS-галереи так не видны — фото и alt проверяйте на карточке, открытой в браузере:

```js
async () => { const urls = [/* a.href ссылок на карточки из разных категорий */]; const out = [];
  for (const u of urls) { const r = await fetch(u); const d = new DOMParser().parseFromString(await r.text(), 'text/html');
    d.querySelectorAll('script,style').forEach(e => e.remove());
    out.push({ u: decodeURI(u).slice(-60), status: r.status, title: d.title, h1: [...d.querySelectorAll('h1')].map(e => e.textContent.trim()),
      text: (d.querySelector('main') || d.body).textContent.replace(/\s+/g, ' ').slice(0, 600) }); }
  return out; }
```

Мобильное меню. В конструкторах «бургер» часто не `button`, а `span`/`div` — ищите по классу и по положению в шапке:

```js
() => { const c = [...document.querySelectorAll('[class*=burger],[class*=hamburger],[class*=toggle],[class*=collaps],[class*=menu-btn],[aria-label*=enu]')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 15 && r.width < 80 && r.top < 200; });
  return c.slice(0, 5).map(e => ({ tag: e.tagName, cls: String(e.className).slice(0, 60), box: e.getBoundingClientRect().toJSON() })); }
```

Кликните найденный элемент (`browser_click` с селектором по классу) и проверьте, что пункты меню стали видимы.

Мобильная вёрстка (горизонтальный скролл, где начинается первый товар):

```js
() => ({ scrollW: document.documentElement.scrollWidth, vw: innerWidth,
  overflow: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 2).slice(0, 5).map(e => e.tagName + '.' + String(e.className).slice(0, 40)) })
```

Скорость (после загрузки без кэша — первый заход на страницу):

```js
() => { const n = performance.getEntriesByType('navigation')[0]; const r = performance.getEntriesByType('resource');
  const img = r.filter(x => x.initiatorType === 'img');
  return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), requests: r.length,
    slowest: r.map(x => [x.name.slice(0, 80), Math.round(x.duration)]).sort((a, b) => b[1] - a[1]).slice(0, 5),
    imgKB: img.map(x => Math.round(x.encodedBodySize / 1024)).sort((a, b) => b - a).slice(0, 8) }; }
```

Замечание: долгие загрузки могут быть из-за сети проверяющего. Если цифры резко хуже ожидаемого — пометьте *(гипотеза: часть задержки — сеть)*.
