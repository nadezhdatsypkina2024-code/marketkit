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

  const uploadArea = document.getElementById('abcUpload');
  const uploadText = uploadArea.querySelector('.upload-text');

  // XLSX / XLS
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Convert first two columns to CSV-like format
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:B1');
        const lines = [];
        for (let r = range.s.r; r <= range.e.r; r++) {
          const nameCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
          const valCell  = ws[XLSX.utils.encode_cell({ r, c: 1 })];
          if (nameCell && valCell) {
            const name = String(nameCell.v || '').trim();
            const val  = String(valCell.v  || '').trim();
            if (name && val) lines.push(name + ';' + val);
          }
        }
        document.getElementById('abcManual').value = lines.join('\n');
        uploadArea.style.borderColor = 'var(--green)';
        uploadText.textContent = '✅ ' + file.name + ' загружен (' + lines.length + ' строк)';
      } catch(err) {
        uploadText.textContent = '❌ Ошибка чтения Excel файла';
      }
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  // CSV / TXT (existing logic)
  const reader = new FileReader();
  reader.onload = (e) => {
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      document.getElementById('abcManual').value = e.target.result;
    }
    uploadArea.style.borderColor = 'var(--green)';
    uploadText.textContent = '✅ ' + file.name + ' загружен';
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
  const textarea = document.getElementById('abcManual');
  const raw = textarea.value.trim();
  const delim = document.getElementById('abcDelim').value;
  const threshA = parseFloat(document.getElementById('abcThreshA').value) || 80;
  const threshB = parseFloat(document.getElementById('abcThreshB').value) || 15;

  // Check if textarea only has placeholder-like demo text and is empty logically
  const isPlaceholder = raw === 'Товар А;15000\nТовар Б;8500\nТовар В;3200\nТовар Г;1100\nТовар Д;450' ||
                        raw === 'Товар А;15000' || !raw;

  // Allow demo data to run — only block if truly empty
  if (!raw) {
    // Show friendly inline error instead of alert
    const btn = document.querySelector('#tool-abc .btn-primary');
    const orig = btn.textContent;
    btn.textContent = '⚠ Введи данные или загрузи файл!';
    btn.style.background = 'var(--orange)';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2500);
    return;
  }

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

  if (abcData.length === 0) {
    const btn = document.querySelector('#tool-abc .btn-primary');
    const orig = btn.textContent;
    btn.textContent = '⚠ Проверь формат: Название;Число';
    btn.style.background = 'var(--orange)';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 3000);
    return;
  }

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
  const setStatus = t => document.getElementById('seoLoadingText').textContent = t;
  setStatus('Загружаю страницу...');

  try {
    const html = await fetchViaProxies(url, setStatus);
    setStatus('Анализирую структуру...');
    await new Promise(r => setTimeout(r, 500));
    setStatus('Формирую отчёт...');
    await new Promise(r => setTimeout(r, 300));
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

function toggleMediaFormulas() {
  const el = document.getElementById('mediaFormulas');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
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
//  06 — PRODUCT ANALYSIS (Competitor Catalog Parser)
// ════════════════════════════════════════════

let productSources = []; // { name, url, color, products[] }
let allProducts = [];    // flat list

const SOURCE_COLORS = ['#e8ff47','#5b8fff','#42ffb0','#ff5bac','#ff8c42','#b8ff00'];

// Fetch with timeout (cross-browser compatible, no AbortSignal.timeout)
function fetchWithTimeout(url, timeoutMs = 9000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
  ]);
}

// Full proxy chain — tries one by one, returns first successful HTML
async function fetchViaProxies(targetUrl, setStatus) {
  const proxies = [
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, parse: d => d.contents || '' },
    { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, parse: d => typeof d === 'string' ? d : JSON.stringify(d) },
    { url: `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`, parse: d => typeof d === 'string' ? d : (d.body || '') },
    { url: `https://thingproxy.freeboard.io/fetch/${targetUrl}`, parse: d => typeof d === 'string' ? d : '' },
    { url: `https://yacdn.org/proxy/${targetUrl}`, parse: d => typeof d === 'string' ? d : '' },
  ];

  for (let i = 0; i < proxies.length; i++) {
    const p = proxies[i];
    try {
      if (setStatus) setStatus(`Получаю данные (попытка ${i + 1}/${proxies.length})...`);
      const res = await fetchWithTimeout(p.url, 9000);
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      let html = '';
      if (contentType.includes('json')) {
        const data = await res.json();
        html = p.parse(data);
      } else {
        html = await res.text();
        // allorigins wraps in JSON sometimes — try parse
        if (html.trim().startsWith('{')) {
          try { html = JSON.parse(html).contents || html; } catch(e) {}
        }
      }
      if (html && html.length > 500 && html.includes('<')) return html;
    } catch(e) {}
  }
  return '';
}

async function parseProducts() {
  const url = document.getElementById('productUrl').value.trim();
  const siteName = document.getElementById('productSiteName').value.trim() ||
    (() => { try { return new URL(url).hostname.replace('www.',''); } catch { return 'Сайт ' + (productSources.length + 1); } })();

  if (!url || !url.startsWith('http')) {
    showInlineError('productUrl', 'Введи корректный URL!'); return;
  }

  const loading = document.getElementById('productLoading');
  const setStatus = t => document.getElementById('productLoadingText').textContent = t;
  loading.style.display = 'flex';
  setStatus('Загружаю каталог...');

  try {
    const html = await fetchViaProxies(url, setStatus);

    setStatus('Анализирую товары...');
    await new Promise(r => setTimeout(r, 200));

    let products = [];

    if (html.length > 300) {
      products = extractProducts(html, url, siteName);

      // If DOM selectors found nothing — try aggressive text extraction
      if (products.length === 0) {
        setStatus('Пробую глубокий анализ...');
        products = extractProductsFromText(html, siteName);
      }
    }

    const color = SOURCE_COLORS[productSources.length % SOURCE_COLORS.length];
    productSources.push({ name: siteName, url, color, count: products.length });
    allProducts.push(...products.map(p => ({ ...p, source: siteName, sourceColor: color })));

    renderProductSources();
    if (allProducts.length > 0) { renderProductTable(); renderProductInsights(); }

    document.getElementById('productUrl').value = '';
    document.getElementById('productSiteName').value = '';

    if (products.length === 0) {
      // Show helpful diagnostic in the source tag area
      const infoEl = document.getElementById('productSources');
      infoEl.innerHTML += `<div style="padding:12px;background:rgba(255,150,0,0.1);border:1px solid rgba(255,150,0,0.3);border-radius:8px;font-size:12px;color:var(--text2);margin-top:8px">
        ⚠️ <strong>${siteName}</strong>: товары не извлечены.<br>
        Возможные причины: сайт защищён от парсинга (Cloudflare, JS-рендеринг), или страница не является каталогом.<br>
        <strong>Совет:</strong> попробуй ссылку на страницу с пагинацией (/catalog/, /products/, /shop/) или открытые площадки (Wildberries, Ozon, DNS, Petrovich).
      </div>`;
    }
  } catch(e) {
    showInlineError('productUrl', 'Ошибка загрузки. Попробуй другой сайт.');
  }
  loading.style.display = 'none';
}

// Aggressive text-based product extraction when DOM selectors fail
function extractProductsFromText(html, siteName) {
  const products = [];
  // Strip scripts/styles, keep raw HTML for price regex
  const rawForPrices = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');

  // Find price patterns with surrounding text
  const pricePattern = /([^<]{5,80}?)[\s>](\d[\d\s]{0,6}(?:[.,]\d{2})?)\s*(?:₽|руб\.?|р\.)/gi;
  const matches = [];
  let m;
  while ((m = pricePattern.exec(rawForPrices)) !== null && matches.length < 100) {
    const rawName = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const price   = m[2].replace(/\s/g, '') + ' ₽';
    if (rawName.length > 4 && rawName.length < 120 && !/^(div|span|class|href|src|alt|ul|li|p|td)$/i.test(rawName)) {
      matches.push({ name: rawName, price, brand: '', specs: {}, rating: '' });
    }
  }

  // Deduplicate by name
  const seen = new Set();
  matches.forEach(p => {
    const key = p.name.slice(0, 40).toLowerCase();
    if (!seen.has(key)) { seen.add(key); products.push(p); }
  });

  return products.slice(0, 150);
}

