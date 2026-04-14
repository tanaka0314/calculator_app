import { parse, calc } from './parser.js';
import {
  saveEntry, getPatternHistory,
  deleteEntry, clearPatternHistory, getStats,
} from './history.js';

const STORAGE_KEY = 'keisan.patterns';

const SAMPLES = [
  { id: 's1', name: '消費税込み価格', formula: '税抜価格 * (1 + 税率 / 100)' },
  { id: 's2', name: '割引後価格',     formula: '定価 * (1 - 割引率 / 100)' },
  { id: 's3', name: '3つの平均',      formula: '(a + b + c) / 3' },
  { id: 's4', name: '長方形の面積',   formula: '幅 * 高さ' },
  { id: 's5', name: '速さ × 時間',    formula: '速さ * 時間' },
];

// ── State ────────────────────────────────────────────────────────────────────
let patterns  = [];
let selectedId  = null;
let editingId   = null;
let currentAst  = null;
let currentVars = [];   // 現在表示中の変数名リスト

// ── Persistence ──────────────────────────────────────────────────────────────
function loadPatterns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { patterns = JSON.parse(raw); return; }
  } catch (_) {}
  patterns = SAMPLES.map(s => ({ ...s }));
  savePatterns();
}

function savePatterns() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
}

function genId() {
  return 'p' + Date.now() + Math.random().toString(36).slice(2, 6);
}

// ── DOM refs ─────────────────────────────────────────────────────────────────
const listEl         = document.getElementById('pattern-list');
const detailEl       = document.getElementById('detail');
const emptyMsg       = document.getElementById('empty-msg');
const calcPanel      = document.getElementById('calc-panel');
const editPanel      = document.getElementById('edit-panel');
const historyPanel   = document.getElementById('history-panel');
const btnNewTop      = document.getElementById('btn-new-top');
const btnNewBottom   = document.getElementById('btn-new-bottom');

// calc-panel
const cpTitle        = document.getElementById('cp-title');
const cpFormula      = document.getElementById('cp-formula');
const cpVarsArea     = document.getElementById('cp-vars');
const cpResult       = document.getElementById('cp-result');
const btnEdit        = document.getElementById('btn-edit');
const btnDelete      = document.getElementById('btn-delete');
const btnHistory     = document.getElementById('btn-history');
const btnRecord      = document.getElementById('btn-record');

// edit-panel
const editTitle      = document.getElementById('edit-title');
const epName         = document.getElementById('ep-name');
const epFormula      = document.getElementById('ep-formula');
const epVarsPreview  = document.getElementById('ep-vars-preview');
const epError        = document.getElementById('ep-error');
const btnSave        = document.getElementById('btn-save');
const btnCancel      = document.getElementById('btn-cancel');

// history-panel
const hpTitle        = document.getElementById('hp-title');
const hpStats        = document.getElementById('hp-stats');
const hpChart        = document.getElementById('hp-chart');
const hpTable        = document.getElementById('hp-table');
const btnBackToCalc  = document.getElementById('btn-back-to-calc');
const btnClearHist   = document.getElementById('btn-clear-hist');

// ── Helpers ───────────────────────────────────────────────────────────────────
function hideAll() {
  emptyMsg.hidden  = true;
  calcPanel.hidden = true;
  editPanel.hidden = true;
  if (historyPanel) historyPanel.hidden = true;
}

function showEmpty() {
  hideAll();
  emptyMsg.hidden = false;
}

// ── Render list ───────────────────────────────────────────────────────────────
function renderList() {
  listEl.innerHTML = '';
  patterns.forEach(p => {
    const li = document.createElement('li');
    li.dataset.id = p.id;
    if (p.id === selectedId) li.classList.add('active');
    li.textContent = p.name;
    li.addEventListener('click', () => selectPattern(p.id));
    listEl.appendChild(li);
  });
}

// ── Calc panel ────────────────────────────────────────────────────────────────
function selectPattern(id) {
  selectedId = id;
  editingId = null;
  renderList();
  showCalcPanel();
}

function showCalcPanel() {
  const p = patterns.find(x => x.id === selectedId);
  if (!p) { showEmpty(); return; }

  hideAll();
  calcPanel.hidden = false;

  cpTitle.textContent   = p.name;
  cpFormula.textContent = p.formula;

  let ast, variables;
  try {
    ({ ast, variables } = parse(p.formula));
  } catch (e) {
    cpVarsArea.innerHTML = `<p class="error">式が不正です: ${e.message}</p>`;
    cpResult.textContent = '—';
    setRecordBtn(false);
    return;
  }

  currentAst  = ast;
  currentVars = variables;

  // 変数入力欄を生成（値は保持）
  const prevValues = {};
  cpVarsArea.querySelectorAll('input[data-var]').forEach(el => {
    prevValues[el.dataset.var] = el.value;
  });

  cpVarsArea.innerHTML = '';
  if (variables.length === 0) {
    try {
      const result = calc(ast, {});
      cpResult.textContent = formatNum(result);
      setRecordBtn(result !== null);
    } catch (e) {
      cpResult.textContent = `エラー: ${e.message}`;
      setRecordBtn(false);
    }
    return;
  }

  variables.forEach(name => {
    const row = document.createElement('div');
    row.className = 'var-row';

    const label = document.createElement('label');
    label.textContent = name;
    label.htmlFor = `var-${name}`;

    const input = document.createElement('input');
    input.type = 'number';
    input.id = `var-${name}`;
    input.dataset.var = name;
    input.placeholder = '数値を入力';
    input.value = prevValues[name] ?? '';

    input.addEventListener('input', () => recalc(ast, variables));
    row.appendChild(label);
    row.appendChild(input);
    cpVarsArea.appendChild(row);
  });

  recalc(ast, variables);
}

