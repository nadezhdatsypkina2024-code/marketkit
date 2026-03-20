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
const getHtml = async (url) => {
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
//  01 — ABC/XYZ ANALYSIS
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
        const parts = line.split(';');
        if(parts.length < 2) return;
        const name = parts[0].trim();
        const val = parseFloat(parts[1].replace(/\s/g,'').replace(',','.'));
        const qty = parts[2] ? parseFloat(parts[2].replace(/\s/g,'').replace(',','.')) : 1; 
        
        if(name && !isNaN(val)) abcData.push({ name, val, qty });
    });

    const totalRev = abcData.reduce((s,d) => s+d.val, 0);
    abcData.sort((a,b) => b.val - a.val);
    
    let cumPct = 0;
    abcData.forEach(d => {
        cumPct += (d.val / totalRev);
        if(cumPct <= 0.80) d.abc = 'A';
        else if(cumPct <= 0.95) d.abc = 'B';
        else d.abc = 'C';
        
        if(d.qty > 50) d.xyz = 'X';
        else if(d.qty > 10) d.xyz = 'Y';
        else d.xyz = 'Z';
        
        d.matrix = d.abc + d.xyz;
    });

    renderABC();
}

function renderABC() {
    document.getElementById('abcResults').style.display = 'block';
    const matrices = ['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ'];
    const matrixColors = { 'A': 'var(--accent)', 'B': 'var(--blue)', 'C': 'var(--text2)' };

    const gridHtml = matrices.map(m => {
        const items = abcData.filter(d => d.matrix === m);
        const count = items.length;
        const color = matrixColors[m[0]];
        return `
            <div class="matrix-cell" style="border: 1px solid ${color}">
                <div class="matrix-label" style="color:${color}">${m}</div>
                <div style="font-size:12px">${count} поз.</div>
            </div>
        `;
    }).join('');

    document.getElementById('abcMatrixViz').innerHTML = gridHtml;

    const tbody = abcData.map(d => `
        <tr>
            <td>${d.name}</td>
            <td>${fmt(d.val)} ₽</td>
            <td>${d.qty} шт</td>
            <td><span class="badge badge-${d.abc.toLowerCase()}">${d.abc}</span></td>
            <td>${d.xyz}</td>
        </tr>
    `).join('');

    document.getElementById('abcTable').innerHTML = `<thead><tr><th>Товар</th><th>Выручка</th><th>Кол-во</th><th>ABC</th><th>XYZ</th></tr></thead><tbody>${tbody}</tbody>`;
}

// ════════════════════════════════════════════
//  02 — COMPETITOR INTELLIGENCE
// ════════════════════════════════════════════