function extractProducts(html, url, siteName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const products = [];

  // Strategy 1: JSON-LD structured data (most reliable)
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
      items.forEach(item => {
        if (item['@type'] === 'Product') products.push(parseSchemaProduct(item));
        if (item['@type'] === 'ItemList' && item.itemListElement) {
          item.itemListElement.forEach(el => { if (el.item) products.push(parseSchemaProduct(el.item)); });
        }
      });
    } catch(e) {}
  });
  if (products.length >= 2) return products.filter(p => p.name && p.name.length > 2).slice(0, 150);

  // Strategy 2: data-* attributes (common in modern SPAs and CMS)
  const dataSelectors = [
    '[data-product]', '[data-item]', '[data-sku]', '[data-offer]',
    '[data-good]', '[data-id]', '[data-product-id]', '[data-entity-id]',
    '[itemtype*="Product"]', '[itemtype*="product"]',
  ];
  for (const sel of dataSelectors) {
    const els = Array.from(doc.querySelectorAll(sel));
    if (els.length >= 2) {
      els.slice(0, 200).forEach(el => { const p = extractFromCard(el); if (p.name) products.push(p); });
      if (products.length >= 2) return products.filter(p => p.name).slice(0, 150);
    }
  }

  // Strategy 3: Expanded CSS selectors (Russian CMS: Bitrix, UMI, ModX, Opencart, WP WooCommerce, Tilda, etc.)
  const cardSelectors = [
    // Generic
    '.product-card', '.product-item', '.product__item', '.product__card',
    '.product-tile', '.product-list-item', '.product-grid__item',
    '.catalog-item', '.catalog__item', '.catalog-grid__item',
    '.goods-item', '.goods__item', '.goods-card',
    '.item-card', '.card-item', '.card-product',
    '.offers-item', '.offer-card', '.offer__item',
    // Bitrix
    '.bx_catalog_item', '.bx-catalog-item', '.bxr_list_item',
    '.catalog-element', '.iblock-element',
    // WooCommerce
    '.wc-block-grid__product', 'li.product', '.woocommerce-loop-product',
    '.product_type_simple', '.product_type_variable',
    // OpenCart
    '.product-layout', '.product-thumb',
    // ModX
    '.product', '.ms2-product', '.pdopage-item',
    // Wildcards
    '[class*="product-card"]', '[class*="ProductCard"]', '[class*="product_card"]',
    '[class*="product-item"]', '[class*="ProductItem"]',
    '[class*="catalog-item"]', '[class*="CatalogItem"]',
    '[class*="goods-item"]', '[class*="GoodsItem"]',
    '[class*="item-card"]', '[class*="ItemCard"]',
    '[class*="offer-card"]', '[class*="OfferCard"]',
    // Article-based
    'article.product', 'article[class*="product"]', 'article[class*="item"]',
    'li[class*="product"]', 'li[class*="item"]', 'li[class*="card"]',
    // DNS, Citilink, etc.
    '.product-card__top', '.catalog-product', '.product-card-list__item',
    '.n-catalog-2-item', '.b-product-grid-item', '.b-catalog__item',
  ];

  let cards = [];
  for (const sel of cardSelectors) {
    try {
      const found = Array.from(doc.querySelectorAll(sel));
      // Must have at least 2 similar elements AND each must have some price-like or title-like content
      if (found.length >= 2) {
        const hasContent = found.slice(0, 5).some(el =>
          el.querySelector('h1,h2,h3,h4,h5,a,img,[class*="title"],[class*="name"],[class*="price"]')
        );
        if (hasContent) { cards = found; break; }
      }
    } catch(e) {}
  }

  // Strategy 4: Price-based container detection
  if (cards.length === 0) {
    const priceEls = Array.from(doc.querySelectorAll(
      '[class*="price"],[class*="Price"],[class*="cost"],[class*="Cost"],[class*="стоим"],[itemprop="price"]'
    ));
    const containerSet = new Set();
    priceEls.forEach(el => {
      const container = el.closest('li, article, [class*="item"], [class*="card"], [class*="product"], [class*="goods"], [class*="offer"]');
      if (container && !containerSet.has(container)) { containerSet.add(container); cards.push(container); }
    });
  }

  cards.slice(0, 200).forEach(card => {
    const product = extractFromCard(card);
    if (product.name) products.push(product);
  });

  // Strategy 5: Table-based catalogs (price lists, specs tables)
  if (products.length === 0) {
    doc.querySelectorAll('table').forEach(table => {
      const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
      if (headers.length > 1) {
        table.querySelectorAll('tbody tr').forEach(row => {
          const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
          if (cells.length > 0 && cells[0]) {
            const product = { name: cells[0], price: '', brand: '', specs: {}, rating: '' };
            headers.forEach((h, i) => {
              if (i === 0 || !cells[i]) return;
              const hl = h.toLowerCase();
              if (hl.includes('цен') || hl.includes('стоим') || hl.includes('price')) product.price = cells[i];
              else if (hl.includes('бренд') || hl.includes('производ') || hl.includes('марк')) product.brand = cells[i];
              else if (hl.includes('рейтинг') || hl.includes('оценк')) product.rating = cells[i];
              else product.specs[h] = cells[i];
            });
            products.push(product);
          }
        });
      }
    });
  }

  return products.filter(p => p.name && p.name.length > 2).slice(0, 150);
}

function parseSchemaProduct(item) {
  const price = item.offers?.price || item.offers?.lowPrice || '';
  const specs = {};
  if (item.additionalProperty) {
    item.additionalProperty.forEach(prop => {
      if (prop.name && prop.value) specs[prop.name] = prop.value;
    });
  }
  return {
    name: item.name || '',
    price: price ? price + ' ₽' : '',
    brand: item.brand?.name || item.manufacturer || '',
    specs,
    rating: item.aggregateRating?.ratingValue || '',
    description: item.description?.slice(0, 120) || ''
  };
}

function extractFromCard(card) {
  const getText = (sels) => {
    for (const s of sels) {
      try {
        const el = card.querySelector(s);
        if (el?.textContent?.trim()) return el.textContent.trim();
      } catch(e) {}
    }
    return '';
  };

  const getAttr = (sels, attr) => {
    for (const s of sels) {
      try {
        const el = card.querySelector(s);
        if (el?.getAttribute(attr)?.trim()) return el.getAttribute(attr).trim();
      } catch(e) {}
    }
    return '';
  };

  // Name: try heading, then title-class, then link title, then link text
  const name = getText([
    'h1','h2','h3','h4','h5',
    '[class*="title"],[class*="Title"],[class*="name"],[class*="Name"]',
    '[class*="heading"],[class*="caption"],[class*="label"]',
    '[itemprop="name"]',
  ]) || getAttr(['a[href]','a[title]'], 'title')
     || getText(['a[href]'])
     || getAttr(['img'], 'alt')
     || '';

  // Price: multiple patterns
  const rawPrice = getText([
    '[itemprop="price"]',
    '[class*="price"][class*="current"],[class*="price"][class*="new"],[class*="price"][class*="main"]',
    '[class*="price"],[class*="Price"]',
    '[class*="cost"],[class*="Cost"]',
    '[class*="amount"],[class*="Amount"]',
    '[class*="стоим"]',
    'span[class*="sum"], span[class*="Sum"]',
  ]) || getAttr(['[itemprop="price"]'], 'content') || '';
  const price = rawPrice
    ? rawPrice.replace(/[^\d\s.,₽руб]/gi, '').trim().slice(0, 30)
    : (getAttr(['[data-price]','[data-cost]'], 'data-price') || getAttr(['[data-cost]'], 'data-cost') || '');

  // Brand
  const brand = getText([
    '[itemprop="brand"]',
    '[class*="brand"],[class*="Brand"]',
    '[class*="vendor"],[class*="Vendor"]',
    '[class*="manufacturer"],[class*="Manufacturer"]',
    '[class*="maker"]',
  ]);

  // Rating
  const rating = getText([
    '[itemprop="ratingValue"]',
    '[class*="rating"],[class*="Rating"]',
    '[class*="stars"],[class*="Stars"]',
    '[class*="score"],[class*="Score"]',
  ]) || getAttr(['[data-rating]'], 'data-rating') || '';

  // Specs from dl/dt/dd, characteristic lists
  const specs = {};
  card.querySelectorAll('dl, ul[class*="spec"], ul[class*="char"], table[class*="spec"]').forEach(list => {
    const dts = list.querySelectorAll('dt, th');
    const dds = list.querySelectorAll('dd, td');
    dts.forEach((dt, i) => {
      if (dds[i] && dt.textContent.trim() && dds[i].textContent.trim()) {
        specs[dt.textContent.trim().slice(0,40)] = dds[i].textContent.trim().slice(0, 60);
      }
    });
  });

  const finalPrice = price
    ? (price.replace(/\s/g,'').match(/[\d.,]+/) ? price : '')
    : '';

  return {
    name: name.replace(/\s+/g, ' ').trim().slice(0, 120),
    price: finalPrice,
    brand,
    specs,
    rating: rating.replace(/[^\d.,\/★☆]/g, '').slice(0, 10)
  };
}

function renderProductSources() {
  const container = document.getElementById('productSources');
  if (!productSources.length) { container.innerHTML = ''; return; }
  container.innerHTML = productSources.map((s, i) => `
    <div class="source-tag">
      <div class="src-dot" style="background:${s.color}"></div>
      <span><strong>${s.name}</strong> · ${s.count} товаров</span>
      <button onclick="removeSource(${i})">×</button>
    </div>
  `).join('');

  // Update filter dropdown
  const filterSel = document.getElementById('productFilterSite');
  filterSel.innerHTML = '<option value="all">Все сайты</option>' +
    productSources.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
}

function removeSource(i) {
  const name = productSources[i].name;
  productSources.splice(i, 1);
  allProducts = allProducts.filter(p => p.source !== name);
  renderProductSources();
  renderProductTable();
  renderProductInsights();
}