function recalc(ast, variables) {
  const vars = {};
  variables.forEach(name => {
    const el = document.getElementById(`var-${name}`);
    vars[name] = el ? el.value : '';
  });
  try {
    const result = calc(ast, vars);
    cpResult.textContent = result === null ? '—' : formatNum(result);
    setRecordBtn(result !== null);
  } catch (e) {
    cpResult.textContent = `エラー: ${e.message}`;
    setRecordBtn(false);
  }
}

function setRecordBtn(enabled) {
  if (!btnRecord) return;
  btnRecord.disabled = !enabled;
  btnRecord.style.opacity = enabled ? '1' : '0.35';
}

// ── Record button ─────────────────────────────────────────────────────────────
btnRecord.addEventListener('click', () => {
  const p = patterns.find(x => x.id === selectedId);
  if (!p || !currentAst) return;

  const resultText = cpResult.textContent;
  if (!resultText || resultText === '—' || resultText.startsWith('エラー')) return;

  // 現在の変数値を収集
  const vars = {};
  currentVars.forEach(name => {
    const el = document.getElementById(`var-${name}`);
    vars[name] = el ? Number(el.value) : 0;
  });

  // 数値変換（カンマ除去）
  const resultNum = parseFloat(resultText.replace(/,/g, ''));

  saveEntry({
    patternId: p.id,
    patternName: p.name,
    variables: vars,
    result: resultNum,
  });

  // フィードバック
  const orig = btnRecord.textContent;
  btnRecord.textContent = '記録しました ✓';
  btnRecord.style.color = 'var(--accent)';
  setTimeout(() => {
    btnRecord.textContent = orig;
    btnRecord.style.color = '';
  }, 1600);
});

// ── History panel ─────────────────────────────────────────────────────────────
btnHistory.addEventListener('click', () => {
  if (selectedId) showHistoryPanel();
});

btnBackToCalc.addEventListener('click', () => showCalcPanel());

btnClearHist.addEventListener('click', () => {
  const p = patterns.find(x => x.id === selectedId);
  if (!p) return;
  if (!confirm(`「${p.name}」の履歴をすべて削除しますか？`)) return;
  clearPatternHistory(selectedId);
  showHistoryPanel();
});

function showHistoryPanel() {
  const p = patterns.find(x => x.id === selectedId);
  if (!p) return;

  hideAll();
  historyPanel.hidden = false;

  hpTitle.textContent = p.name;

  const entries = getPatternHistory(selectedId);
  const stats   = getStats(entries);

  renderStats(stats, entries.length);
  renderChart(entries);
  renderTable(entries);
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats(stats, count) {
  if (!stats) {
    hpStats.innerHTML = `
      <p class="no-data">まだ記録がありません。<br>計算画面の「記録する」ボタンで保存してください。</p>`;
    return;
  }
  hpStats.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">記録件数</div>
      <div class="stat-value">${stats.count}<span class="stat-unit">件</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">平均</div>
      <div class="stat-value">${formatNum(stats.avg)}</div>
    </div>
    <div class="stat-card accent">
      <div class="stat-label">最大値</div>
      <div class="stat-value">${formatNum(stats.max)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">最小値</div>
      <div class="stat-value">${formatNum(stats.min)}</div>
    </div>
  `;
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function renderChart(entries) {
  // 時系列順にソート（古い→新しい）して最新20件
  const sorted = [...entries]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-20);

  const valid = sorted.filter(e => typeof e.result === 'number' && isFinite(e.result));

  if (valid.length < 2) {
    hpChart.innerHTML = `<p class="no-data chart-no-data">グラフには2件以上の記録が必要です</p>`;
    return;
  }

  const maxAbs = Math.max(...valid.map(e => Math.abs(e.result)));
  if (maxAbs === 0) { hpChart.innerHTML = ''; return; }

  const hasNeg = valid.some(e => e.result < 0);
  const hasPos = valid.some(e => e.result > 0);
  const mixed  = hasNeg && hasPos;

  const bars = valid.map((e, i) => {
    const pct      = (Math.abs(e.result) / maxAbs * 100).toFixed(1);
    const isNeg    = e.result < 0;
    const dateStr  = formatDateShort(e.timestamp);
    return `
      <div class="chart-col" title="${dateStr}: ${formatNum(e.result)}">
        <div class="chart-bar-wrap ${mixed ? 'mixed' : ''}">
          <div class="chart-bar ${isNeg ? 'neg' : ''}"
               style="${mixed && !isNeg ? 'align-self:flex-end;' : ''}height:${pct}%">
          </div>
        </div>
        <div class="chart-xlbl">${i + 1}</div>
      </div>`;
  }).join('');

  hpChart.innerHTML = `
    <div class="chart-header">
      <span class="block-label">推移グラフ</span>
      <span class="chart-hint">直近 ${valid.length} 件 · バーにカーソルで詳細</span>
    </div>
    <div class="chart-bars">${bars}</div>`;
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(entries) {
  if (entries.length === 0) {
    hpTable.innerHTML = '';
    return;
  }

  const recent   = entries.slice(0, 50);   // getPatternHistory は新しい順
  const varNames = Object.keys(recent[0]?.variables || {});

  const headerCells = varNames.map(v => `<th>${v}</th>`).join('');
  const rows = recent.map(e => {
    const varCells = varNames.map(v =>
      `<td class="td-num">${formatNum(Number(e.variables[v] ?? ''))}</td>`
    ).join('');
    return `
      <tr>
        <td class="td-date">${formatDate(e.timestamp)}</td>
        ${varCells}
        <td class="td-result">${formatNum(e.result)}</td>
        <td><button class="btn-del-entry" data-id="${e.id}" title="削除">×</button></td>
      </tr>`;
  }).join('');

  hpTable.innerHTML = `
    <thead>
      <tr>
        <th>日時</th>
        ${headerCells}
        <th>結果</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;

  hpTable.querySelectorAll('.btn-del-entry').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteEntry(btn.dataset.id);
      showHistoryPanel();
    });
  });
}

