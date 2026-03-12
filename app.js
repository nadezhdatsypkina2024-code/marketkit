// ════════════════════════════════════════════
//  MarketKit — Main Application
// ════════════════════════════════════════════

let utmLinks = [];
let mediaChannels = [];
let competitors = [];
let abcData = [];
let abcChartInstance = null;
let mediaChartInstance = null;

// ── Navigation ──────────────────────────────
function showTool(toolName) {
  document.querySelectorAll('.tool-section').forEach(s => s.classList.remove('active'));
  document.querySelector('.hero').style.display = 'none';
  const section = document.getElementById('tool-' + toolName);
  if (section) {
    section.classList.add('active');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.querySelectorAll('.nav-link').forEach(a => {
    a.style.color = a.dataset.tool === toolName ? 'var(--accent)' : '';
    a.style.background = a.dataset.tool === toolName ? 'var(--accent-dim)' : '';
  });
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showTool(link.dataset.tool);
  });
});

// ════════════════════════════════════════════
//  01 — ABC ANALYSIS
// ════════════════════════════════════════════

function handleABCFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      document.getElementById('abcManual').value = e.target.result;
    }
    document.getElementById('abcUpload').style.borderColor = 'var(--green)';
    document.getElementById('abcUpload').querySelector('.upload-text').textContent = '✅ ' + file.name + ' загружен';
  };
  reader.readAsText(file, 'UTF-8');
}

// Drag & drop
const uploadArea = document.getElementById('abcUpload');
if (uploadArea) {
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = document.getElementById('abcFile');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      handleABCFile({ target: { files: [file] } });
    }
  });
}

function runABC() {
  const raw = document.getElementById('abcManual').value.trim();
  const delim = document.getElementById('abcDelim').value;
  const threshA = parseFloat(document.getElementById('abcThreshA').value) || 80;
  const threshB = parseFloat(document.getElementById('abcThreshB').value) || 15;

  if (!raw) { alert('Введи данные или загрузи файл!'); return; }

  const lines = raw.split('\n').filter(l => l.trim());
  abcData = [];

  for (const line of lines) {
    const parts = line.split(delim);
    if (parts.length < 2) continue;
    const name = parts[0].trim();
    const val = parseFloat(parts[1].replace(',', '.').replace(/\s/g, ''));
    if (name && !isNaN(val) && val >= 0) {
      abcData.push({ name, value: val });
    }
  }

  if (abcData.length === 0) { alert('Не удалось прочитать данные. Проверь формат и разделитель.'); return; }

  abcData.sort((a, b) => b.value - a.value);
  const total = abcData.reduce((s, d) => s + d.value, 0);

  let cumulative = 0;
  abcData.forEach(item => {
    cumulative += item.value;
    const pct = (cumulative / total) * 100;
    if (pct <= threshA) item.category = 'A';
    else if (pct <= threshA + threshB) item.category = 'B';
    else item.category = 'C';
    item.share = ((item.value / total) * 100).toFixed(1);
    item.cumulative = pct.toFixed(1);
  });

  renderABC(threshA, threshB);
}

function renderABC(threshA, threshB) {
  const aItems = abcData.filter(d => d.category === 'A');
  const bItems = abcData.filter(d => d.category === 'B');
  const cItems = abcData.filter(d => d.category === 'C');
  const total = abcData.reduce((s, d) => s + d.value, 0);

  const aVal = aItems.reduce((s, d) => s + d.value, 0);
  const bVal = bItems.reduce((s, d) => s + d.value, 0);
  const cVal = cItems.reduce((s, d) => s + d.value, 0);

  document.getElementById('abcSummary').innerHTML = `
    <div class="abc-cat a">
      <div class="abc-cat-label">A</div>
      <div class="abc-cat-count">${aItems.length}</div>
      <div class="abc-cat-sub">позиций · ${threshA}% выручки</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px">${fmt(aVal)} ₽</div>
    </div>
    <div class="abc-cat b">
      <div class="abc-cat-label">B</div>
      <div class="abc-cat-count">${bItems.length}</div>
      <div class="abc-cat-sub">позиций · ${threshB}% выручки</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px">${fmt(bVal)} ₽</div>
    </div>
    <div class="abc-cat c">
      <div class="abc-cat-label">C</div>
      <div class="abc-cat-count">${cItems.length}</div>
      <div class="abc-cat-sub">позиций · остаток</div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px">${fmt(cVal)} ₽</div>
    </div>
  `;

  document.getElementById('abcInsights').innerHTML = `
    💡 <strong>Ключевые выводы:</strong><br>
    • Группа <strong>A</strong> (${aItems.length} позиций = ${((aItems.length/abcData.length)*100).toFixed(0)}% ассортимента) генерирует ${threshA}% выручки — это твои приоритеты для максимального контроля запасов и продвижения<br>
    • Группа <strong>B</strong> (${bItems.length} позиций) — середнячки, требуют регулярного мониторинга<br>
    • Группа <strong>C</strong> (${cItems.length} позиций = ${((cItems.length/abcData.length)*100).toFixed(0)}% ассортимента) приносит лишь ${(100-threshA-threshB).toFixed(0)}% выручки — кандидаты на оптимизацию или вывод
  `;

  if (abcChartInstance) abcChartInstance.destroy();
  const ctx = document.getElementById('abcChart').getContext('2d');
  const top20 = abcData.slice(0, Math.min(20, abcData.length));
  abcChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top20.map(d => d.name.length > 15 ? d.name.slice(0, 15) + '…' : d.name),
      datasets: [{
        label: 'Значение',
        data: top20.map(d => d.value),
        backgroundColor: top20.map(d => d.category === 'A' ? 'rgba(232,255,71,0.7)' : d.category === 'B' ? 'rgba(91,143,255,0.7)' : 'rgba(144,144,176,0.4)'),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)} | ${abcData[ctx.dataIndex]?.category}` }
        }
      },
      scales: {
        x: { ticks: { color: '#9090b0', font: { size: 10 } }, grid: { color: 'rgba(37,37,53,0.6)' } },
        y: { ticks: { color: '#9090b0', callback: v => fmt(v) }, grid: { color: 'rgba(37,37,53,0.6)' } }
      }
    }
  });

  const tbody = document.getElementById('abcTable');
  tbody.innerHTML = `<thead><tr><th>#</th><th>Название</th><th>Значение</th><th>Доля %</th><th>Накопленное %</th><th>Категория</th></tr></thead><tbody>` +
    abcData.map((d, i) => `
      <tr>
        <td style="color:var(--text3)">${i + 1}</td>
        <td>${d.name}</td>
        <td>${fmt(d.value)}</td>
        <td>${d.share}%</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:60px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
              <div style="width:${d.cumulative}%;height:100%;background:${d.category==='A'?'var(--accent)':d.category==='B'?'var(--blue)':'var(--text3)'};border-radius:3px"></div>
            </div>
            ${d.cumulative}%
          </div>
        </td>
        <td><span class="badge badge-${d.category.toLowerCase()}">${d.category}</span></td>
      </tr>
    `).join('') + '</tbody>';

  document.getElementById('abcResults').style.display = 'block';
}