function renderProductTable() {
  if (!allProducts.length) return;

  const filterSite = document.getElementById('productFilterSite').value;
  const sortBy = document.getElementById('productSort').value;
  const search = document.getElementById('productSearch').value.toLowerCase();

  let products = allProducts.filter(p => {
    if (filterSite !== 'all' && p.source !== filterSite) return false;
    if (search && !p.name.toLowerCase().includes(search)) return false;
    return true;
  });

  if (sortBy === 'price_asc') products.sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
  if (sortBy === 'price_desc') products.sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
  if (sortBy === 'name') products.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  // Collect all unique spec keys
  const allSpecKeys = [...new Set(products.flatMap(p => Object.keys(p.specs || {})))].slice(0, 8);
  const prices = products.map(p => parsePrice(p.price)).filter(p => p > 0);
  const minP = Math.min(...prices), maxP = Math.max(...prices);

  const getPriceBadge = (priceStr) => {
    const p = parsePrice(priceStr);
    if (!p || prices.length < 3) return priceStr;
    const third = (maxP - minP) / 3;
    const cls = p <= minP + third ? 'price-low' : p <= minP + third * 2 ? 'price-mid' : 'price-high';
    const label = p <= minP + third ? '↓' : p <= minP + third * 2 ? '~' : '↑';
    return `<span class="price-badge ${cls}">${priceStr || '—'} ${label}</span>`;
  };

  document.getElementById('productStats').innerHTML = `
    <div class="prod-stat"><div class="prod-stat-val">${products.length}</div><div class="prod-stat-label">Товаров</div></div>
    <div class="prod-stat"><div class="prod-stat-val">${productSources.length}</div><div class="prod-stat-label">Источников</div></div>
    <div class="prod-stat"><div class="prod-stat-val">${prices.length ? fmt(Math.min(...prices)) + ' ₽' : '—'}</div><div class="prod-stat-label">Мин. цена</div></div>
    <div class="prod-stat"><div class="prod-stat-val">${prices.length ? fmt(Math.max(...prices)) + ' ₽' : '—'}</div><div class="prod-stat-label">Макс. цена</div></div>
  `;

  const specHeaders = allSpecKeys.map(k => `<th>${k.slice(0, 20)}</th>`).join('');
  const rows = products.map(p => `
    <tr>
      <td><span class="src-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.sourceColor};margin-right:6px"></span>${p.source}</td>
      <td style="max-width:260px;font-weight:500">${p.name}</td>
      <td>${p.brand || '—'}</td>
      <td>${getPriceBadge(p.price)}</td>
      <td>${p.rating || '—'}</td>
      ${allSpecKeys.map(k => `<td style="font-size:12px;color:var(--text2)">${p.specs?.[k] || '—'}</td>`).join('')}
    </tr>
  `).join('');

  document.getElementById('productTable').innerHTML = `
    <thead><tr><th>Источник</th><th>Название</th><th>Бренд</th><th>Цена</th><th>Рейтинг</th>${specHeaders}</tr></thead>
    <tbody>${rows}</tbody>
  `;

  document.getElementById('productResults').style.display = 'block';
}

function renderProductInsights() {
  if (!allProducts.length) return;

  const prices = allProducts.map(p => parsePrice(p.price)).filter(p => p > 0);
  const bySource = {};
  productSources.forEach(s => {
    const sProds = allProducts.filter(p => p.source === s.name);
    const sPrices = sProds.map(p => parsePrice(p.price)).filter(p => p > 0);
    bySource[s.name] = {
      count: sProds.length,
      avgPrice: sPrices.length ? Math.round(sPrices.reduce((a, b) => a + b, 0) / sPrices.length) : 0,
      minPrice: sPrices.length ? Math.min(...sPrices) : 0,
      maxPrice: sPrices.length ? Math.max(...sPrices) : 0,
      brands: [...new Set(sProds.map(p => p.brand).filter(Boolean))].length,
      color: s.color
    };
  });

  const avgAll = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  document.getElementById('productInsights').innerHTML = Object.entries(bySource).map(([name, d]) => `
    <div class="seo-section">
      <div class="seo-section-title"><span class="src-dot" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${d.color}"></span> ${name}</div>
      <div class="seo-item"><span class="seo-status">📦</span><div class="seo-item-content"><div class="seo-item-label">Товаров: ${d.count}</div></div></div>
      <div class="seo-item"><span class="seo-status">💰</span><div class="seo-item-content"><div class="seo-item-label">Ср. цена: ${fmt(d.avgPrice)} ₽</div><div class="seo-item-value">от ${fmt(d.minPrice)} до ${fmt(d.maxPrice)} ₽</div></div></div>
      <div class="seo-item"><span class="seo-status">🏷</span><div class="seo-item-content"><div class="seo-item-label">Брендов: ${d.brands}</div></div></div>
      ${d.avgPrice && avgAll ? `<div class="seo-rec">Позиционирование: ${d.avgPrice < avgAll * 0.9 ? '⬇ Ниже рынка — бюджетный сегмент' : d.avgPrice > avgAll * 1.1 ? '⬆ Выше рынка — премиум' : '≈ Около среднего по рынку'}</div>` : ''}
    </div>
  `).join('');

  document.getElementById('productInsightPanel').style.display = 'block';
}

function parsePrice(str) {
  if (!str) return 0;
  const match = str.replace(/\s/g, '').match(/[\d.,]+/);
  if (!match) return 0;
  return parseFloat(match[0].replace(',', '.')) || 0;
}

