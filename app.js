// ════════════════════════════════════════════
//  MarketKit Pro — Advanced Logic
// ════════════════════════════════════════════

let mediaChannels = [];
let abcData = [];

// ── Navigation ──────────────────────────────
function showTool(toolName) {
  document.querySelectorAll('.tool-section').forEach(s => s.classList.remove('active'));
  document.querySelector('.hero').style.display = 'none';
  const section = document.getElementById('tool-' + toolName);
  if (section) {
    section.classList.add('active');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showTool(link.dataset.tool);
  });
});

// ── Helpers ──────────────────────────────
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const fmtK = n => n > 1000 ? (n/1000).toFixed(1)+'K' : n;
const getHtml = async (url, setStatus) => {
    setStatus('Подключение к сайту...');
    // Proxy to bypass CORS
    const proxy = 'https://api.allorigins.win/get?url=';
    try {
        const res = await fetch(proxy + encodeURIComponent(url));
        const data = await res.json();
        return data.contents;
    } catch(e) {
        console.error(e);
        return '';
    }
};

// ════════════════════════════════════════════
//  01 — ABC/XYZ ANALYSIS (Multi-dimensional)
// ════════════════════════════════════════════

function handleABCFile(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => document.getElementById('abcManual').value = e.target.result;
    reader.readAsText(file);
}

function runABC() {
    const raw = document.getElementById('abcManual').value.trim();
    if(!raw) return alert("Вставьте данные");
    
    const lines = raw.split('\n').filter(l => l.trim());
    abcData = [];

    lines.forEach(line => {
        // Support Name;Revenue;Qty OR Name;Revenue
        const parts = line.split(';');
        if(parts.length < 2) return;
        const name = parts[0].trim();
        const val = parseFloat(parts[1].replace(/\s/g,'').replace(',','.'));
        const qty = parts[2] ? parseFloat(parts[2].replace(/\s/g,'').replace(',','.')) : 1; 
        
        if(name && !isNaN(val)) abcData.push({ name, val, qty });
    });

    // 1. ABC Analysis (by Revenue)
    const totalRev = abcData.reduce((s,d) => s+d.val, 0);
    abcData.sort((a,b) => b.val - a.val);
    
    let cumPct = 0;
    abcData.forEach(d => {
        cumPct += (d.val / totalRev);
        const pct = (d.val / totalRev) * 100;
        // ABC Logic
        if(cumPct <= 0.80) d.abc = 'A';
        else if(cumPct <= 0.95) d.abc = 'B';
        else d.abc = 'C';
        
        // XYZ Logic (Variability proxy using qty if available, else random walk sim)
        // Simple XYZ for now: High qty = X, Low qty = Z
        if(d.qty > 50) d.xyz = 'X'; // Stable
        else if(d.qty > 10) d.xyz = 'Y'; // Variable
        else d.xyz = 'Z'; // Chaotic
        
        d.matrix = d.abc + d.xyz;
    });

    renderABC();
}

function renderABC() {
    document.getElementById('abcResults').style.display = 'block';
    
    // Render Matrix Grid
    const matrices = ['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ'];
    const matrixColors = {
        'A': 'var(--accent)', 'B': 'var(--blue)', 'C': 'var(--text2)',
        'X': 'rgba(66,255,176,0.2)', 'Y': 'rgba(255,140,66,0.2)', 'Z': 'rgba(255,71,87,0.2)'
    };

    const gridHtml = matrices.map(m => {
        const items = abcData.filter(d => d.matrix === m);
        const count = items.length;
        const color = matrixColors[m[0]]; // Base color on ABC
        return `
            <div class="matrix-cell" style="border: 1px solid ${color}">
                <div class="matrix-label" style="color:${color}">${m}</div>
                <div style="font-size:12px">${count} позиций</div>
                <div style="font-size:10px;color:var(--text3)">${items.reduce((s,d)=>s+d.val,0).toLocaleString()} ₽</div>
            </div>
        `;
    }).join('');

    document.getElementById('abcMatrixViz').innerHTML = gridHtml;

    // Render Table
    const tbody = abcData.map(d => `
        <tr>
            <td>${d.name}</td>
            <td>${fmt(d.val)} ₽</td>
            <td>${d.qty} шт</td>
            <td><span class="badge badge-${d.abc.toLowerCase()}">${d.abc}</span></td>
            <td>${d.xyz}</td>
            <td><strong>${d.matrix}</strong></td>
        </tr>
    `).join('');

    document.getElementById('abcTable').innerHTML = `<thead><tr><th>Товар</th><th>Выручка</th><th>Кол-во</th><th>ABC</th><th>XYZ</th><th>Матрица</th></tr></thead><tbody>${tbody}</tbody>`;
}

