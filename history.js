/**
 * 計算履歴の保存・取得・統計
 */

const HISTORY_KEY = 'keisan.history';

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persist(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/**
 * 計算結果を1件保存する
 */
export function saveEntry({ patternId, patternName, variables, result }) {
  const history = loadHistory();
  const entry = {
    id: 'h' + Date.now() + Math.random().toString(36).slice(2, 5),
    patternId,
    patternName,
    variables: { ...variables },
    result,
    timestamp: Date.now(),
  };
  history.push(entry);
  persist(history);
  return entry;
}

/**
 * 特定パターンの履歴一覧 (新しい順)
 */
export function getPatternHistory(patternId) {
  return loadHistory()
    .filter(e => e.patternId === patternId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * 1件削除
 */
export function deleteEntry(id) {
  persist(loadHistory().filter(e => e.id !== id));
}

/**
 * パターンの全履歴を削除
 */
export function clearPatternHistory(patternId) {
  persist(loadHistory().filter(e => e.patternId !== patternId));
}

/**
 * 統計を計算する
 * @returns {{ count, avg, max, min, sum, latest } | null}
 */
export function getStats(entries) {
  const valid = entries.filter(
    e => typeof e.result === 'number' && isFinite(e.result)
  );
  if (valid.length === 0) return null;
  const values = valid.map(e => e.result);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count:  valid.length,
    avg:    sum / valid.length,
    max:    Math.max(...values),
    min:    Math.min(...values),
    sum,
    latest: valid[0].result,
  };
}