function exportProducts() {
  if (!allProducts.length) return;
  const allSpecKeys = [...new Set(allProducts.flatMap(p => Object.keys(p.specs || {})))];
  const data = allProducts.map(p => {
    const row = { 'Источник': p.source, 'Название': p.name, 'Бренд': p.brand || '', 'Цена': p.price || '', 'Рейтинг': p.rating || '' };
    allSpecKeys.forEach(k => { row[k] = p.specs?.[k] || ''; });
    return row;
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Продукты конкурентов');
  XLSX.writeFile(wb, 'Анализ-продуктов.xlsx');
}

function clearProducts() {
  productSources = []; allProducts = [];
  document.getElementById('productSources').innerHTML = '';
  document.getElementById('productResults').style.display = 'none';
  document.getElementById('productInsightPanel').style.display = 'none';
  document.getElementById('productFilterSite').innerHTML = '<option value="all">Все сайты</option>';
}

function showInlineError(inputId, msg) {
  const input = document.getElementById(inputId);
  const orig = input.style.borderColor;
  input.style.borderColor = 'var(--red)';
  input.placeholder = msg;
  setTimeout(() => { input.style.borderColor = orig; }, 2500);
}

// ════════════════════════════════════════════
//  05b — COMPETITOR AUTO-ANALYSIS (Claude AI)
// ════════════════════════════════════════════

async function autoAnalyzeCompetitor() {
  const input = document.getElementById('compAutoUrl').value.trim();
  if (!input) {
    showInlineError('compAutoUrl', 'Введи URL сайта или название компании');
    return;
  }

  const loading = document.getElementById('compAutoLoading');
  const result  = document.getElementById('compAutoResult');
  const setStatus = t => document.getElementById('compAutoLoadingText').textContent = t;

  loading.style.display = 'flex';
  result.style.display  = 'none';
  setStatus('Загружаю данные о конкуренте...');

  const isUrl = input.startsWith('http');

  try {
    if (isUrl) {
      // Fetch HTML via proxy chain
      const html = await fetchViaProxies(input, setStatus);

      setStatus('Анализирую конкурента...');
      await new Promise(r => setTimeout(r, 300));

      if (html.length > 300) {
        const comp = analyzeCompetitorFromHTML(html, input);
        loading.style.display = 'none';
        renderCompAutoResult(comp, input);
      } else {
        // Proxy failed — show manual form pre-filled with domain info
        loading.style.display = 'none';
        showCompProxyFallback(input);
      }
    } else {
      // Text input — do keyword-based analysis heuristics
      setStatus('Анализирую по названию...');
      await new Promise(r => setTimeout(r, 400));
      const comp = buildCompFromName(input);
      loading.style.display = 'none';
      renderCompAutoResult(comp, input);
    }
  } catch(e) {
    loading.style.display = 'none';
    showCompProxyFallback(input);
  }
}

// Full in-browser HTML analysis — no API needed
function analyzeCompetitorFromHTML(html, url) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const domain = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })();

  // ── Basic identity ──
  const ogTitle    = doc.querySelector('meta[property="og:title"]')?.content?.trim();
  const title      = doc.querySelector('title')?.textContent?.trim() || '';
  const metaDesc   = doc.querySelector('meta[name="description"]')?.content?.trim() || '';
  const ogDesc     = doc.querySelector('meta[property="og:description"]')?.content?.trim() || '';
  const h1         = doc.querySelector('h1')?.textContent?.trim() || '';
  const name       = ogTitle || h1 || title.split('|')[0].split('—')[0].split('-')[0].trim() || domain;
  const tagline    = ogDesc || metaDesc || '';

  // ── Navigation / products ──
  const navLinks = Array.from(doc.querySelectorAll('nav a, header a, .menu a, [class*="menu"] a, [class*="nav"] a'))
    .map(a => a.textContent.trim())
    .filter(t => t.length > 1 && t.length < 40 && !/^(главная|home|о нас|about|контакты|contact|войти|login|корзина|cart|поиск)$/i.test(t));
  const uniqueNav = [...new Set(navLinks)].slice(0, 12);

  const h2s = Array.from(doc.querySelectorAll('h2,h3')).map(h => h.textContent.trim()).filter(t => t.length > 3 && t.length < 80).slice(0, 10);

  const products = uniqueNav.length > 0
    ? uniqueNav.slice(0, 6).join(', ')
    : h2s.slice(0, 4).join(', ') || 'Не определено';

  // ── Pricing signals ──
  const bodyText = (doc.body?.textContent || '').toLowerCase();
  const hasHighPrices = /премиум|premium|luxury|lux|элитн|бизнес-класс|vip/i.test(bodyText);
  const hasLowPrices  = /дёшево|дешево|скидк|распродаж|акци|эконом|бюджет|дисконт/i.test(bodyText);
  const priceEls = Array.from(doc.querySelectorAll('[class*="price"],[class*="Price"],[itemprop="price"]'));
  const prices = priceEls.map(el => {
    const n = parseFloat((el.textContent || el.getAttribute('content') || '').replace(/\s/g,'').replace(',','.'));
    return isNaN(n) ? 0 : n;
  }).filter(n => n > 0 && n < 10000000);
  const avgPrice = prices.length ? prices.reduce((a,b) => a+b, 0) / prices.length : 0;

  let pricing = 'Не определено';
  if (hasHighPrices) pricing = 'Премиум-сегмент';
  else if (hasLowPrices) pricing = 'Бюджетный / акционный';
  else if (avgPrice > 0) {
    pricing = avgPrice > 15000 ? 'Средний+ / Премиум (ср.цена ~' + Math.round(avgPrice).toLocaleString('ru') + ' ₽)'
            : avgPrice > 3000  ? 'Средний сегмент (ср.цена ~' + Math.round(avgPrice).toLocaleString('ru') + ' ₽)'
            : 'Бюджетный (ср.цена ~' + Math.round(avgPrice).toLocaleString('ru') + ' ₽)';
  } else {
    pricing = 'Средний сегмент (цены не определены)';
  }

  // ── Audience signals ──
  const b2bKeywords  = /b2b|бизнес|юридическ|организаци|оптов|предприяти|корпоратив|tender|тендер|поставщик/i;
  const b2cKeywords  = /физическ|розниц|покупател|клиент|для дома|personal|частн/i;
  const audience = b2bKeywords.test(bodyText) && b2cKeywords.test(bodyText) ? 'B2B + B2C'
                 : b2bKeywords.test(bodyText) ? 'B2B (бизнес-клиенты, корпоративные)'
                 : b2cKeywords.test(bodyText) ? 'B2C (розничные покупатели)'
                 : 'Широкая аудитория';

  // ── Marketing channels ──
  const allLinks = Array.from(doc.querySelectorAll('a[href]')).map(a => a.href || a.getAttribute('href') || '');
  const channels = [];
  if (allLinks.some(l => /vk\.com|vkontakte/i.test(l))) channels.push('ВКонтакте');
  if (allLinks.some(l => /t\.me|telegram/i.test(l))) channels.push('Telegram');
  if (allLinks.some(l => /instagram|inst\.com/i.test(l))) channels.push('Instagram');
  if (allLinks.some(l => /youtube|youtu\.be/i.test(l))) channels.push('YouTube');
  if (allLinks.some(l => /ok\.ru|odnoklassniki/i.test(l))) channels.push('ОК');
  if (allLinks.some(l => /facebook|fb\.com/i.test(l))) channels.push('Facebook');
  if (allLinks.some(l => /dzen\.ru|zen\.yandex/i.test(l))) channels.push('Дзен');
  if (doc.querySelector('meta[name="yandex-verification"]')) channels.push('Яндекс.Метрика');
  if (doc.querySelector('meta[name="google-site-verification"]')) channels.push('Google Analytics');
  if (html.includes('gtag(') || html.includes('_ga')) channels.push('Google Ads');
  if (html.includes('yaCounter') || html.includes('ym(')) channels.push('Яндекс.Директ');
  if (channels.length === 0) channels.push('Сайт / SEO');

  // ── SEO signals ──
  const hasHTTPS    = url.startsWith('https');
  const hasOG       = !!doc.querySelector('meta[property="og:title"]');
  const hasSchema   = html.includes('application/ld+json') || html.includes('itemtype=');
  const hasCanon    = !!doc.querySelector('link[rel="canonical"]');
  const imgCount    = doc.querySelectorAll('img').length;
  const noAltImgs   = Array.from(doc.querySelectorAll('img')).filter(img => !img.getAttribute('alt')).length;
  const wordCount   = (doc.body?.textContent || '').trim().split(/\s+/).length;
  let seoScore = 0;
  if (hasHTTPS) seoScore++;
  if (hasOG) seoScore++;
  if (hasSchema) seoScore++;
  if (hasCanon) seoScore++;
  if (wordCount > 500) seoScore++;
  const seoLabel = seoScore >= 4 ? 'Сильное SEO' : seoScore >= 2 ? 'Среднее SEO' : 'Слабое SEO';

  // ── Strengths / Weaknesses / Opportunities ──
  const strengths = [];
  const weaknesses = [];
  const opportunities = [];

  if (wordCount > 1000) strengths.push('Много контента на сайте');
  if (hasHTTPS) strengths.push('Защищённый сайт (HTTPS)');
  if (channels.length >= 3) strengths.push('Активен в ' + channels.length + ' каналах');
  if (priceEls.length > 10) strengths.push('Прозрачное ценообразование');
  if (hasSchema) strengths.push('Структурированные данные (Schema)');
  if (uniqueNav.length >= 6) strengths.push('Широкий ассортимент (' + uniqueNav.length + '+ категорий)');
  if (strengths.length === 0) strengths.push('Присутствие в интернете');

  if (!hasHTTPS) weaknesses.push('Нет HTTPS — потери доверия');
  if (noAltImgs > 5) weaknesses.push('Изображения без описаний (SEO)');
  if (!hasOG) weaknesses.push('Нет Open Graph — плохой шаринг');
  if (channels.length < 2) weaknesses.push('Слабое присутствие в соцсетях');
  if (wordCount < 300) weaknesses.push('Мало контента на странице');
  if (weaknesses.length === 0) weaknesses.push('Явных слабостей не обнаружено');

  if (!channels.includes('Telegram')) opportunities.push('Telegram-канал не используют');
  if (!channels.includes('ВКонтакте')) opportunities.push('Нет ВКонтакте — твоя возможность');
  if (!hasSchema) opportunities.push('Нет Schema — займи rich snippets в Google');
  if (noAltImgs > 5) opportunities.push('SEO-оптимизация изображений');
  if (wordCount < 500) opportunities.push('Контент-маркетинг — у них его мало');
  if (opportunities.length === 0) opportunities.push('Превзойди по качеству контента');

  const summary = `${name} — ${audience.toLowerCase()} сайт в ${pricing.toLowerCase()}. ` +
    `SEO: ${seoLabel}. Маркетинговые каналы: ${channels.join(', ') || 'только сайт'}. ` +
    `Ключевые категории: ${products.slice(0, 80)}.`;

  return { name, tagline: tagline.slice(0, 100), usp: tagline || `${name} — ${products.split(',')[0]}`, products, pricing, audience, channels: channels.join(', '), strengths, weaknesses, opportunities, summary };
}

// Fallback: name-only analysis with keyword heuristics
function buildCompFromName(name) {
  return {
    name,
    tagline: '',
    usp: `Компания "${name}" — введи URL сайта для авто-анализа или заполни карточку ниже`,
    products: 'Не определено',
    pricing: 'Не определено',
    audience: 'Не определено',
    channels: 'Не определено',
    strengths: ['Введи URL сайта для полного анализа'],
    weaknesses: ['Данные не загружены'],
    opportunities: ['Используй "Анализ продуктов" для парсинга каталога'],
    summary: `Для анализа "${name}" введи URL их сайта в поле выше — система загрузит и разберёт страницу автоматически.`
  };
}

function showCompProxyFallback(input) {
  const result = document.getElementById('compAutoResult');
  result.style.display = 'block';
  const domain = (() => { try { return new URL(input).hostname; } catch { return input; } })();
  result.innerHTML = `
    <div style="background:rgba(255,150,0,0.1);border:1px solid rgba(255,150,0,0.35);border-radius:10px;padding:20px">
      <div style="font-weight:600;color:var(--orange);margin-bottom:8px">⚠️ Сайт не отдаёт данные через прокси</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:16px">
        Сайт <strong>${domain}</strong> защищён от внешних запросов (Cloudflare, JS-рендеринг или региональные ограничения). 
        Это нормально для крупных платформ.
      </div>
      <div style="font-size:13px;color:var(--text1);margin-bottom:12px"><strong>Что сделать:</strong></div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--text2)">
        <div>1️⃣ Используй раздел <strong>«Ручной анализ конкурентов»</strong> ниже — заполни карточку вручную</div>
        <div>2️⃣ Для парсинга каталога — перейди в <strong>«Анализ продуктов»</strong>, там тоже пробует несколько прокси</div>
        <div>3️⃣ Открой сайт вручную и занеси ключевые данные в карточку ниже</div>
      </div>
      <button onclick="addCompetitorPrefilled('${domain}')" style="margin-top:16px;background:var(--accent);color:#0a0a0f;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:600">+ Создать карточку для ${domain}</button>
    </div>
  `;
}

