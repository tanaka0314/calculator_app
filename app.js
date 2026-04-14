import { parse, calc } from './parser.js';

const STORAGE_KEY = 'keisan.patterns';

const SAMPLES = [
  { id: 's1', name: '消費税込み価格', formula: '税抜価格 * (1 + 税率 / 100)' },
  { id: 's2', name: '割引後価格',     formula: '定価 * (1 - 割引率 / 100)' },
  { id: 's3', name: '3つの平均',      formula: '(a + b + c) / 3' },
  { id: 's4', name: '長方形の面積',   formula: '幅 * 高さ' },
  { id: 's5', name: '速さ × 時間',    formula: '速さ * 時間' },
];

// ── State ────────────────────────────────────────────────────────────────────
let patterns = [];
let selectedId = null;
let editingId = null;   // null = 新規, id = 既存編集

// ── Persistence ──────────────────────────────────────────────────────────────
function loadPatterns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      patterns = JSON.parse(raw);
      return;
    }
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
const listEl        = document.getElementById('pattern-list');
const detailEl      = document.getElementById('detail');
const emptyMsg      = document.getElementById('empty-msg');
const calcPanel     = document.getElementById('calc-panel');
const editPanel     = document.getElementById('edit-panel');
const btnNewTop     = document.getElementById('btn-new-top');
const btnNewBottom  = document.getElementById('btn-new-bottom');

// calc-panel refs
const cpTitle       = document.getElementById('cp-title');
const cpFormula     = document.getElementById('cp-formula');
const cpVarsArea    = document.getElementById('cp-vars');
const cpResult      = document.getElementById('cp-result');
const btnEdit       = document.getElementById('btn-edit');
const btnDelete     = document.getElementById('btn-delete');

// edit-panel refs
const editTitle     = document.getElementById('edit-title');
const epName        = document.getElementById('ep-name');
const epFormula     = document.getElementById('ep-formula');
const epVarsPreview = document.getElementById('ep-vars-preview');
const epError       = document.getElementById('ep-error');
const btnSave       = document.getElementById('btn-save');
const btnCancel     = document.getElementById('btn-cancel');

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

// ── Select pattern ────────────────────────────────────────────────────────────
function selectPattern(id) {
  selectedId = id;
  editingId = null;
  renderList();
  showCalcPanel();
}

function showCalcPanel() {
  const p = patterns.find(x => x.id === selectedId);
  if (!p) { showEmpty(); return; }

  emptyMsg.hidden = true;
  calcPanel.hidden = false;
  editPanel.hidden = true;

  cpTitle.textContent = p.name;
  cpFormula.textContent = p.formula;

  let ast, variables;
  try {
    ({ ast, variables } = parse(p.formula));
  } catch (e) {
    cpVarsArea.innerHTML = `<p class="error">式が不正です: ${e.message}</p>`;
    cpResult.textContent = '—';
    return;
  }

  // 変数入力欄生成
  const prevValues = {};
  cpVarsArea.querySelectorAll('input[data-var]').forEach(el => {
    prevValues[el.dataset.var] = el.value;
  });

  cpVarsArea.innerHTML = '';
  if (variables.length === 0) {
    // 変数なし → 即計算
    try {
      const result = calc(ast, {});
      cpResult.textContent = formatNum(result);
    } catch (e) {
      cpResult.textContent = `エラー: ${e.message}`;
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
  } catch (e) {
    cpResult.textContent = `エラー: ${e.message}`;
  }
}

function showEmpty() {
  emptyMsg.hidden = false;
  calcPanel.hidden = true;
  editPanel.hidden = true;
}

// ── Edit panel ────────────────────────────────────────────────────────────────
function openEditPanel(id) {
  editingId = id;
  selectedId = id;
  renderList();

  const p = id ? patterns.find(x => x.id === id) : null;
  editTitle.textContent = p ? 'パターンを編集' : '新しいパターンを追加';
  epName.value    = p ? p.name    : '';
  epFormula.value = p ? p.formula : '';
  epError.textContent = '';
  epError.hidden  = true;

  emptyMsg.hidden = true;
  calcPanel.hidden = true;
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
    epError.hidden = false;
    epName.focus();
    return;
  }
  if (!formula) {
    epError.textContent = '数式を入力してください';
    epError.hidden = false;
    epFormula.focus();
    return;
  }

  // 式バリデーション
  try {
    parse(formula);
  } catch (e) {
    epError.textContent = `式エラー: ${e.message}`;
    epError.hidden = false;
    return;
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
  if (selectedId) showCalcPanel();
  else showEmpty();
});

btnEdit.addEventListener('click', () => {
  if (selectedId) openEditPanel(selectedId);
});

btnDelete.addEventListener('click', () => {
  if (!selectedId) return;
  const p = patterns.find(x => x.id === selectedId);
  if (!p) return;
  if (!confirm(`「${p.name}」を削除しますか？`)) return;
  patterns = patterns.filter(x => x.id !== selectedId);
  selectedId = patterns.length ? patterns[patterns.length - 1].id : null;
  savePatterns();
  renderList();
  if (selectedId) showCalcPanel();
  else showEmpty();
});

btnNewTop.addEventListener('click', () => openEditPanel(null));
btnNewBottom.addEventListener('click', () => openEditPanel(null));

// ── Formatting ────────────────────────────────────────────────────────────────
function formatNum(n) {
  if (n === null || isNaN(n)) return '—';
  // 小数点以下が不要なら整数表示、あれば最大10桁まで
  if (Number.isInteger(n)) return n.toLocaleString('ja-JP');
  // 有効桁10桁、末尾ゼロを除去
  const s = parseFloat(n.toPrecision(10));
  return s.toLocaleString('ja-JP', { maximumFractionDigits: 10 });
}

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