function exportABC() {
  if (!abcData.length) return;
  const ws = XLSX.utils.json_to_sheet(abcData.map((d, i) => ({
    '№': i + 1,
    'Название': d.name,
    'Значение': d.value,
    'Доля %': d.share,
    'Накопленное %': d.cumulative,
    'Категория': d.category
  })));

  const colWidths = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 10 }];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ABC-анализ');

  const summaryData = [
    { 'Категория': 'A', 'Кол-во позиций': abcData.filter(d => d.category === 'A').length, 'Сумма': abcData.filter(d => d.category === 'A').reduce((s, d) => s + d.value, 0) },
    { 'Категория': 'B', 'Кол-во позиций': abcData.filter(d => d.category === 'B').length, 'Сумма': abcData.filter(d => d.category === 'B').reduce((s, d) => s + d.value, 0) },
    { 'Категория': 'C', 'Кол-во позиций': abcData.filter(d => d.category === 'C').length, 'Сумма': abcData.filter(d => d.category === 'C').reduce((s, d) => s + d.value, 0) },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Сводка');
  XLSX.writeFile(wb, 'ABC-анализ.xlsx');
}

// ════════════════════════════════════════════
//  02 — SEO AUDIT
// ════════════════════════════════════════════

async function runSEO() {
  const url = document.getElementById('seoUrl').value.trim();
  if (!url || !url.startsWith('http')) { alert('Введи корректный URL (начиная с https://)'); return; }

  document.getElementById('seoResults').style.display = 'none';
  const loading = document.getElementById('seoLoading');
  loading.style.display = 'flex';
  document.getElementById('seoLoadingText').textContent = 'Загружаю страницу...';

  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    let html = '';

    try {
      const res = await fetch(proxyUrl);
      const data = await res.json();
      html = data.contents || '';
      document.getElementById('seoLoadingText').textContent = 'Анализирую структуру...';
    } catch (e) {
      html = '';
    }

    await new Promise(r => setTimeout(r, 800));
    document.getElementById('seoLoadingText').textContent = 'Формирую отчёт...';
    await new Promise(r => setTimeout(r, 600));

    renderSEOReport(url, html);
  } catch (e) {
    loading.style.display = 'none';
    alert('Не удалось получить данные. Проверь URL или попробуй позже.');
  }

  loading.style.display = 'none';
}