function addCompetitorPrefilled(domain) {
  competitors.push({
    id: Date.now(), name: domain,
    url: document.getElementById('compAutoUrl').value.trim(),
    description: '', usp: '', pricing: '', audience: '',
    social: 'Слабая', seo: 'Средние', content: '', rating: 3, notes: ''
  });
  renderCompetitors();
  document.getElementById('competitorCards').scrollIntoView({ behavior: 'smooth' });
}

function renderCompAutoResult(c, sourceInput) {
  const result = document.getElementById('compAutoResult');
  result.style.display = 'block';

  const tagsHtml = (arr, color) => (arr || []).map(t =>
    `<span style="display:inline-block;background:${color}20;color:${color};border:1px solid ${color}40;border-radius:6px;padding:3px 10px;font-size:12px;margin:3px">${t}</span>`
  ).join('');

  result.innerHTML = `
    <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <div style="background:var(--accent);color:#0a0a0f;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;font-size:18px">${c.name || sourceInput}</div>
          <div style="font-size:13px;opacity:0.7;margin-top:2px">${c.tagline || ''}</div>
        </div>
        <button onclick="addAutoCompetitorToTable()" style="background:#0a0a0f;color:var(--accent);border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600">+ В таблицу</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
        ${compInfoRow('🎯 УТП', c.usp)}
        ${compInfoRow('📦 Продукты / услуги', c.products)}
        ${compInfoRow('💰 Ценовой сегмент', c.pricing)}
        ${compInfoRow('👥 Аудитория', c.audience)}
        ${compInfoRow('📣 Каналы маркетинга', c.channels)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;padding:20px;background:var(--bg2)">
        <div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">✅ Сильные стороны</div>
          ${tagsHtml(c.strengths, 'var(--green)')}
        </div>
        <div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">❌ Слабые стороны</div>
          ${tagsHtml(c.weaknesses, 'var(--red)')}
        </div>
        <div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">💡 Ваши возможности</div>
          ${tagsHtml(c.opportunities, 'var(--blue)')}
        </div>
      </div>
      <div style="padding:16px 20px;border-top:1px solid var(--border);font-size:13px;color:var(--text2)">
        <strong style="color:var(--accent)">📊 Вывод:</strong> ${c.summary || ''}
      </div>
    </div>
  `;

  // Store last analyzed competitor for "add to table"
  window._lastAutoComp = c;
}

function compInfoRow(label, value) {
  return `<div style="padding:12px 20px;border-bottom:1px solid var(--border)">
    <div style="font-size:11px;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">${label}</div>
    <div style="font-size:13px;color:var(--text1)">${value || '—'}</div>
  </div>`;
}

function addAutoCompetitorToTable() {
  const c = window._lastAutoComp;
  if (!c) return;
  competitors.push({
    id: Date.now(),
    name: c.name || 'Конкурент',
    url: document.getElementById('compAutoUrl').value.trim(),
    description: c.tagline || '',
    usp: c.usp || '',
    pricing: c.pricing || '',
    audience: c.audience || '',
    social: 'Средняя',
    seo: 'Средние',
    content: c.channels || '',
    rating: 3,
    notes: c.summary || ''
  });
  renderCompetitors();
  document.getElementById('competitorCards').scrollIntoView({ behavior: 'smooth' });
}

// ════════════════════════════════════════════
//  07 — INN COMPANY ANALYSIS (legacy, hidden)
// ════════════════════════════════════════════

let innSaved = []; // array of company data objects

async function runINN() {
  const inn = document.getElementById('innInput').value.trim();
  if (!inn || inn.length < 10) {
    showInlineError('innInput', 'ИНН должен содержать 10 или 12 цифр');
    return;
  }

  const loading = document.getElementById('innLoading');
  const errEl = document.getElementById('innError');
  loading.style.display = 'flex';
  errEl.style.display = 'none';
  document.getElementById('innResults').style.display = 'none';

  try {
    // Primary: EGRUL/open data via dadata suggestions API (no key needed for basic)
    let company = null;

    // Try dadata.ru free suggest endpoint
    try {
      const r = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Token ' + 'b1a3b06ad3f51e5e3c0fab5a47f20c00d3a2a940' },
        body: JSON.stringify({ query: inn, count: 1 })
      });
      if (r.ok) {
        const data = await r.json();
        if (data.suggestions && data.suggestions.length > 0) {
          company = parseDadata(data.suggestions[0]);
        }
      }
    } catch(e) {}

    // Fallback: try open EGRUL API
    if (!company) {
      try {
        const r2 = await fetch(`https://egrul.itsoft.ru/${inn}.json`);
        if (r2.ok) {
          const d2 = await r2.json();
          company = parseEgrulData(d2, inn);
        }
      } catch(e) {}
    }

    // Final fallback: construct what we can from INN structure
    if (!company) {
      company = buildFromINN(inn);
    }

    loading.style.display = 'none';
    renderINNReport(company);

    // Save to list
    if (!innSaved.find(c => c.inn === inn)) {
      innSaved.unshift(company);
      renderInnSaved();
    }

  } catch(e) {
    loading.style.display = 'none';
    errEl.style.display = 'block';
    errEl.innerHTML = '⚠️ Не удалось получить данные. Проверь ИНН и попробуй снова.';
  }
}

function parseDadata(s) {
  const d = s.data;
  return {
    inn: d.inn,
    kpp: d.kpp || '—',
    ogrn: d.ogrn || '—',
    name: d.name?.short_with_opf || d.name?.full_with_opf || s.value,
    nameFull: d.name?.full_with_opf || s.value,
    type: d.type === 'LEGAL' ? 'Юридическое лицо' : 'ИП',
    status: d.state?.status === 'ACTIVE' ? 'Действующая' : d.state?.status === 'LIQUIDATED' ? 'Ликвидирована' : d.state?.status || '—',
    regDate: d.state?.registration_date ? new Date(d.state.registration_date).toLocaleDateString('ru-RU') : '—',
    liquidDate: d.state?.liquidation_date ? new Date(d.state.liquidation_date).toLocaleDateString('ru-RU') : null,
    address: d.address?.value || '—',
    region: d.address?.data?.region_with_type || '—',
    city: d.address?.data?.city || d.address?.data?.settlement || '—',
    okved: d.okved || '—',
    okvedName: d.okved_type || '—',
    okvedAll: d.okveds?.slice(0, 5).map(o => o.code + ' ' + (o.name || '')).join('; ') || '—',
    manager: d.management?.name || '—',
    managerPost: d.management?.post || '—',
    employees: d.employee_count ? String(d.employee_count) : '—',
    capital: d.finance?.ustavnoj_kapital ? fmt(d.finance.ustavnoj_kapital) + ' ₽' : '—',
    revenue: d.finance?.revenue ? fmt(d.finance.revenue) + ' ₽' : '—',
    profit: d.finance?.net_income ? fmt(d.finance.net_income) + ' ₽' : '—',
    taxSystem: d.finance?.tax_system || '—',
    phones: d.phones?.map(p => p.value).join(', ') || '—',
    emails: d.emails?.map(e => e.value).join(', ') || '—',
    site: d.site || '—',
    source: 'dadata'
  };
}

function parseEgrulData(d, inn) {
  return {
    inn,
    kpp: d.КПП || '—',
    ogrn: d.ОГРН || '—',
    name: d.НаимСокрЮЛ || d.НаимПолнЮЛ || `Компания ИНН ${inn}`,
    nameFull: d.НаимПолнЮЛ || '—',
    type: 'Юридическое лицо',
    status: d.СвСтатус?.НаимСтатусЮЛ || 'Действующая',
    regDate: d.ДатаОГРН || '—',
    address: d.АдрЮЛФИАС?.АдресПолн || '—',
    region: '—', city: '—',
    okved: d.СвОКВЭД?.КодОКВЭД || '—',
    okvedName: d.СвОКВЭД?.НаимОКВЭД || '—',
    okvedAll: '—',
    manager: d.СвРуководство?.РуководительЮЛ?.ФИОРуководителя || '—',
    managerPost: d.СвРуководство?.РуководительЮЛ?.НаимДолжн || '—',
    employees: '—', capital: '—', revenue: '—', profit: '—',
    taxSystem: '—', phones: '—', emails: '—', site: '—',
    source: 'egrul'
  };
}

function buildFromINN(inn) {
  const regionCode = inn.slice(0, 2);
  const regions = {
    '77':'Москва','78':'Санкт-Петербург','50':'Московская обл.','23':'Краснодарский край',
    '66':'Свердловская обл.','74':'Челябинская обл.','16':'Татарстан','52':'Нижегородская обл.',
    '54':'Новосибирская обл.','55':'Омская обл.','61':'Ростовская обл.','63':'Самарская обл.'
  };
  return {
    inn,
    kpp: '—', ogrn: '—',
    name: `Компания ИНН ${inn}`,
    nameFull: '—',
    type: inn.length === 12 ? 'ИП' : 'Юридическое лицо',
    status: 'Неизвестно (нет данных)',
    regDate: '—',
    address: '—',
    region: regions[regionCode] || `Регион ${regionCode}`,
    city: '—',
    okved: '—', okvedName: '—', okvedAll: '—',
    manager: '—', managerPost: '—',
    employees: '—', capital: '—', revenue: '—', profit: '—',
    taxSystem: '—', phones: '—', emails: '—', site: '—',
    source: 'fallback'
  };
}