// ════════════════════════════════════════════
//  02 — COMPETITOR INTELLIGENCE (New Logic)
// ════════════════════════════════════════════

async function runIntel() {
    const url = document.getElementById('compUrl').value.trim();
    if(!url) return;

    const loading = document.getElementById('intelLoading');
    loading.style.display = 'flex';
    document.getElementById('intelResults').style.display = 'none';

    const setStatus = t => {}; // internal silent

    try {
        const html = await getHtml(url, setStatus);
        if(!html) throw new Error("Не удалось загрузить страницу");

        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        // 1. Extract Name
        let name = doc.querySelector('title')?.textContent?.split('|')[0].split('-')[0].trim() || url;
        document.getElementById('intelName').textContent = name;

        // 2. Find INN (Russian Tax ID)
        // Regex search in text
        const innMatch = html.match(/\b(\d{10}|\d{12})\b/); 
        let inn = innMatch ? innMatch[1] : null;
        
        let legalHtml = '<div class="text2">ИНН не найден на главной странице</div>';
        let financeHtml = '<div class="text2">Требуется ИНН</div>';
        let hrHtml = '<div class="text2">—</div>';

        if(inn) {
            // Generate links to external aggregator data
            legalHtml = `
                <div style="font-size:18px;font-weight:700;color:var(--green)">${inn}</div>
                <a href="https://www.list-org.com/search?type=inn&val=${inn}" target="_blank" class="intel-detail-link">List-Org (История, суды)</a><br>
                <a href="https://rusprofile.ru/search?query=${inn}" target="_blank" class="intel-detail-link">Rusprofile (Выручка)</a>
            `;
            
            financeHtml = `
                <div style="font-size:13px;color:var(--text2)">Проверьте финансовые показатели по ссылке выше.</div>
                <div style="margin-top:8px;font-size:11px">*Обычно выручка доступна за прошлый год в открытом доступе</div>
            `;

            hrHtml = `
                <a href="https://hh.ru/employer/-find-employer?text=${inn}" target="_blank" class="intel-detail-link">Отзывы сотрудников (HH)</a>
            `;
        }

        document.getElementById('intelLegal').innerHTML = legalHtml;
        document.getElementById('intelFinance').innerHTML = financeHtml;
        document.getElementById('intelHR').innerHTML = hrHtml;

        // 3. Market Share (Hypothetical calculation based on H1/H2 density)
        const headings = doc.querySelectorAll('h1, h2').length;
        const images = doc.querySelectorAll('img').length;
        const seoScore = headings * 2 + images; // Dummy metric
        const marketShare = Math.min(20, (seoScore / 10)).toFixed(1); // Cap at 20% for demo
        
        document.getElementById('intelMarket').innerHTML = `
            <div style="font-size:24px;font-weight:700">${marketShare}%</div>
            <div style="font-size:11px;color:var(--text2)">Оценка SEO-видимости (условная)</div>
        `;

        // 4. Tech Stack
        const techs = [];
        if(html.includes('ga(') || html.includes('gtag(')) techs.push('Google Analytics');
        if(html.includes('ym(') || html.includes('yaCounter')) techs.push('Яндекс.Метрика');
        if(html.includes('jquery')) techs.push('jQuery');
        if(html.includes('react')) techs.push('React');
        if(html.includes('bitrix')) techs.push('1С-Битрикс');
        
        document.getElementById('intelTech').innerHTML = techs.length 
            ? techs.map(t => `<span class="tech-tag">${t}</span>`).join('') 
            : '<span class="text2">Стек не определен</span>';

        document.getElementById('intelResults').style.display = 'block';

    } catch(e) {
        alert("Ошибка анализа: " + e.message);
    }
    loading.style.display = 'none';
}

// ════════════════════════════════════════════
//  03 — MEDIA PLAN PRO (With Coefficients)
// ════════════════════════════════════════════

function initMedia() {
    mediaChannels = [
        { name: 'Яндекс.Директ', budget: 40, baseCpl: 800 },
        { name: 'ВК Реклама', budget: 30, baseCpl: 350 },
        { name: 'SEO', budget: 30, baseCpl: 0 },
    ];
    renderMediaChannels();
    calcMedia();
}

function renderMediaChannels() {
    document.getElementById('mediaChannels').innerHTML = mediaChannels.map((ch, i) => `
        <div class="channel-row">
            <input value="${ch.name}" oninput="mediaChannels[${i}].name=this.value;calcMedia()">
            <input type="number" value="${ch.budget}" oninput="mediaChannels[${i}].budget=+this.value;calcMedia()">
            <span style="color:var(--text3)">%</span>
        </div>
    `).join('');
}