function renderSEOReport(url, html) {
  const domain = new URL(url).hostname;
  document.getElementById('seoUrlDisplay').textContent = domain;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Extract data
  const title = doc.querySelector('title')?.textContent?.trim() || '';
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
  const metaKeys = doc.querySelector('meta[name="keywords"]')?.getAttribute('content')?.trim() || '';
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || '';
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '';
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')?.trim() || '';
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || '';
  const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content')?.trim() || '';
  const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content')?.trim() || '';
  const charset = doc.querySelector('meta[charset]')?.getAttribute('charset') || '';
  const lang = doc.querySelector('html')?.getAttribute('lang') || '';

  const h1s = Array.from(doc.querySelectorAll('h1')).map(h => h.textContent.trim()).filter(Boolean);
  const h2s = Array.from(doc.querySelectorAll('h2')).map(h => h.textContent.trim()).filter(Boolean);
  const h3s = Array.from(doc.querySelectorAll('h3')).map(h => h.textContent.trim()).filter(Boolean);

  const images = Array.from(doc.querySelectorAll('img'));
  const imagesNoAlt = images.filter(img => !img.getAttribute('alt'));
  const links = Array.from(doc.querySelectorAll('a[href]'));
  const internalLinks = links.filter(a => { try { const h = new URL(a.href, url).hostname; return h === domain || h === 'www.' + domain; } catch { return false; } });
  const externalLinks = links.filter(a => { try { const h = new URL(a.href, url).hostname; return h !== domain && h !== 'www.' + domain && a.href.startsWith('http'); } catch { return false; } });
  const nofollow = links.filter(a => a.rel?.includes('nofollow'));

  const bodyText = doc.body?.innerText || doc.body?.textContent || '';
  const wordCount = bodyText.trim().split(/\s+/).filter(Boolean).length;
  const hasSchema = html.includes('application/ld+json') || html.includes('itemtype=') || html.includes('itemscope');
  const hasSitemap = html.includes('sitemap');
  const hasHttps = url.startsWith('https://');

  // Score calculation
  let score = 0;
  let issues = 0;

  if (title) { score += 15; } else { issues++; }
  if (title.length >= 30 && title.length <= 70) score += 5; else if (title) { issues++; }
  if (metaDesc) { score += 15; } else { issues++; }
  if (metaDesc.length >= 120 && metaDesc.length <= 160) score += 5; else if (metaDesc) { issues++; }
  if (h1s.length === 1) score += 10; else { issues++; }
  if (h2s.length >= 2) score += 5;
  if (images.length > 0 && imagesNoAlt.length === 0) score += 10; else if (imagesNoAlt.length > 0) issues++;
  if (canonical) score += 5; else issues++;
  if (hasHttps) score += 5; else issues++;
  if (viewport) score += 5; else issues++;
  if (lang) score += 5; else issues++;
  if (ogTitle) score += 5;
  if (ogImage) score += 5;
  if (hasSchema) score += 5;
  if (wordCount >= 300) score += 5; else issues++;

  score = Math.min(100, score);
  const scoreColor = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--accent)' : score >= 40 ? 'var(--orange)' : 'var(--red)';
  const scoreLabel = score >= 80 ? 'Хорошо' : score >= 60 ? 'Средне' : score >= 40 ? 'Требует работы' : 'Критично';

  document.getElementById('seoScore').innerHTML = `
    <div class="seo-score-circle" style="background:${scoreColor}20;border:3px solid ${scoreColor};color:${scoreColor}">${score}</div>
    <div class="seo-score-info">
      <h4>${scoreLabel} — SEO оценка ${score}/100</h4>
      <p>Найдено проблем: <strong style="color:var(--orange)">${issues}</strong>. Проверено параметров: 15+</p>
    </div>
  `;

  const s = (cond, good, bad, rec = '') => `
    <div class="seo-item">
      <span class="seo-status">${cond ? '✅' : '❌'}</span>
      <div class="seo-item-content">
        <div class="seo-item-label">${cond ? good : bad}</div>
        ${rec && !cond ? `<div class="seo-rec">📌 ${rec}</div>` : ''}
      </div>
    </div>
  `;

  const info = (label, val, note = '') => `
    <div class="seo-item">
      <span class="seo-status">ℹ️</span>
      <div class="seo-item-content">
        <div class="seo-item-label">${label}</div>
        ${val ? `<div class="seo-item-value">${val}</div>` : ''}
        ${note ? `<div class="seo-rec">📌 ${note}</div>` : ''}
      </div>
    </div>
  `;

  document.getElementById('seoReport').innerHTML = `
    <div class="seo-section">
      <div class="seo-section-title">📄 Основные мета-теги</div>
      ${s(!!title, `Title: "${title.slice(0, 60)}${title.length > 60 ? '…' : ''}"`, 'Title отсутствует!', 'Добавь тег <title> — это самый важный SEO-элемент страницы')}
      ${s(title.length >= 30 && title.length <= 70, `Длина Title: ${title.length} символов (норма 30-70)`, `Длина Title: ${title.length} символов — ${title.length < 30 ? 'слишком короткий' : 'слишком длинный'}`, title.length < 30 ? 'Расширь Title до 50-70 символов, включи ключевые слова' : 'Сократи Title до 60-70 символов — остальное обрежет Google')}
      ${s(!!metaDesc, `Description: "${(metaDesc || '').slice(0, 80)}${metaDesc.length > 80 ? '…' : ''}"`, 'Meta Description отсутствует!', 'Добавь meta description — влияет на CTR в поиске')}
      ${s(metaDesc.length >= 120 && metaDesc.length <= 160, `Длина Description: ${metaDesc.length} символов`, `Длина Description: ${metaDesc.length} символов — ${metaDesc.length < 120 ? 'короткий' : 'слишком длинный'}`, 'Оптимальная длина 130-155 символов. Включи ключевые слова и призыв к действию')}
      ${metaKeys ? info('Meta Keywords', metaKeys.slice(0, 100) + (metaKeys.length > 100 ? '…' : ''), 'Google игнорирует meta keywords, но Яндекс учитывает') : ''}
    </div>

    <div class="seo-section">
      <div class="seo-section-title">📐 Структура заголовков</div>
      ${s(h1s.length === 1, `H1: "${(h1s[0] || '').slice(0, 50)}…"`, h1s.length === 0 ? 'H1 отсутствует!' : `H1: найдено ${h1s.length} штуки — должен быть ОДИН`, h1s.length === 0 ? 'Добавь один H1 с главным ключевым словом страницы' : 'Оставь только один H1 на странице — это правило №1')}
      ${s(h2s.length >= 2, `H2: найдено ${h2s.length} заголовков`, `H2: найдено ${h2s.length} — маловато`, 'Структурируй контент через H2 (разделы) и H3 (подразделы)')}
      ${h2s.slice(0, 3).map(h => info('H2', h.slice(0, 80))).join('')}
      ${info(`H3: найдено ${h3s.length} заголовков`, h3s.length > 0 ? h3s.slice(0, 2).join(' / ').slice(0, 100) : 'Нет H3')}
    </div>

    <div class="seo-section">
      <div class="seo-section-title">🖼️ Изображения и ссылки</div>
      ${s(images.length > 0 && imagesNoAlt.length === 0, `Все ${images.length} изображений имеют alt-теги`, imagesNoAlt.length > 0 ? `${imagesNoAlt.length} изображений без alt из ${images.length}` : 'Изображений не найдено', 'Добавь alt-теги ко всем изображениям с описанием + ключевыми словами')}
      ${info(`Внутренние ссылки: ${internalLinks.length}`, '', internalLinks.length < 3 ? 'Добавь больше внутренних ссылок для перелинковки' : '')}
      ${info(`Внешние ссылки: ${externalLinks.length}`, '', externalLinks.length > 20 ? 'Много внешних ссылок — добавь rel="nofollow" на ненужные' : '')}
      ${info(`Nofollow ссылок: ${nofollow.length}`, '')}
    </div>

    <div class="seo-section">
      <div class="seo-section-title">⚙️ Технические параметры</div>
      ${s(hasHttps, 'HTTPS: сайт защищён', 'HTTPS: сайт не защищён!', 'Обязательно переедь на HTTPS — Google понижает http-сайты')}
      ${s(!!canonical, `Canonical: ${canonical ? canonical.slice(0, 50) : ''}`, 'Canonical тег отсутствует', 'Добавь <link rel="canonical"> для предотвращения дублей')}
      ${s(!!viewport, 'Viewport: настроен (мобильная версия)', 'Viewport отсутствует — нет адаптации под мобильные!', 'Добавь <meta name="viewport" content="width=device-width, initial-scale=1">')}
      ${s(!!lang, `Язык страницы: ${lang}`, 'Атрибут lang не задан у тега <html>', 'Добавь lang="ru" в тег <html>')}
      ${s(!!charset, `Кодировка: ${charset || 'указана в HTTP'}`, 'Кодировка не задана')}
      ${s(!robots.includes('noindex'), `Robots: ${robots || 'не задан (разрешено всё)'}`, 'Страница закрыта от индексации (noindex)!', 'Удали noindex если хочешь, чтобы страница появилась в поиске')}
    </div>

    <div class="seo-section">
      <div class="seo-section-title">📱 Open Graph (соцсети)</div>
      ${s(!!ogTitle, `OG Title: "${(ogTitle || '').slice(0, 60)}"`, 'og:title отсутствует', 'Добавь og:title — влияет на отображение при шаринге в соцсетях')}
      ${s(!!ogDesc, `OG Description: ${(ogDesc || '').slice(0, 60)}…`, 'og:description отсутствует', 'Добавь og:description для красивых превью в соцсетях')}
      ${s(!!ogImage, 'OG Image: задана', 'og:image отсутствует', 'Добавь og:image (1200×630px) — картинка при шаринге')}
    </div>

    <div class="seo-section">
      <div class="seo-section-title">📝 Контент и структура</div>
      ${s(wordCount >= 300, `Слов на странице: ~${wordCount}`, `Слов на странице: ~${wordCount} — маловато`, 'Минимум 300-500 слов для SEO. Для конкурентных запросов — 1000-2000+')}
      ${s(hasSchema, 'Schema.org разметка найдена', 'Schema.org разметка отсутствует', 'Добавь структурированные данные — помогает с rich snippets в поиске')}
      ${info('Итого проверено', `Заголовки H1-H3, мета-теги, изображения, ссылки, технические параметры, Open Graph`)}
    </div>

    <div class="seo-section full" style="border-left: 3px solid var(--accent)">
      <div class="seo-section-title">🎯 Приоритетные задачи для SEO</div>
      ${generateSEOPlan(title, metaDesc, h1s, h2s, images, imagesNoAlt, canonical, hasHttps, viewport, lang, ogImage, wordCount, hasSchema)}
    </div>
  `;

  document.getElementById('seoResults').style.display = 'block';
}

