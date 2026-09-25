import test from 'node:test';
import assert from 'node:assert/strict';

import { exactSearchResult, singleGroupSearchCandidate } from '../src/extensions/line-exact-search.mjs';

const window = { bounds: { x: 0, y: 0, width: 740, height: 600 } };
const dimensions = { width: 738, height: 598 };
const element = (element_index, role, parent_index, x, y, w, h, extra = {}) => ({
  element_index, role, parent_index, frame: { x, y, w, h }, ...extra,
});
function fixture(names = ['Prefix (Example)', 'Example'], categoryCount = names.length) {
  const state = { snapshot_id: 'search', screenshot_width: 738, screenshot_height: 598,
    elements_complete: true, elements: [
      element(0, 'Window', undefined, 0, 0, 740, 600),
      element(1, 'Edit', 0, 10, 60, 300, 40, { value: 'Example' }),
      element(2, 'List', 0, 0, 100, 320, 330),
      element(3, 'ListItem', 2, 0, 100, 320, 35),
      ...names.map((_, index) => element(4 + index, 'ListItem', 2,
        0, 135 + index * 65, 320, 65)),
    ] };
  state.total_element_count = state.elements.length;
  state.returned_element_count = state.elements.length;
  const ocr = { coordinateSpace: 'input-png-pixels', scaleFactor: 1,
    width: 738, height: 598, lines: [
      { text: `好友 (${categoryCount})`, x: 10, y: 109, width: 70, height: 17 },
      ...names.filter(name => name !== null).map((name, index) => ({
        text: name, x: 90, y: 149 + index * 65, width: 120, height: 18,
      })),
    ] };
  return { state, ocr };
}

test('chooses the second result only when its complete title is the unique exact name', () => {
  const { state, ocr } = fixture();
  assert.equal(exactSearchResult(state, window, dimensions, ocr, 'Example', 'direct').element_index, 5);
});

test('prefix and substring results do not count as the exact whole name', () => {
  const { state, ocr } = fixture(['Example (Prefix)', 'Prefix Example']);
  assert.throws(() => exactSearchResult(state, window, dimensions, ocr, 'Example', 'direct'),
    { code: 'LINE_SEARCH_NOT_UNIQUE' });
});

test('multiple exact names and unreadable rows refuse selection', () => {
  const duplicates = fixture(['Example', 'Example']);
  assert.throws(() => exactSearchResult(duplicates.state, window, dimensions,
    duplicates.ocr, 'Example', 'direct'), { code: 'LINE_SEARCH_NOT_UNIQUE' });
  const unreadable = fixture(['Prefix (Example)', null]);
  assert.throws(() => exactSearchResult(unreadable.state, window, dimensions,
    unreadable.ocr, 'Example', 'direct'), { code: 'LINE_SEARCH_NOT_UNIQUE' });
});

test('incomplete result counts or mismatched accessibility element counts refuse selection', () => {
  const countMismatch = fixture(['Prefix (Example)', 'Example'], 3);
  assert.throws(() => exactSearchResult(countMismatch.state, window, dimensions,
    countMismatch.ocr, 'Example', 'direct'), { code: 'LINE_SEARCH_NOT_UNIQUE' });
  const incomplete = fixture();
  incomplete.state.elements_complete = false;
  incomplete.state.total_element_count = incomplete.state.elements.length + 1;
  incomplete.state.returned_element_count = incomplete.state.elements.length;
  assert.throws(() => exactSearchResult(incomplete.state, window, dimensions,
    incomplete.ocr, 'Example', 'direct'), { code: 'LINE_SEARCH_NOT_UNIQUE' });
});

test('ellipsis and a title touching the row edge are not complete-name proof', () => {
  const ellipsis = fixture(['Prefix (Example)', 'Example…']);
  assert.throws(() => exactSearchResult(ellipsis.state, window, dimensions,
    ellipsis.ocr, 'Example', 'direct'), { code: 'LINE_SEARCH_NOT_UNIQUE' });
  const clipped = fixture();
  clipped.ocr.lines[2].x = 260;
  clipped.ocr.lines[2].width = 54;
  assert.throws(() => exactSearchResult(clipped.state, window, dimensions,
    clipped.ocr, 'Example', 'direct'), { code: 'LINE_SEARCH_NOT_UNIQUE' });
});

test('different whitespace, Han spacing, Unicode form and punctuation are not exact names', () => {
  for (const [requested, observed] of [
    ['A B', 'A  B'], ['範例', '範 例'], ['Café', 'Cafe\u0301'], ['Example', 'Example.'],
  ]) {
    const sample = fixture([`Prefix (${requested})`, observed]);
    sample.state.elements.find(item => item.role === 'Edit').value = requested;
    assert.throws(() => exactSearchResult(sample.state, window, dimensions,
      sample.ocr, requested, 'direct'), { code: 'LINE_SEARCH_NOT_UNIQUE' });
  }
});

test('partial window geometry can select the second exact row when OCR proves the full result set', () => {
  const sample = fixture();
  sample.state.elements_complete = false;
  assert.equal(exactSearchResult(sample.state, window, dimensions,
    sample.ocr, 'Example', 'direct').element_index, 5);
});

test('one clipped group result is a navigation candidate without OCR identity claims', () => {
  const name = '【合成測試專案】很長的群組名稱';
  const sample = fixture(['【合成測試專案】很長… (5)']);
  sample.state.elements.find(item => item.role === 'Edit').value = name;
  sample.ocr.lines[0].text = '聊天 1';
  assert.throws(() => exactSearchResult(sample.state, window, dimensions,
    sample.ocr, name, 'group'), { code: 'LINE_SEARCH_NOT_UNIQUE' });
  assert.equal(singleGroupSearchCandidate(sample.state, window, dimensions, name).element_index, 4);
});

test('group navigation refuses changed query, multiple results and incomplete geometry', () => {
  const changed = fixture(['Example']);
  changed.state.elements.find(item => item.role === 'Edit').value = 'Different';
  const incomplete = fixture(['Example']);
  incomplete.state.total_element_count++;
  const outside = fixture(['Example']);
  outside.state.elements.at(-1).frame.y = 500;
  for (const sample of [changed, fixture(), incomplete, outside, fixture([])]) {
    assert.throws(() => singleGroupSearchCandidate(sample.state, window, dimensions, 'Example'),
      { code: 'LINE_SEARCH_NOT_UNIQUE' });
  }
});