// ── Edit panel ────────────────────────────────────────────────────────────────
function openEditPanel(id) {
  editingId  = id;
  selectedId = id;
  renderList();

  const p = id ? patterns.find(x => x.id === id) : null;
  editTitle.textContent = p ? 'パターンを編集' : '新しいパターンを追加';
  epName.value    = p ? p.name    : '';
  epFormula.value = p ? p.formula : '';
  epError.textContent = '';
  epError.hidden = true;

  hideAll();
  editPanel.hidden = false;

  updateVarsPreview();
  epName.focus();
}

function updateVarsPreview() {
  const formula = epFormula.value.trim();
  if (!formula) { epVarsPreview.textContent = ''; return; }
  try {
    const { variables } = parse(formula);
    epVarsPreview.textContent = variables.length
      ? `変数: ${variables.join(', ')}`
      : '変数なし (定数計算)';
    epError.hidden = true;
  } catch (e) {
    epVarsPreview.textContent = '';
    epError.textContent = `式エラー: ${e.message}`;
    epError.hidden = false;
  }
}

epFormula.addEventListener('input', updateVarsPreview);

btnSave.addEventListener('click', () => {
  const name    = epName.value.trim();
  const formula = epFormula.value.trim();

  if (!name) {
    epError.textContent = 'パターン名を入力してください';
    epError.hidden = false; epName.focus(); return;
  }
  if (!formula) {
    epError.textContent = '数式を入力してください';
    epError.hidden = false; epFormula.focus(); return;
  }
  try { parse(formula); } catch (e) {
    epError.textContent = `式エラー: ${e.message}`;
    epError.hidden = false; return;
  }

  if (editingId) {
    const p = patterns.find(x => x.id === editingId);
    if (p) { p.name = name; p.formula = formula; }
    selectedId = editingId;
  } else {
    const newP = { id: genId(), name, formula };
    patterns.push(newP);
    selectedId = newP.id;
  }

  editingId = null;
  savePatterns();
  renderList();
  showCalcPanel();
});

btnCancel.addEventListener('click', () => {
  editingId = null;
  if (selectedId) showCalcPanel(); else showEmpty();
});

btnEdit.addEventListener('click', () => { if (selectedId) openEditPanel(selectedId); });

btnDelete.addEventListener('click', () => {
  if (!selectedId) return;
  const p = patterns.find(x => x.id === selectedId);
  if (!p) return;
  if (!confirm(`「${p.name}」を削除しますか？`)) return;
  patterns = patterns.filter(x => x.id !== selectedId);
  selectedId = patterns.length ? patterns[patterns.length - 1].id : null;
  savePatterns();
  renderList();
  if (selectedId) showCalcPanel(); else showEmpty();
});

btnNewTop.addEventListener('click', () => openEditPanel(null));
btnNewBottom.addEventListener('click', () => openEditPanel(null));

// ── Format helpers ────────────────────────────────────────────────────────────
function formatNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (Number.isInteger(n)) return n.toLocaleString('ja-JP');
  const s = parseFloat(n.toPrecision(10));
  return s.toLocaleString('ja-JP', { maximumFractionDigits: 10 });
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} `
       + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateShort(ts) {
  const d = new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ── Init ──────────────────────────────────────────────────────────────────────
loadPatterns();
renderList();

if (patterns.length > 0) {
  selectedId = patterns[0].id;
  renderList();
  showCalcPanel();
} else {
  showEmpty();
}