function calcMedia() {
    const totalBudget = +document.getElementById('mediaBudget').value || 0;
    const regionCoeff = +document.getElementById('mediaRegion').value; // 1, 0.8, 0.6
    const seasonCoeff = +document.getElementById('mediaSeason').value; // 1.3, 1, 0.7
    const nicheCoeff  = +document.getElementById('mediaNiche').value;  // 1.2, 1.5 etc

    const totalPct = mediaChannels.reduce((s, c) => s + c.budget, 0) || 1;
    let totalLeads = 0;

    const rows = mediaChannels.map(ch => {
        const spend = (ch.budget / totalPct) * totalBudget;
        // CPL Formula: Base * Region * Season * Niche
        const realCpl = ch.baseCpl > 0 ? (ch.baseCpl * regionCoeff * seasonCoeff * nicheCoeff) : 0;
        const leads = realCpl > 0 ? Math.round(spend / realCpl) : Math.round(spend / 1000); // Fallback for SEO
        
        totalLeads += leads;
        return {
            name: ch.name,
            spend: Math.round(spend),
            cpl: Math.round(realCpl),
            leads
        };
    });

    // Render Summary
    document.getElementById('mediaSummary').innerHTML = `
        <div class="media-kpi"><div class="media-kpi-val">${fmt(totalBudget)} ₽</div><div class="media-kpi-label">Бюджет</div></div>
        <div class="media-kpi"><div class="media-kpi-val">${fmt(totalLeads)}</div><div class="media-kpi-label">Лидов (прогноз)</div></div>
        <div class="media-kpi"><div class="media-kpi-val">${fmt(totalBudget / totalLeads)} ₽</div><div class="media-kpi-label">Средний CPL</div></div>
        <div class="media-kpi"><div class="media-kpi-val">${(regionCoeff * seasonCoeff).toFixed(1)}x</div><div class="media-kpi-label">Поправка рынка</div></div>
    `;

    // Render Table
    document.getElementById('mediaTable').innerHTML = `
        <thead><tr><th>Канал</th><th>Бюджет</th><th>CPL (с поправкой)</th><th>Лиды</th></tr></thead>
        <tbody>
            ${rows.map(r => `
                <tr>
                    <td>${r.name}</td>
                    <td>${fmt(r.spend)} ₽</td>
                    <td>${r.cpl > 0 ? fmt(r.cpl) + ' ₽' : 'Органика'}</td>
                    <td style="color:var(--accent);font-weight:700">${fmt(r.leads)}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
}

// ════════════════════════════════════════════
//  04 — PRODUCT ANALYSIS (Comparison)
// ════════════════════════════════════════════

let allProducts = [];
async function parseProducts() {
    const url = document.getElementById('productUrl').value;
    if(!url) return;
    
    // Use same logic as Intel to fetch, but simpler parsing
    const html = await getHtml(url, s=>{});
    if(!html) return alert("Не удалось загрузить");

    // Fake extraction for demo (In reality use regex/dom parser)
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('h3, .product-title, .card-title'); // Heuristics
    
    if(items.length === 0) return alert("Товары не найдены (попробуйте прямой URL каталога)");
    
    allProducts = Array.from(items).slice(0, 20).map(el => ({
        name: el.textContent.trim(),
        price: (Math.random() * 5000 + 1000).toFixed(0), // Demo price
        source: new URL(url).hostname
    }));

    renderProducts();
}

function renderProducts() {
    if(!allProducts.length) return;
    document.getElementById('productResults').style.display = 'block';
    
    // Calculate Market Price
    const avgPrice = allProducts.reduce((s,p) => s + +p.price, 0) / allProducts.length;

    document.getElementById('productStats').innerHTML = `
        <div class="prod-stat"><div class="prod-stat-val">${allProducts.length}</div><div class="prod-stat-label">Товаров</div></div>
        <div class="prod-stat"><div class="prod-stat-val">${fmt(avgPrice)} ₽</div><div class="prod-stat-label">Средняя цена</div></div>
    `;

    document.getElementById('productTable').innerHTML = `
        <thead><tr><th>Товар</th><th>Цена</th><th>Отклонение от средней</th></tr></thead>
        <tbody>
            ${allProducts.map(p => {
                const diff = ((p.price - avgPrice) / avgPrice * 100).toFixed(0);
                const color = diff > 0 ? 'var(--red)' : 'var(--green)';
                return `<tr>
                    <td>${p.name.slice(0, 60)}</td>
                    <td>${p.price} ₽</td>
                    <td style="color:${diff > 20 ? color : 'var(--text2)'}">${diff > 0 ? '+' : ''}${diff}%</td>
                </tr>`;
            }).join('')}
        </tbody>
    `;
}

// Init
initMedia();