function generateSEOPlan(title, metaDesc, h1s, h2s, images, imagesNoAlt, canonical, hasHttps, viewport, lang, ogImage, wordCount, hasSchema) {
  const tasks = [];
  let priority = 1;

  if (!hasHttps) tasks.push(`<div class="seo-item"><span class="seo-status">🔴</span><div class="seo-item-content"><div class="seo-item-label">СРОЧНО: Подключи HTTPS — это критично для SEO</div></div></div>`);
  if (!title) tasks.push(`<div class="seo-item"><span class="seo-status">🔴</span><div class="seo-item-content"><div class="seo-item-label">Добавь тег &lt;title&gt; с ключевым словом | Название компании</div></div></div>`);
  if (!metaDesc) tasks.push(`<div class="seo-item"><span class="seo-status">🔴</span><div class="seo-item-content"><div class="seo-item-label">Добавь &lt;meta name="description"&gt; 130-155 символов с призывом к действию</div></div></div>`);
  if (h1s.length !== 1) tasks.push(`<div class="seo-item"><span class="seo-status">🟠</span><div class="seo-item-content"><div class="seo-item-label">${h1s.length === 0 ? 'Добавь один H1 с главным ключевым словом страницы' : 'Оставь только один H1 — удали лишние'}</div></div></div>`);
  if (imagesNoAlt.length > 0) tasks.push(`<div class="seo-item"><span class="seo-status">🟠</span><div class="seo-item-content"><div class="seo-item-label">Добавь alt-теги к ${imagesNoAlt.length} изображениям</div></div></div>`);
  if (!canonical) tasks.push(`<div class="seo-item"><span class="seo-status">🟡</span><div class="seo-item-content"><div class="seo-item-label">Добавь canonical тег для предотвращения дублирования</div></div></div>`);
  if (!viewport) tasks.push(`<div class="seo-item"><span class="seo-status">🟡</span><div class="seo-item-content"><div class="seo-item-label">Добавь viewport meta — обязательно для мобильного SEO</div></div></div>`);
  if (!ogImage) tasks.push(`<div class="seo-item"><span class="seo-status">🟡</span><div class="seo-item-content"><div class="seo-item-label">Добавь og:image (1200×630px) для красивых превью в соцсетях</div></div></div>`);
  if (wordCount < 300) tasks.push(`<div class="seo-item"><span class="seo-status">🟡</span><div class="seo-item-content"><div class="seo-item-label">Добавь больше контента — минимум 300-500 слов на странице</div></div></div>`);
  if (!hasSchema) tasks.push(`<div class="seo-item"><span class="seo-status">🟢</span><div class="seo-item-content"><div class="seo-item-label">Добавь Schema.org разметку (Organization, BreadcrumbList, FAQ)</div></div></div>`);
  if (h2s.length < 2) tasks.push(`<div class="seo-item"><span class="seo-status">🟢</span><div class="seo-item-content"><div class="seo-item-label">Структурируй контент через H2 подзаголовки (минимум 3-4 раздела)</div></div></div>`);

  if (tasks.length === 0) return '<div class="seo-item"><span class="seo-status">🎉</span><div class="seo-item-content"><div class="seo-item-label">Основные параметры в порядке! Работай над контентом и ссылочной массой.</div></div></div>';
  return tasks.join('');
}