function renderINNReport(c) {
  document.getElementById('innCompanyName').textContent = c.name;

  const isActive = c.status === 'Действующая';
  const ageYears = c.regDate !== '—' ? Math.floor((Date.now() - new Date(c.regDate.split('.').reverse().join('-'))) / (365.25*24*3600*1000)) : null;

  // Marketing analysis
  const mktInsights = generateInnMarketingInsights(c, ageYears);

  document.getElementById('innReport').innerHTML = `
    <div class="inn-card-grid">
      <div class="inn-block">
        <div class="inn-block-title">📋 Основные реквизиты</div>
        ${innRow('ИНН', c.inn)}
        ${innRow('КПП', c.kpp)}
        ${innRow('ОГРН', c.ogrn)}
        ${innRow('Тип', c.type)}
        ${innRow('Статус', c.status, isActive ? 'green' : 'red')}
        ${innRow('Дата регистрации', c.regDate)}
        ${ageYears !== null ? innRow('Возраст компании', ageYears + ' лет', ageYears > 5 ? 'green' : ageYears > 2 ? 'yellow' : 'red') : ''}
        ${c.liquidDate ? innRow('Дата ликвидации', c.liquidDate, 'red') : ''}
      </div>

      <div class="inn-block">
        <div class="inn-block-title">📍 Адрес и контакты</div>
        ${innRow('Адрес', c.address)}
        ${innRow('Регион', c.region)}
        ${innRow('Город', c.city)}
        ${innRow('Телефоны', c.phones)}
        ${innRow('Email', c.emails)}
        ${innRow('Сайт', c.site)}
      </div>

      <div class="inn-block">
        <div class="inn-block-title">🏭 Деятельность (ОКВЭД)</div>
        ${innRow('Основной ОКВЭД', c.okved)}
        ${innRow('Описание', c.okvedName)}
        ${c.okvedAll !== '—' ? innRow('Доп. виды', c.okvedAll) : ''}
      </div>

      <div class="inn-block">
        <div class="inn-block-title">💰 Финансы и персонал</div>
        ${innRow('Выручка (посл. год)', c.revenue, 'green')}
        ${innRow('Чистая прибыль', c.profit)}
        ${innRow('Уставной капитал', c.capital)}
        ${innRow('Сотрудников', c.employees)}
        ${innRow('Система налогообложения', c.taxSystem)}
        ${innRow('Руководитель', c.manager)}
        ${innRow('Должность', c.managerPost)}
      </div>
    </div>

    <div class="inn-block" style="margin-bottom:16px">
      <div class="inn-block-title">🎯 Маркетинговый анализ конкурента</div>
      <div class="inn-marketing-grid">
        ${mktInsights.map(ins => `
          <div class="inn-marketing-card">
            <h5>${ins.title}</h5>
            <p>${ins.text}</p>
          </div>
        `).join('')}
      </div>
    </div>

    ${c.source === 'fallback' ? `<div class="abc-insights" style="margin-top:0">
      ⚠️ <strong>Данные не найдены через API.</strong> Рекомендую проверить ИНН вручную на:
      <a href="https://egrul.nalog.ru/index.html" target="_blank" style="color:var(--blue)">egrul.nalog.ru</a> ·
      <a href="https://www.list-org.com/search?type=inn&val=${c.inn}" target="_blank" style="color:var(--blue)">list-org.com</a> ·
      <a href="https://zachestnyibiznes.ru/company/ul/${c.inn}" target="_blank" style="color:var(--blue)">zachestnyibiznes.ru</a>
    </div>` : ''}
  `;

  document.getElementById('innResults').style.display = 'block';
  renderInnSaved();
  updateInnCompareTable();
}

function innRow(label, value, colorClass = '') {
  return `<div class="inn-row"><span class="inn-label">${label}</span><span class="inn-value ${colorClass}">${value || '—'}</span></div>`;
}

function generateInnMarketingInsights(c, ageYears) {
  const insights = [];

  // Age & stability
  if (ageYears !== null) {
    if (ageYears >= 10) insights.push({ title: '🏛 Зрелый игрок', text: `${ageYears} лет на рынке. Вероятно устойчивые процессы, лояльная база клиентов. Конкурировать через инновации и скорость.` });
    else if (ageYears >= 3) insights.push({ title: '📈 Растущий конкурент', text: `${ageYears} года на рынке. Активная фаза роста. Следи за их маркетингом и позиционированием.` });
    else insights.push({ title: '🆕 Новичок на рынке', text: `Менее ${ageYears + 1} лет. Слабая история и репутация — используй это в коммуникации.` });
  }

  // Scale by employees
  if (c.employees && c.employees !== '—') {
    const emp = parseInt(c.employees);
    if (emp > 500) insights.push({ title: '🏢 Крупная компания', text: `${emp} сотрудников. Медленные решения, большой бюджет. Выигрывай гибкостью и нишевым предложением.` });
    else if (emp > 50) insights.push({ title: '🏬 Средний бизнес', text: `${emp} сотрудников. Профессиональная команда, структурированные процессы.` });
    else if (emp > 0) insights.push({ title: '🏪 Малый бизнес', text: `${emp} сотрудников. Ограниченные ресурсы на маркетинг — ищи их слабые места.` });
  }

  // Region
  if (c.region && c.region !== '—') {
    insights.push({ title: '📍 География', text: `Зарегистрированы в: ${c.region}. Уточни реальный охват рынка — региональный или федеральный.` });
  }

  // OKVED
  if (c.okvedName && c.okvedName !== '—') {
    insights.push({ title: '🏭 Профиль бизнеса', text: c.okvedName.slice(0, 120) + (c.okvedName.length > 120 ? '…' : '') });
  }

  // Revenue analysis
  if (c.revenue && c.revenue !== '—') {
    insights.push({ title: '💰 Финансовая мощь', text: `Выручка: ${c.revenue}. Оцени долю рынка и возможный маркетинговый бюджет (обычно 3-15% от выручки).` });
  }

  // Always add action items
  insights.push({ title: '🔍 Что проверить', text: 'Изучи их сайт инструментом SEO-аудит, каталог — через Анализ продуктов, маркетинг — поищи в соцсетях и рекламных кабинетах.' });

  if (insights.length < 3) insights.push({ title: '📊 Рекомендация', text: 'Сравни с другими конкурентами — добавь несколько ИНН и получи сравнительную таблицу ниже.' });

  return insights.slice(0, 6);
}

