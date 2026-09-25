import { LineToolError } from './line-runtime.mjs';
import { canonicalOcrText } from './line-ocr.mjs';
import { directSearchLayout } from './line-group-navigation.mjs';

const fail = () => { throw new LineToolError('LINE_SEARCH_NOT_UNIQUE',
  'The current LINE search did not prove one complete exact recipient name.',
  { sendDispatched: false }); };
const rect = item => {
  const f = item?.frame;
  return f && { x: f.x, y: f.y, width: f.w ?? f.width, height: f.h ?? f.height };
};
const same = (a, b) => a && b && ['x', 'y', 'width', 'height'].every(key => a[key] === b[key]);
const inside = (a, b) => a && b && [a.x, a.y, a.width, a.height].every(Number.isFinite)
  && a.width > 0 && a.height > 0 && a.x >= b.x - 1 && a.y >= b.y - 1
  && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;

function imageRect(frame, geometry, dimensions) {
  const { root, scaleX, scaleY } = geometry;
  if (!inside(frame, root)) fail();
  const x = Math.floor((frame.x - root.x) * scaleX);
  const y = Math.floor((frame.y - root.y) * scaleY);
  const right = Math.ceil((frame.x + frame.width - root.x) * scaleX);
  const bottom = Math.ceil((frame.y + frame.height - root.y) * scaleY);
  const mapped = { x, y, width: right - x, height: bottom - y };
  if (!inside(mapped, { x: 0, y: 0, width: dimensions.width, height: dimensions.height })) fail();
  return mapped;
}

/** Navigation only: LINE labels group search results as "聊天" and clips
 * long titles. One structural result may be opened, but this is NOT identity
 * proof. The caller must verify the detached full title and refresh the bound
 * local recipient before any composer input. */
export function singleGroupSearchCandidate(state, window, dimensions, chatName) {
  if (typeof chatName !== 'string' || !chatName) fail();
  let layout;
  try { layout = directSearchLayout(state, window, dimensions); } catch { fail(); }
  if (layout.edit.value !== chatName) fail();
  const lists = state.elements.filter(item => item.role === 'List'
    && same(rect(item), layout.geometry.list));
  if (lists.length !== 1) fail();
  const rows = state.elements.filter(item => item.role === 'ListItem'
    && item.parent_index === lists[0].element_index).sort((a, b) => rect(a)?.y - rect(b)?.y);
  if (rows.length !== 2 || !same(rect(rows[0]), layout.geometry.category)
    || !same(rect(rows[1]), layout.geometry.result)
    || !inside(rect(rows[1]), layout.geometry.list)) fail();
  return rows[1];
}

/** Select a search row only when every visible result title and the category
 * count are readable in one complete, screenshot-grounded UIA list. */
export function exactSearchResult(state, window, dimensions, ocr, chatName, chatType) {
  if (!['direct', 'group'].includes(chatType) || typeof chatName !== 'string' || !chatName
    || ocr?.coordinateSpace !== 'input-png-pixels' || ocr.scaleFactor !== 1
    || ocr.width !== dimensions?.width || ocr.height !== dimensions?.height
    || !Array.isArray(ocr.lines)) fail();
  let layout;
  // directSearchLayout applies hasDirectGeometrySnapshot to the UIA tree.
  // Result-set completeness is proved below by OCR category count and every
  // contiguous, readable search row, not by the whole-window completeness bit.
  try { layout = directSearchLayout(state, window, dimensions); } catch { fail(); }
  if (layout.edit.value !== chatName) fail();
  const lists = state.elements.filter(item => item.role === 'List'
    && same(rect(item), layout.geometry.list));
  if (lists.length !== 1) fail();
  const rows = state.elements.filter(item => item.role === 'ListItem'
    && item.parent_index === lists[0].element_index).sort((a, b) => rect(a)?.y - rect(b)?.y);
  if (rows.length < 2 || !same(rect(rows[0]), layout.geometry.category)) fail();
  for (let index = 0; index < rows.length; index += 1) {
    const current = rect(rows[index]);
    if (!inside(current, layout.geometry.list)
      || (index > 0 && (current.height < 45 || current.height > 110
        || Math.abs(current.y - (rect(rows[index - 1]).y + rect(rows[index - 1]).height)) > 4))) fail();
  }
  const category = imageRect(rect(rows[0]), layout.geometry, dimensions);
  const categoryLines = ocr.lines.filter(line => inside(line, category));
  if (categoryLines.length !== 1) fail();
  const expectedCategory = chatType === 'group' ? '群組' : '好友';
  const observed = canonicalOcrText(categoryLines[0].text ?? '');
  const count = new RegExp(`^${expectedCategory}\\s*[（(]?\\s*(\\d+)\\s*[）)]?$`, 'u').exec(observed);
  if (!count || Number(count[1]) !== rows.length - 1) fail();

  const titles = rows.slice(1).map(row => {
    const mapped = imageRect(rect(row), layout.geometry, dimensions);
    const title = { x: mapped.x + Math.ceil(76 * layout.geometry.scaleX), y: mapped.y,
      width: mapped.width - Math.ceil(76 * layout.geometry.scaleX),
      height: Math.min(Math.ceil(35 * layout.geometry.scaleY), Math.floor(mapped.height * .55)) };
    if (title.width < 60 || title.height < 18) fail();
    const lines = ocr.lines.filter(line => inside(line, title)
      && line.x <= title.x + Math.ceil(50 * layout.geometry.scaleX));
    if (lines.length !== 1 || lines[0].x + lines[0].width > title.x + title.width - 10
      || /(?:\.{3}|…)/u.test(lines[0].text ?? '')) fail();
    // A recipient's identity is the whole local name, including exact spaces,
    // punctuation and Unicode form. OCR formatting normalization would turn
    // distinct names into the same recipient here.
    return { row, name: lines[0].text };
  });
  const exact = titles.filter(item => item.name === chatName);
  if (exact.length !== 1) fail();
  return exact[0].row;
}