function exportSEO() {
  const url = document.getElementById('seoUrl').value;
  const domain = new URL(url).hostname;
  const reportEl = document.getElementById('seoReport');
  const scoreEl = document.getElementById('seoScore');

  const data = [];
  reportEl.querySelectorAll('.seo-item').forEach(item => {
    const status = item.querySelector('.seo-status')?.textContent;
    const label = item.querySelector('.seo-item-label')?.textContent;
    const value = item.querySelector('.seo-item-value')?.textContent;
    const rec = item.querySelector('.seo-rec')?.textContent;
    if (label) data.push({ 'Статус': status, 'Параметр': label, 'Значение': value || '', 'Рекомендация': rec || '' });
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 8 }, { wch: 50 }, { wch: 60 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws, 'SEO-аудит');
  XLSX.writeFile(wb, `SEO-аудит-${domain}.xlsx`);
}

// ════════════════════════════════════════════
//  03 — UTM GENERATOR
// ════════════════════════════════════════════

function setUTM(field, value) {
  const map = { source: 'utmSource', medium: 'utmMedium', campaign: 'utmCampaign' };
  document.getElementById(map[field]).value = value;
  buildUTM();
}

function buildUTM() {
  const base = document.getElementById('utmBase').value.trim();
  const source = document.getElementById('utmSource').value.trim();
  const medium = document.getElementById('utmMedium').value.trim();
  const campaign = document.getElementById('utmCampaign').value.trim();
  const content = document.getElementById('utmContent').value.trim();
  const term = document.getElementById('utmTerm').value.trim();

  if (!base || !source || !medium || !campaign) {
    document.getElementById('utmFinal').textContent = 'Заполни обязательные поля (*)...';
    document.getElementById('utmFinal').style.color = 'var(--text3)';
    return;
  }

  const encode = v => encodeURIComponent(v.toLowerCase().replace(/\s+/g, '_'));
  const sep = base.includes('?') ? '&' : '?';
  let url = `${base}${sep}utm_source=${encode(source)}&utm_medium=${encode(medium)}&utm_campaign=${encode(campaign)}`;
  if (content) url += `&utm_content=${encode(content)}`;
  if (term) url += `&utm_term=${encode(term)}`;

  document.getElementById('utmFinal').textContent = url;
  document.getElementById('utmFinal').style.color = 'var(--accent)';
}

function copyUTM() {
  const url = document.getElementById('utmFinal').textContent;
  if (!url || url.includes('Заполни')) return;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('utmCopyBtn');
    btn.textContent = '✅ Скопировано!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '📋 Копировать'; btn.classList.remove('copied'); }, 2000);
  });
}

function saveUTM() {
  const url = document.getElementById('utmFinal').textContent;
  if (!url || url.includes('Заполни')) { alert('Сначала заполни поля и сгенерируй ссылку'); return; }

  const source = document.getElementById('utmSource').value;
  const medium = document.getElementById('utmMedium').value;
  const campaign = document.getElementById('utmCampaign').value;

  utmLinks.unshift({ url, source, medium, campaign, date: new Date().toLocaleDateString('ru-RU') });
  renderUTMHistory();
}