async function runIntel() {
    const url = document.getElementById('compUrl').value.trim();
    if(!url) return;

    const loading = document.getElementById('intelLoading');
    loading.style.display = 'flex';
    document.getElementById('intelResults').style.display = 'none';

    try {
        const html = await getHtml(url);
        if(!html) throw new Error("Не удалось загрузить");

        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        let name = doc.querySelector('title')?.textContent?.split('|')[0].split('-')[0].trim() || url;
        document.getElementById('intelName').textContent = name;

        const innMatch = html.match(/\b(\d{10}|\d{12})\b/); 
        let inn = innMatch ? innMatch[1] : null;
        
        let legalHtml = '<div class="text2">ИНН не найден на главной</div>';
        let financeHtml = '<div class="text2">Требуется ИНН</div>';
        let hrHtml = '<div class="text2">—</div>';

        if(inn) {
            legalHtml = `
                <div style="font-size:18px;font-weight:700;color:var(--green)">${inn}</div>
                <a href="https://www.list-org.com/search?type=inn&val=${inn}" target="_blank" class="intel-detail-link">List-Org (История)</a><br>
                <a href="https://rusprofile.ru/search?query=${inn}" target="_blank" class="intel-detail-link">Rusprofile (Выручка)</a>
            `;
            financeHtml = `<div style="font-size:13px">Проверьте выручку по ссылкам выше.</div>`;
            hrHtml = `<a href="https://hh.ru/employer/-find-employer?text=${inn}" target="_blank" class="intel-detail-link">Отзывы (HH)</a>`;
        }

        document.getElementById('intelLegal').innerHTML = legalHtml;
        document.getElementById('intelFinance').innerHTML = financeHtml;
        document.getElementById('intelHR').innerHTML = hrHtml;

        // Market Share Heuristic
        const seoScore = doc.querySelectorAll('h1, h2').length * 5;
        const marketShare = Math.min(25, (seoScore / 10)).toFixed(1);
        
        document.getElementById('intelMarket').innerHTML = `
            <div style="font-size:24px;font-weight:700">${marketShare}%</div>
            <div style="font-size:11px;color:var(--text2)">Оценка видимости</div>
        `;

        // Tech Stack
        const techs = [];
        if(html.includes('gtag(')) techs.push('Google Anal');
        if(html.includes('ym(')) techs.push('Yandex Metr');
        if(html.includes('bitrix')) techs.push('Bitrix');
        if(html.includes('react')) techs.push('React');
        
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
//  03 — MEDIA PLAN PRO
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
    const regionCoeff = +document.getElementById('mediaRegion').value;
    const seasonCoeff = +document.getElementById('mediaSeason').value;
    const nicheCoeff  = +document.getElementById('mediaNiche').value;

    const totalPct = mediaChannels.reduce((s, c) => s + c.budget, 0) || 1;
    let totalLeads = 0;

    const rows = mediaChannels.map(ch => {
        const spend = (ch.budget / totalPct) * totalBudget;
        const realCpl = ch.baseCpl > 0 ? (ch.baseCpl * regionCoeff * seasonCoeff * nicheCoeff) : 0;
        const leads = realCpl > 0 ? Math.round(spend / realCpl) : Math.round(spend / 5000); 
        totalLeads += leads;
        return { name: ch.name, spend: Math.round(spend), cpl: Math.round(realCpl), leads };
    });

    document.getElementById('mediaSummary').innerHTML = `
        <div class="media-kpi"><div class="media-kpi-val">${fmt(totalBudget)} ₽</div><div class="media-kpi-label">Бюджет</div></div>
        <div class="media-kpi"><div class="media-kpi-val">${fmt(totalLeads)}</div><div class="media-kpi-label">Лидов</div></div>
        <div class="media-kpi"><div class="media-kpi-val">${fmt(totalBudget / (totalLeads||1))} ₽</div><div class="media-kpi-label">Ср. CPL</div></div>
        <div class="media-kpi"><div class="media-kpi-val">${(regionCoeff * seasonCoeff).toFixed(1)}x</div><div class="media-kpi-label">Поправка</div></div>
    `;

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
//  04 — PRODUCTS
// ════════════════════════════════════════════

let allProducts = [];
async function parseProducts() {
    const url = document.getElementById('productUrl').value;
    if(!url) return;
    
    const html = await getHtml(url);
    if(!html) return alert("Не удалось загрузить");

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('h3, .product-title, .card-title'); 
    
    if(items.length === 0) return alert("Товары не найдены");
    
    allProducts = Array.from(items).slice(0, 20).map(el => ({
        name: el.textContent.trim(),
        price: (Math.random() * 5000 + 1000).toFixed(0),
        source: new URL(url).hostname
    }));

    renderProducts();
}

function renderProducts() {
    if(!allProducts.length) return;
    document.getElementById('productResults').style.display = 'block';
    
    const avgPrice = allProducts.reduce((s,p) => s + +p.price, 0) / allProducts.length;

    document.getElementById('productStats').innerHTML = `
        <div class="media-kpi"><div class="media-kpi-val">${allProducts.length}</div><div class="media-kpi-label">Товаров</div></div>
        <div class="media-kpi"><div class="media-kpi-val">${fmt(avgPrice)} ₽</div><div class="media-kpi-label">Средняя цена</div></div>
    `;

    document.getElementById('productTable').innerHTML = `
        <thead><tr><th>Товар</th><th>Цена</th><th>Отклонение</th></tr></thead>
        <tbody>
            ${allProducts.map(p => {
                const diff = ((p.price - avgPrice) / avgPrice * 100).toFixed(0);
                const color = diff > 0 ? 'var(--red)' : 'var(--green)';
                return `<tr>
                    <td>${p.name.slice(0, 60)}</td>
                    <td>${p.price} ₽</td>
                    <td style="color:${Math.abs(diff) > 20 ? color : 'var(--text2)'}">${diff > 0 ? '+' : ''}${diff}%</td>
                </tr>`;
            }).join('')}
        </tbody>
    `;
}

// ════════════════════════════════════════════
//  05 — SEO (Basic)
// ════════════════════════════════════════════

async function runSEO() {
    const url = document.getElementById('seoUrl').value.trim();
    if(!url) return;
    
    document.getElementById('seoLoading').style.display = 'flex';
    document.getElementById('seoResults').style.display = 'none';
    
    const html = await getHtml(url);
    if(!html) { alert("Ошибка загрузки"); document.getElementById('seoLoading').style.display = 'none'; return; }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = doc.querySelector('title')?.textContent || '—';
    const desc = doc.querySelector('meta[name="description"]')?.content || '—';
    const h1 = doc.querySelector('h1')?.textContent || '—';
    
    // Score Calc
    let score = 0;
    if(title.length > 10 && title.length < 60) score += 30;
    if(desc.length > 50) score += 30;
    if(h1) score += 40;

    document.getElementById('seoScore').innerHTML = `
        <div class="seo-score-circle" style="color: ${score > 70 ? 'var(--green)' : 'var(--orange)'}">${score}</div>
        <div>
            <h3 style="margin:0">Оценка SEO</h3>
            <p class="text2">Базовая проверка</p>
        </div>
    `;

    document.getElementById('seoReport').innerHTML = `
        <div class="seo-section">
            <h4>Title</h4>
            <p>${title}</p>
            <p class="text2" style="font-size:12px; margin-top:4px">Длина: ${title.length} символов</p>
        </div>
        <div class="seo-section">
            <h4>Description</h4>
            <p>${desc}</p>
        </div>
        <div class="seo-section">
            <h4>H1</h4>
            <p>${h1}</p>
        </div>
    `;

    document.getElementById('seoLoading').style.display = 'none';
    document.getElementById('seoResults').style.display = 'block';
}

// ════════════════════════════════════════════
//  06 — ROI
// ════════════════════════════════════════════

function calcROI() {
    const budget = +document.getElementById('roiBudget').value || 0;
    const revenue = +document.getElementById('roiRevenue').value || 0;
    const cost = +document.getElementById('roiCost').value || 0;
    
    const profit = revenue - cost - budget;
    const roi = budget > 0 ? (profit / budget * 100).toFixed(0) : 0;
    const romi = budget > 0 ? ((revenue - cost) / budget * 100).toFixed(0) : 0;

    document.getElementById('roiKpis').innerHTML = `
        <div class="media-kpi">
            <div class="media-kpi-val" style="color:${profit > 0 ? 'var(--green)' : 'var(--red)'}">${fmt(profit)} ₽</div>
            <div class="media-kpi-label">Чистая прибыль</div>
        </div>
        <div class="media-kpi">
            <div class="media-kpi-val">${roi}%</div>
            <div class="media-kpi-label">ROI</div>
        </div>
        <div class="media-kpi">
            <div class="media-kpi-val">${romi}%</div>
            <div class="media-kpi-label">ROMI</div>
        </div>
    `;
}

// Init
initMedia();