function renderInnSaved() {
  const container = document.getElementById('innSavedList');
  if (!innSaved.length) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <h4 style="margin-bottom:12px">Сохранённые компании (${innSaved.length})</h4>
    <div class="inn-saved-list">
      ${innSaved.map((c, i) => `
        <div class="inn-saved-item" onclick="renderINNReport(innSaved[${i}])">
          <div>
            <div class="inn-saved-name">${c.name}</div>
            <div class="inn-saved-meta">ИНН ${c.inn} · ${c.status} · ${c.region}</div>
          </div>
          <button onclick="event.stopPropagation();innSaved.splice(${i},1);renderInnSaved();updateInnCompareTable()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px">×</button>
        </div>
      `).join('')}
    </div>
  `;
}

function updateInnCompareTable() {
  const panel = document.getElementById('innComparePanel');
  if (innSaved.length < 2) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  document.getElementById('innCompareBlock').style.display = 'block';

  const fields = [
    ['Статус', 'status'], ['Тип', 'type'], ['Регион', 'region'],
    ['Дата регистрации', 'regDate'], ['ОКВЭД', 'okved'],
    ['Деятельность', 'okvedName'], ['Выручка', 'revenue'],
    ['Прибыль', 'profit'], ['Сотрудников', 'employees'],
    ['Руководитель', 'manager'], ['Адрес', 'address']
  ];

  document.getElementById('innCompareTable').innerHTML = `
    <thead>
      <tr>
        <th>Параметр</th>
        ${innSaved.map(c => `<th>${c.name.slice(0, 30)}<br><span style="font-weight:400;color:var(--text3);font-size:11px">ИНН ${c.inn}</span></th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${fields.map(([label, key]) => `
        <tr>
          <td>${label}</td>
          ${innSaved.map(c => `<td style="font-size:12px">${c[key] || '—'}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  `;
}

function exportINN() {
  const c = innSaved[0];
  if (!c) return;
  const data = [
    { Параметр: 'Название', Значение: c.name },
    { Параметр: 'ИНН', Значение: c.inn },
    { Параметр: 'КПП', Значение: c.kpp },
    { Параметр: 'ОГРН', Значение: c.ogrn },
    { Параметр: 'Тип', Значение: c.type },
    { Параметр: 'Статус', Значение: c.status },
    { Параметр: 'Дата регистрации', Значение: c.regDate },
    { Параметр: 'Адрес', Значение: c.address },
    { Параметр: 'Регион', Значение: c.region },
    { Параметр: 'ОКВЭД', Значение: c.okved },
    { Параметр: 'Деятельность', Значение: c.okvedName },
    { Параметр: 'Выручка', Значение: c.revenue },
    { Параметр: 'Прибыль', Значение: c.profit },
    { Параметр: 'Сотрудников', Значение: c.employees },
    { Параметр: 'Руководитель', Значение: c.manager + ' (' + c.managerPost + ')' },
    { Параметр: 'Телефоны', Значение: c.phones },
    { Параметр: 'Email', Значение: c.emails },
    { Параметр: 'Сайт', Значение: c.site },
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 25 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Данные компании');
  XLSX.writeFile(wb, `ИНН-анализ-${c.inn}.xlsx`);
}

function exportInnCompare() {
  if (innSaved.length < 2) return;
  const fields = ['name','inn','type','status','regDate','region','okved','okvedName','revenue','profit','employees','manager','address'];
  const labels = ['Название','ИНН','Тип','Статус','Дата рег.','Регион','ОКВЭД','Деятельность','Выручка','Прибыль','Сотрудников','Руководитель','Адрес'];
  const data = innSaved.map(c => {
    const row = {};
    fields.forEach((f, i) => { row[labels[i]] = c[f] || '—'; });
    return row;
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Сравнение компаний');
  XLSX.writeFile(wb, 'Сравнение-конкурентов-ИНН.xlsx');
}

// ════════════════════════════════════════════
//  08 — PDF SPELL CHECKER
// ════════════════════════════════════════════

let pdfErrors = [];
let pdfPageCount = 0;
let pdfFileName = '';

function handlePDFUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) {
    alert('Файл слишком большой. Максимум 20 МБ.'); return;
  }
  pdfFileName = file.name;
  document.getElementById('pdfUploadArea').querySelector('.upload-text').textContent = '✅ ' + file.name;
  document.getElementById('pdfUploadArea').style.borderColor = 'var(--green)';

  const fileInfo = document.getElementById('pdfFileInfo');
  fileInfo.style.display = 'block';
  fileInfo.innerHTML = `📄 <strong>${file.name}</strong> · ${(file.size/1024).toFixed(0)} КБ · Нажми кнопку ниже для запуска проверки`;

  // Auto-run after short delay
  setTimeout(() => runPDFCheck(file), 300);
}

async function runPDFCheck(fileArg) {
  const fileInput = document.getElementById('pdfFile');
  const file = fileArg || fileInput.files[0];
  if (!file) { alert('Сначала загрузи PDF файл'); return; }

  const loading = document.getElementById('pdfLoading');
  loading.style.display = 'flex';
  document.getElementById('pdfResults').style.display = 'none';
  pdfErrors = [];

  try {
    document.getElementById('pdfLoadingText').textContent = 'Читаю PDF...';
    const pages = await extractPDFText(file);
    pdfPageCount = pages.length;

    document.getElementById('pdfLoadingText').textContent = `Проверяю орфографию (${pages.length} страниц)...`;

    const lang = document.getElementById('pdfLang').value;
    const ignoreCaps = document.getElementById('pdfIgnoreCaps').checked;
    const ignoreNums = document.getElementById('pdfIgnoreNumbers').checked;
    const ignoreUrls = document.getElementById('pdfIgnoreUrls').checked;

    // Check each page with Yandex Speller
    for (let i = 0; i < pages.length; i++) {
      document.getElementById('pdfLoadingText').textContent = `Проверяю страницу ${i+1} из ${pages.length}...`;
      if (!pages[i].trim()) continue;

      const pageErrors = await checkSpelling(pages[i], i + 1, lang, ignoreCaps, ignoreNums, ignoreUrls);
      pdfErrors.push(...pageErrors);

      // Also find repeated words
      const repeatErrors = findRepeatedWords(pages[i], i + 1);
      pdfErrors.push(...repeatErrors);

      // Rate limit: pause between requests
      if (i < pages.length - 1) await new Promise(r => setTimeout(r, 200));
    }

    loading.style.display = 'none';
    renderPDFResults(pages);

  } catch(e) {
    loading.style.display = 'none';
    document.getElementById('pdfResults').style.display = 'block';
    document.getElementById('pdfErrorList').innerHTML = `<div class="abc-insights">⚠️ Ошибка обработки PDF: ${e.message}.<br>Убедись что файл не защищён паролем и содержит текстовый слой (не скан).</div>`;
  }
}

async function extractPDFText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Use PDF.js from CDN
        if (!window.pdfjsLib) {
          // Dynamically load PDF.js
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const text = content.items.map(item => item.str).join(' ');
          pages.push(text);
        }
        resolve(pages);
      } catch(err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function checkSpelling(text, pageNum, lang, ignoreCaps, ignoreNums, ignoreUrls) {
  try {
    // Clean text for API
    let cleanText = text;
    if (ignoreUrls) cleanText = cleanText.replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/g, ' ');
    if (ignoreNums) cleanText = cleanText.replace(/\b\d[\d.,]*\b/g, ' ');

    // Yandex Speller API (free, no key needed)
    const params = new URLSearchParams({
      text: cleanText.slice(0, 10000),
      lang: lang,
      options: ignoreCaps ? '512' : '0',
      format: 'plain'
    });

    const response = await fetch(`https://speller.yandex.net/services/spellservice.json/checkText?${params}`);
    if (!response.ok) return [];

    const data = await response.json();
    return data.map(err => ({
      page: pageNum,
      type: 'spell',
      word: err.word,
      suggestions: err.s ? err.s.slice(0, 3) : [],
      context: getContext(text, err.pos, err.word.length),
      code: err.code
    })).filter(e => e.word && e.word.length > 1);
  } catch(e) {
    return [];
  }
}

function findRepeatedWords(text, pageNum) {
  const errors = [];
  const words = text.match(/[а-яёА-ЯЁa-zA-Z]+/g) || [];
  for (let i = 1; i < words.length; i++) {
    if (words[i].toLowerCase() === words[i-1].toLowerCase() && words[i].length > 2) {
      errors.push({
        page: pageNum,
        type: 'repeat',
        word: words[i],
        suggestions: [],
        context: `…${words.slice(Math.max(0,i-2), i+3).join(' ')}…`,
        code: 0
      });
    }
  }
  return errors;
}

function getContext(text, pos, len) {
  const start = Math.max(0, pos - 30);
  const end = Math.min(text.length, pos + len + 30);
  return '…' + text.slice(start, pos) + '**' + text.slice(pos, pos + len) + '**' + text.slice(pos + len, end) + '…';
}

function renderPDFResults(pages) {
  const spellCount = pdfErrors.filter(e => e.type === 'spell').length;
  const repeatCount = pdfErrors.filter(e => e.type === 'repeat').length;
  const pagesWithErrors = [...new Set(pdfErrors.map(e => e.page))].length;

  document.getElementById('pdfSummary').innerHTML = `
    <div class="pdf-stat"><div class="pdf-stat-val ${spellCount > 0 ? 'error' : 'ok'}">${spellCount}</div><div class="pdf-stat-label">Орфографических ошибок</div></div>
    <div class="pdf-stat"><div class="pdf-stat-val ${repeatCount > 0 ? 'warn' : 'ok'}">${repeatCount}</div><div class="pdf-stat-label">Повторов слов</div></div>
    <div class="pdf-stat"><div class="pdf-stat-val ${pagesWithErrors > 0 ? 'warn' : 'ok'}">${pagesWithErrors}</div><div class="pdf-stat-label">Страниц с ошибками</div></div>
    <div class="pdf-stat"><div class="pdf-stat-val ok">${pdfPageCount}</div><div class="pdf-stat-label">Всего страниц</div></div>
  `;

  // Fill page filter
  const pages2 = [...new Set(pdfErrors.map(e => e.page))].sort((a,b)=>a-b);
  document.getElementById('pdfFilterPage').innerHTML =
    '<option value="all">Все страницы</option>' +
    pages2.map(p => `<option value="${p}">Страница ${p}</option>`).join('');

  document.getElementById('pdfResults').style.display = 'block';
  renderPDFErrors();
}

function renderPDFErrors() {
  const filterPage = document.getElementById('pdfFilterPage').value;
  const filterType = document.getElementById('pdfFilterType').value;
  const search = document.getElementById('pdfSearch').value.toLowerCase();

  let errors = pdfErrors.filter(e => {
    if (filterPage !== 'all' && e.page !== parseInt(filterPage)) return false;
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (search && !e.word.toLowerCase().includes(search) && !e.context.toLowerCase().includes(search)) return false;
    return true;
  });

  const container = document.getElementById('pdfErrorList');

  if (!errors.length) {
    container.innerHTML = pdfErrors.length === 0
      ? '<div class="abc-insights">🎉 <strong>Ошибок не найдено!</strong> Текст прошёл проверку орфографии.</div>'
      : '<div class="abc-insights">Нет ошибок по выбранным фильтрам.</div>';
    return;
  }

  const typeLabels = { spell: 'Орфография', repeat: 'Повтор', punct: 'Пунктуация' };
  container.innerHTML = errors.slice(0, 200).map(e => `
    <div class="pdf-error-item ${e.type}">
      <div class="pdf-error-page">Стр. ${e.page}</div>
      <div class="pdf-error-type">${typeLabels[e.type] || e.type}</div>
      <div class="pdf-error-word">
        ${e.context.replace(`**${e.word}**`, `<strong>${e.word}</strong>`).replace(/\*\*/g, '')}
      </div>
      <div class="pdf-error-suggest">${e.suggestions.length ? '→ ' + e.suggestions.join(', ') : ''}</div>
    </div>
  `).join('') + (errors.length > 200 ? `<div class="abc-insights">Показаны первые 200 из ${errors.length} ошибок. Скачай полный отчёт.</div>` : '');
}

async function exportPDFReport() {
  if (!pdfErrors.length && pdfPageCount === 0) { alert('Сначала загрузи и проверь PDF'); return; }

  const spellC = pdfErrors.filter(e => e.type === 'spell').length;
  const repC   = pdfErrors.filter(e => e.type === 'repeat').length;
  const pageSet = [...new Set(pdfErrors.map(e => e.page))].length;

  const typeMap = { spell: 'Орфография', repeat: 'Повтор слова', punct: 'Пунктуация' };

  // Summary sheet
  const summary = [
    { Параметр: 'Файл', Значение: pdfFileName },
    { Параметр: 'Дата проверки', Значение: new Date().toLocaleDateString('ru-RU') },
    { Параметр: 'Всего страниц', Значение: pdfPageCount },
    { Параметр: 'Орфографических ошибок', Значение: spellC },
    { Параметр: 'Повторов слов', Значение: repC },
    { Параметр: 'Страниц с ошибками', Значение: pageSet },
    { Параметр: 'ИТОГО ошибок', Значение: pdfErrors.length },
  ];

  // Errors sheet
  const errors = pdfErrors.map((e, i) => ({
    '№': i + 1,
    'Страница': 'Стр. ' + e.page,
    'Тип': typeMap[e.type] || e.type,
    'Слово с ошибкой': e.word,
    'Вариант исправления': e.suggestions.join(', ') || '—',
    'Контекст': e.context.replace(/\*\*/g, ''),
  }));

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summary);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Сводка');

  if (errors.length) {
    const wsErrors = XLSX.utils.json_to_sheet(errors);
    wsErrors['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsErrors, 'Ошибки');
  }

  XLSX.writeFile(wb, 'Проверка-орфографии-' + pdfFileName.replace('.pdf', '') + '.xlsx');
}

// ════════════════════════════════════════════
//  09 — ROI CALCULATOR
// ════════════════════════════════════════════

function calcROI() {
  const budget  = +document.getElementById('roiBudget').value  || 0;
  const revenue = +document.getElementById('roiRevenue').value || 0;
  const cogs    = +document.getElementById('roiCOGS').value    || 0;
  const extra   = +document.getElementById('roiExtra').value   || 0;
  const clicks  = +document.getElementById('roiClicks').value  || 0;
  const leads   = +document.getElementById('roiLeads').value   || 0;
  const sales   = +document.getElementById('roiSales').value   || 0;
  const aov     = +document.getElementById('roiAOV').value     || 0;

  const totalCost  = budget + extra;
  const grossProfit = revenue - cogs;
  const netProfit  = grossProfit - totalCost;
  const roi        = totalCost > 0 ? ((netProfit / totalCost) * 100) : 0;
  const roas       = budget > 0 ? (revenue / budget) : 0;
  const cpc        = clicks > 0 ? (budget / clicks) : 0;
  const cpl        = leads > 0  ? (budget / leads)  : 0;
  const cpa        = sales > 0  ? (budget / sales)  : 0;
  const cr_click2lead = clicks > 0 && leads > 0 ? (leads / clicks * 100) : 0;
  const cr_lead2sale  = leads > 0 && sales > 0  ? (sales / leads * 100)  : 0;
  const breakEvenRev  = totalCost + cogs;

  const roiColor = roi >= 100 ? 'var(--green)' : roi >= 0 ? 'var(--accent)' : 'var(--red)';
  const roasColor = roas >= 3 ? 'var(--green)' : roas >= 1 ? 'var(--accent)' : 'var(--red)';
  const npColor   = netProfit >= 0 ? 'var(--green)' : 'var(--red)';

  document.getElementById('roiKpis').innerHTML = `
    <div class="media-kpi"><div class="media-kpi-val" style="color:${roiColor}">${roi.toFixed(1)}%</div><div class="media-kpi-label">ROI</div></div>
    <div class="media-kpi"><div class="media-kpi-val" style="color:${roasColor}">${roas.toFixed(2)}x</div><div class="media-kpi-label">ROAS</div></div>
    <div class="media-kpi"><div class="media-kpi-val" style="color:${npColor}">${fmt(netProfit)} ₽</div><div class="media-kpi-label">Чистая прибыль</div></div>
    <div class="media-kpi"><div class="media-kpi-val">${fmt(grossProfit)} ₽</div><div class="media-kpi-label">Валовая прибыль</div></div>
    <div class="media-kpi"><div class="media-kpi-val">${cpc > 0 ? fmt(cpc) + ' ₽' : '—'}</div><div class="media-kpi-label">CPC</div></div>
    <div class="media-kpi"><div class="media-kpi-val">${cpl > 0 ? fmt(cpl) + ' ₽' : '—'}</div><div class="media-kpi-label">CPL (цена лида)</div></div>
    <div class="media-kpi"><div class="media-kpi-val">${cpa > 0 ? fmt(cpa) + ' ₽' : '—'}</div><div class="media-kpi-label">CPA (цена продажи)</div></div>
    <div class="media-kpi"><div class="media-kpi-val">${fmt(breakEvenRev)} ₽</div><div class="media-kpi-label">Точка безубыточности</div></div>
  `;

  const roiLabel = roi >= 200 ? '🚀 Отличный результат' : roi >= 100 ? '✅ Хорошо' : roi >= 0 ? '⚠️ В плюсе, но слабо' : '❌ Убыток';
  const roasLabel = roas >= 4 ? 'Отличный ROAS' : roas >= 2 ? 'Норм ROAS' : roas >= 1 ? 'ROAS ниже нормы' : 'ROAS < 1 — реклама убыточна';

  document.getElementById('roiBreakdown').innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px">
      <h4 style="margin-bottom:16px;color:var(--accent)">📋 Детальный разбор</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
        ${roiDetailRow('Рекламный бюджет', fmt(budget) + ' ₽', 'var(--text2)')}
        ${roiDetailRow('Прочие расходы', fmt(extra) + ' ₽', 'var(--text2)')}
        ${roiDetailRow('Итого затрат', fmt(totalCost) + ' ₽', 'var(--orange)')}
        ${roiDetailRow('Выручка', fmt(revenue) + ' ₽', 'var(--text1)')}
        ${roiDetailRow('Себестоимость', fmt(cogs) + ' ₽', 'var(--text2)')}
        ${roiDetailRow('Валовая прибыль', fmt(grossProfit) + ' ₽', 'var(--text1)')}
        ${roiDetailRow('Чистая прибыль', fmt(netProfit) + ' ₽', npColor)}
        ${cr_click2lead > 0 ? roiDetailRow('Клик → Лид CR', cr_click2lead.toFixed(1) + '%', 'var(--blue)') : ''}
        ${cr_lead2sale > 0 ? roiDetailRow('Лид → Продажа CR', cr_lead2sale.toFixed(1) + '%', 'var(--blue)') : ''}
      </div>
      <div style="margin-top:16px;padding:12px;background:${roi >= 0 ? 'rgba(66,255,176,0.08)' : 'rgba(255,91,91,0.08)'};border-radius:8px">
        <strong style="color:${roiColor}">${roiLabel}</strong> · ${roasLabel}<br>
        <span style="font-size:12px;color:var(--text2);margin-top:4px;display:block">
          Точка безубыточности: нужно выручки минимум <strong>${fmt(breakEvenRev)} ₽</strong> чтобы окупить все затраты.
          ${revenue < breakEvenRev ? `До безубыточности не хватает <strong style="color:var(--red)">${fmt(breakEvenRev - revenue)} ₽</strong>.` : `Ты выше точки безубыточности на <strong style="color:var(--green)">${fmt(revenue - breakEvenRev)} ₽</strong>.`}
        </span>
      </div>
    </div>
  `;
}

function roiDetailRow(label, value, color) {
  return `<div style="padding:8px 12px;background:var(--bg3);border-radius:6px;display:flex;justify-content:space-between">
    <span style="color:var(--text2)">${label}</span>
    <strong style="color:${color}">${value}</strong>
  </div>`;
}

function exportROI() {
  const fields = [
    ['Рекламный бюджет', document.getElementById('roiBudget').value + ' ₽'],
    ['Выручка', document.getElementById('roiRevenue').value + ' ₽'],
    ['Себестоимость', document.getElementById('roiCOGS').value + ' ₽'],
    ['Прочие расходы', document.getElementById('roiExtra').value + ' ₽'],
    ['Клики', document.getElementById('roiClicks').value],
    ['Лиды', document.getElementById('roiLeads').value],
    ['Продажи', document.getElementById('roiSales').value],
    ['Средний чек', document.getElementById('roiAOV').value + ' ₽'],
  ];
  // Grab KPIs from DOM
  const kpiEls = document.querySelectorAll('#roiKpis .media-kpi');
  kpiEls.forEach(el => {
    const val = el.querySelector('.media-kpi-val')?.textContent?.trim();
    const lbl = el.querySelector('.media-kpi-label')?.textContent?.trim();
    if (lbl && val) fields.push([lbl, val]);
  });
  const data = fields.map(([Параметр, Значение]) => ({ Параметр, Значение }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'ROI-анализ');
  XLSX.writeFile(wb, 'ROI-анализ.xlsx');
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
calcROI();