function renderUTMHistory() {
  const container = document.getElementById('utmHistory');
  if (!utmLinks.length) { container.innerHTML = '<div class="empty-state">Сохранённые ссылки появятся здесь</div>'; return; }
  container.innerHTML = utmLinks.map((link, i) => `
    <div class="utm-history-item">
      <div class="utm-history-url" onclick="navigator.clipboard.writeText('${link.url}')" title="Нажми чтобы скопировать" style="cursor:pointer">${link.url.slice(0, 80)}${link.url.length > 80 ? '…' : ''}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="utm-history-meta">${link.source} / ${link.medium} / ${link.campaign} · ${link.date}</div>
        <button onclick="utmLinks.splice(${i},1);renderUTMHistory()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px">×</button>
      </div>
    </div>
  `).join('');
}

function exportUTMs() {
  if (!utmLinks.length) { alert('Нет сохранённых ссылок'); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(utmLinks.map(l => ({
    'URL': l.url, 'Source': l.source, 'Medium': l.medium, 'Campaign': l.campaign, 'Дата': l.date
  })));
  ws['!cols'] = [{ wch: 100 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'UTM-ссылки');
  XLSX.writeFile(wb, 'UTM-ссылки.xlsx');
}

// ════════════════════════════════════════════
//  04 — MEDIA PLAN
// ════════════════════════════════════════════

const CHANNEL_PRESETS = {
  'Яндекс.Директ': { cpc: 45, ctr: 3.2, cr: 3.5 },
  'Google Ads': { cpc: 38, ctr: 2.8, cr: 3.0 },
  'ВКонтакте': { cpc: 18, ctr: 1.2, cr: 1.8 },
  'Telegram Ads': { cpc: 25, ctr: 2.5, cr: 2.2 },
  'MyTarget': { cpc: 20, ctr: 1.5, cr: 1.5 },
  'SEO/органика': { cpc: 0, ctr: 8, cr: 4.0 },
  'Email-маркетинг': { cpc: 2, ctr: 18, cr: 5.0 },
  'Авито': { cpc: 12, ctr: 4, cr: 6.0 },
};

function initMediaChannels() {
  mediaChannels = [
    { name: 'Яндекс.Директ', budget: 40, ...CHANNEL_PRESETS['Яндекс.Директ'] },
    { name: 'ВКонтакте', budget: 30, ...CHANNEL_PRESETS['ВКонтакте'] },
    { name: 'SEO/органика', budget: 20, ...CHANNEL_PRESETS['SEO/органика'] },
    { name: 'Email-маркетинг', budget: 10, ...CHANNEL_PRESETS['Email-маркетинг'] },
  ];
  renderChannels();
}

function renderChannels() {
  const container = document.getElementById('mediaChannels');
  container.innerHTML = mediaChannels.map((ch, i) => `
    <div class="channel-row">
      <select onchange="applyChannelPreset(${i}, this.value)">
        ${Object.keys(CHANNEL_PRESETS).map(k => `<option value="${k}" ${k === ch.name ? 'selected' : ''}>${k}</option>`).join('')}
        <option value="custom">Свой канал</option>
      </select>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="range" min="0" max="100" value="${ch.budget}" oninput="updateChannelBudget(${i},this.value);this.nextElementSibling.textContent=this.value+'%'">
        <span style="font-size:12px;color:var(--accent);width:36px;text-align:right">${ch.budget}%</span>
      </div>
      <input type="number" value="${ch.cpc}" placeholder="CPC ₽" oninput="mediaChannels[${i}].cpc=+this.value;calcMedia()" title="CPC в рублях">
      <button class="btn-remove" onclick="mediaChannels.splice(${i},1);renderChannels();calcMedia()">×</button>
    </div>
  `).join('');
  calcMedia();
}

function applyChannelPreset(i, name) {
  if (CHANNEL_PRESETS[name]) {
    mediaChannels[i] = { ...mediaChannels[i], name, ...CHANNEL_PRESETS[name] };
  } else {
    mediaChannels[i].name = name;
  }
  renderChannels();
}

function updateChannelBudget(i, value) {
  mediaChannels[i].budget = +value;
  calcMedia();
}

function addChannel() {
  mediaChannels.push({ name: 'Яндекс.Директ', budget: 0, cpc: 45, ctr: 3.2, cr: 3.5 });
  renderChannels();
}

function calcMedia() {
  const totalBudget = +document.getElementById('mediaBudget').value || 0;
  const days = +document.getElementById('mediaDays').value || 30;

  if (!totalBudget || !mediaChannels.length) return;

  const totalPct = mediaChannels.reduce((s, c) => s + c.budget, 0) || 100;
  let totalClicks = 0, totalLeads = 0, totalImpressions = 0;

  const rows = mediaChannels.map(ch => {
    const budget = (ch.budget / totalPct) * totalBudget;
    const clicks = ch.cpc > 0 ? Math.round(budget / ch.cpc) : Math.round(budget * 10);
    const impressions = ch.ctr > 0 ? Math.round((clicks / ch.ctr) * 100) : clicks * 20;
    const leads = Math.round(clicks * ch.cr / 100);
    const cpl = leads > 0 ? Math.round(budget / leads) : 0;
    totalClicks += clicks;
    totalLeads += leads;
    totalImpressions += impressions;
    return { name: ch.name, budget: Math.round(budget), impressions, clicks, leads, cpl, cr: ch.cr };
  });

  const avgCPL = totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0;

  document.getElementById('mediaSummary').innerHTML = `
    <div class="media-kpi"><div class="media-kpi-val">${fmt(totalBudget)} ₽</div><div class="media-kpi-label">Общий бюджет</div></div>
    <div class="media-kpi"><div class="media-kpi-val">${fmtK(totalImpressions)}</div><div class="media-kpi-label">Показов</div></div>
    <div class="media-kpi"><div class="media-kpi-val">${fmtK(totalClicks)}</div><div class="media-kpi-label">Кликов</div></div>
    <div class="media-kpi"><div class="media-kpi-val">${fmtK(totalLeads)}</div><div class="media-kpi-label">Лидов · CPL ${fmt(avgCPL)} ₽</div></div>
  `;

  if (mediaChartInstance) mediaChartInstance.destroy();
  const ctx = document.getElementById('mediaChart').getContext('2d');
  mediaChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: rows.map(r => r.name),
      datasets: [{ data: rows.map(r => r.budget), backgroundColor: ['#e8ff47', '#5b8fff', '#42ffb0', '#ff5bac', '#ff8c42', '#b8ff00', '#ff4757'], borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: '#9090b0', font: { size: 12 } } } }, cutout: '65%' }
  });

  document.getElementById('mediaTable').innerHTML = `
    <thead><tr><th>Канал</th><th>Бюджет ₽</th><th>%</th><th>Показов</th><th>Кликов</th><th>CR%</th><th>Лидов</th><th>CPL ₽</th></tr></thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td>${r.name}</td>
          <td>${fmt(r.budget)}</td>
          <td>${((r.budget / totalBudget) * 100).toFixed(0)}%</td>
          <td>${fmtK(r.impressions)}</td>
          <td>${fmtK(r.clicks)}</td>
          <td>${r.cr}%</td>
          <td style="color:var(--accent);font-weight:600">${fmtK(r.leads)}</td>
          <td>${r.cpl > 0 ? fmt(r.cpl) : '—'}</td>
        </tr>
      `).join('')}
      <tr style="font-weight:700;border-top:2px solid var(--border)">
        <td>ИТОГО</td><td>${fmt(totalBudget)}</td><td>100%</td>
        <td>${fmtK(totalImpressions)}</td><td>${fmtK(totalClicks)}</td><td>—</td>
        <td style="color:var(--accent)">${fmtK(totalLeads)}</td>
        <td>${fmt(avgCPL)}</td>
      </tr>
    </tbody>
  `;
}

function exportMedia() {
  const totalBudget = +document.getElementById('mediaBudget').value;
  const rows = [];
  document.querySelectorAll('#mediaTable tbody tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    if (cells.length >= 8) {
      rows.push({
        'Канал': cells[0].textContent, 'Бюджет ₽': cells[1].textContent,
        '% от бюджета': cells[2].textContent, 'Показов': cells[3].textContent,
        'Кликов': cells[4].textContent, 'CR%': cells[5].textContent,
        'Лидов': cells[6].textContent, 'CPL ₽': cells[7].textContent
      });
    }
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Медиаплан');
  XLSX.writeFile(wb, 'Медиаплан.xlsx');
}

// ════════════════════════════════════════════
//  05 — COMPETITOR ANALYSIS
// ════════════════════════════════════════════

function addCompetitor() {
  const id = Date.now();
  competitors.push({
    id, name: 'Конкурент ' + (competitors.length + 1),
    url: '', description: '',
    usp: '', pricing: '', audience: '',
    social: '', seo: '', content: '',
    rating: 3, notes: ''
  });
  renderCompetitors();
}

function renderCompetitors() {
  const container = document.getElementById('competitorCards');

  if (!competitors.length) {
    container.innerHTML = '<div class="empty-state" style="padding:40px;text-align:center;color:var(--text3)">Нажми "+ Добавить конкурента" чтобы начать анализ</div>';
    document.getElementById('compResults').style.display = 'none';
    return;
  }

  container.innerHTML = competitors.map((c, i) => `
    <div class="competitor-card">
      <div class="comp-card-header">
        <span>#${i + 1} ${c.name}</span>
        <button class="btn-remove" onclick="competitors.splice(${i},1);renderCompetitors()">×</button>
      </div>
      <div class="comp-field">
        <label>Название</label>
        <input type="text" value="${c.name}" oninput="competitors[${i}].name=this.value;updateCompTable()">
      </div>
      <div class="comp-field">
        <label>Сайт</label>
        <input type="url" value="${c.url}" placeholder="https://" oninput="competitors[${i}].url=this.value">
      </div>
      <div class="comp-field">
        <label>УТП / позиционирование</label>
        <input type="text" value="${c.usp}" placeholder="Чем отличаются от других?" oninput="competitors[${i}].usp=this.value;updateCompTable()">
      </div>
      <div class="comp-field">
        <label>Ценообразование</label>
        <input type="text" value="${c.pricing}" placeholder="Бюджетный / средний / премиум" oninput="competitors[${i}].pricing=this.value;updateCompTable()">
      </div>
      <div class="comp-field">
        <label>Целевая аудитория</label>
        <input type="text" value="${c.audience}" placeholder="Кому продают?" oninput="competitors[${i}].audience=this.value;updateCompTable()">
      </div>
      <div class="comp-field">
        <label>Активность в соцсетях</label>
        <select onchange="competitors[${i}].social=this.value;updateCompTable()">
          <option value="Нет" ${c.social === 'Нет' ? 'selected' : ''}>Нет</option>
          <option value="Слабая" ${c.social === 'Слабая' ? 'selected' : ''}>Слабая</option>
          <option value="Средняя" ${c.social === 'Средняя' ? 'selected' : ''}>Средняя</option>
          <option value="Сильная" ${c.social === 'Сильная' ? 'selected' : ''}>Сильная</option>
        </select>
      </div>
      <div class="comp-field">
        <label>SEO-позиции</label>
        <select onchange="competitors[${i}].seo=this.value;updateCompTable()">
          <option value="Слабые" ${c.seo === 'Слабые' ? 'selected' : ''}>Слабые</option>
          <option value="Средние" ${c.seo === 'Средние' ? 'selected' : ''}>Средние</option>
          <option value="Сильные" ${c.seo === 'Сильные' ? 'selected' : ''}>Сильные</option>
          <option value="Лидер" ${c.seo === 'Лидер' ? 'selected' : ''}>Лидер рынка</option>
        </select>
      </div>
      <div class="comp-field">
        <label>Общая оценка угрозы</label>
        <div class="star-rating">
          ${[1,2,3,4,5].map(n => `<span class="star ${n <= c.rating ? 'active' : ''}" onclick="competitors[${i}].rating=${n};renderCompetitors()">⭐</span>`).join('')}
        </div>
      </div>
      <div class="comp-field">
        <label>Заметки</label>
        <textarea rows="3" placeholder="Слабые места, возможности, угрозы..." oninput="competitors[${i}].notes=this.value">${c.notes}</textarea>
      </div>
    </div>
  `).join('');

  updateCompTable();
}

function updateCompTable() {
  if (!competitors.length) return;

  const fields = ['name', 'url', 'usp', 'pricing', 'audience', 'social', 'seo'];
  const labels = ['Конкурент', 'Сайт', 'УТП', 'Ценообразование', 'Аудитория', 'Соцсети', 'SEO'];

  document.getElementById('compTable').innerHTML = `
    <thead><tr><th>Параметр</th>${competitors.map(c => `<th>${c.name || '—'}</th>`).join('')}</tr></thead>
    <tbody>
      ${fields.map((f, fi) => `
        <tr>
          <td>${labels[fi]}</td>
          ${competitors.map(c => `<td style="max-width:200px">${c[f] || '—'}</td>`).join('')}
        </tr>
      `).join('')}
      <tr>
        <td>Оценка угрозы</td>
        ${competitors.map(c => `<td>${'⭐'.repeat(c.rating)}</td>`).join('')}
      </tr>
      <tr>
        <td>Заметки</td>
        ${competitors.map(c => `<td style="font-size:12px;color:var(--text2)">${c.notes || '—'}</td>`).join('')}
      </tr>
    </tbody>
  `;

  const topThreat = [...competitors].sort((a, b) => b.rating - a.rating)[0];
  const weakest = [...competitors].filter(c => c.seo === 'Слабые' || c.seo === 'Средние');
  const noSocial = competitors.filter(c => c.social === 'Нет' || c.social === 'Слабая');

  document.getElementById('compInsights').innerHTML = `
    <div class="insight-block">
      <h4>🔴 Главные угрозы</h4>
      <ul>
        ${[...competitors].sort((a,b) => b.rating - a.rating).slice(0,3).map(c => `<li>${c.name} — оценка ${c.rating}/5</li>`).join('')}
      </ul>
    </div>
    <div class="insight-block">
      <h4>🟢 Возможности</h4>
      <ul>
        ${weakest.length ? weakest.map(c => `<li>${c.name}: слабое SEO — можно обогнать</li>`).join('') : '<li>Все конкуренты сильны в SEO</li>'}
        ${noSocial.length ? noSocial.map(c => `<li>${c.name}: слабые соцсети</li>`).join('') : ''}
      </ul>
    </div>
    <div class="insight-block">
      <h4>📊 Анализ рынка</h4>
      <ul>
        <li>Конкурентов изучено: ${competitors.length}</li>
        <li>Средняя угроза: ${(competitors.reduce((s,c) => s + c.rating, 0) / competitors.length).toFixed(1)}/5</li>
        <li>С сильным SEO: ${competitors.filter(c => c.seo === 'Сильные' || c.seo === 'Лидер').length}</li>
        <li>Активны в соцсетях: ${competitors.filter(c => c.social === 'Средняя' || c.social === 'Сильная').length}</li>
      </ul>
    </div>
  `;

  document.getElementById('compResults').style.display = 'block';
}

function exportCompetitors() {
  if (!competitors.length) { alert('Добавь конкурентов для экспорта'); return; }
  const data = competitors.map(c => ({
    'Название': c.name, 'Сайт': c.url, 'УТП': c.usp,
    'Ценообразование': c.pricing, 'Аудитория': c.audience,
    'Соцсети': c.social, 'SEO': c.seo,
    'Оценка угрозы': c.rating + '/5', 'Заметки': c.notes
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Анализ конкурентов');
  XLSX.writeFile(wb, 'Анализ-конкурентов.xlsx');
}

// ════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('ru-RU');
}

function fmtK(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(Math.round(n));
}

// ════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════

initMediaChannels();
addCompetitor();
addCompetitor();
renderUTMHistory();
