import { createHash, randomBytes } from 'node:crypto';
import { LineToolError, requireChat } from './line-runtime.mjs';
import { readLocalLineBoundDirectMessages, runReaderProcess } from './line-local-reader.mjs';
import { snapshot } from './cua-line-client.mjs';
import { inspectDetachedChat, createChatGuard, composerOptions, findComposer, replySourceVisualView } from './line-ui.mjs';
import { canonicalOcrText } from './line-ocr.mjs';
import { locateLineDateCapsule } from './line-date-capsule.mjs';

const day = time => new Date(time + 28800000).toISOString().slice(0, 10);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code = 'LINE_BOUND_CONTEXT_UNVERIFIED') => {
  throw new LineToolError(code, 'The selected direct chat could not be independently verified.', { sendDispatched: false });
};
const inside = (a, b) => a && b && [a.x,a.y,a.width,a.height].every(Number.isFinite)
  && a.width > 0 && a.height > 0 && a.x >= b.x && a.y >= b.y
  && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;
const compact = value => canonicalOcrText(value).replace(/\s/gu, '');
const text = value => canonicalOcrText(value.replace(/\r\n/gu, '\n'));

export const hasBoundDirectRefs = args => args.chatType === 'direct'
  && args.expectedChatRef !== undefined && args.expectedOwnSenderRef !== undefined;

export function boundDirectScope(args, now = Date.now()) {
  requireChat(args.chatName);
  if (!hasBoundDirectRefs(args) || !/^chat:[0-9a-f]{24}$/u.test(args.expectedChatRef)
    || !/^sender:[0-9a-f]{24}$/u.test(args.expectedOwnSenderRef)) fail('LINE_INVALID_ARGUMENT');
  const dateFrom = args.dateFrom ?? day(now - 2 * 86400000), dateTo = args.dateTo ?? day(now);
  const messageLimit = args.messageLimit ?? 30;
  if ((args.dateFrom === undefined) !== (args.dateTo === undefined)
    || ![dateFrom,dateTo].every(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(date)
      && Number.isFinite(Date.parse(date)) && new Date(Date.parse(date)).toISOString().slice(0,10) === date)
    || dateFrom < day(now - 2 * 86400000) || dateTo > day(now) || dateFrom > dateTo
    || !Number.isInteger(messageLimit) || messageLimit < 1 || messageLimit > 30) fail('LINE_INVALID_ARGUMENT');
  return { chatName: args.chatName, chatType: 'direct', expectedChatRef: args.expectedChatRef,
    expectedOwnSenderRef: args.expectedOwnSenderRef, dateFrom, dateTo, messageLimit, mediaMode: 'metadata' };
}

export function boundDirectTail(result, scope, now = Date.now()) {
  if (result?.chatRef !== scope.expectedChatRef) fail('CHAT_IDENTITY_CHANGED');
  if (result.ownSenderRef !== scope.expectedOwnSenderRef) fail('CHAT_ACCOUNT_CHANGED');
  const captured = Date.parse(result.freshness?.snapshotCapturedAt);
  if (result.ok !== true || result.chatName !== scope.chatName || result.chatIdentity?.kind !== 'direct'
    || result.chatIdentity.knownNameUnique !== true || result.chatIdentity.guiDisplayNameUnique !== false
    || result.freshness?.clockOrderValid !== true || !Number.isFinite(captured)
    || captured > now + 5000 || now - captured > 30000 || result.scope?.kind !== 'local_database'
    || result.pagination?.limitedBy === 'response_bytes' || !Array.isArray(result.messages)
    || result.messages.length < 2 || result.messages.length > scope.messageLimit) fail();
  const peer = `sender:${scope.expectedChatRef.slice(5)}`;
  const tail = result.messages.slice(-2).map(message => {
    if (message.contentType !== 0 || typeof message.text !== 'string' || !message.text.trim()
      || !/^message:[0-9a-f]{24}$/u.test(message.sourceRef ?? '')
      || !Number.isSafeInteger(message.sourceTimestamp) || day(message.sourceTimestamp) !== message.date
      || message.date < scope.dateFrom || message.date > scope.dateTo
      || !/^\d{2}:\d{2}:\d{2}$/u.test(message.time ?? '')
      || new Date(message.sourceTimestamp + 28800000).toISOString().slice(11,19) !== message.time
      || ![peer, scope.expectedOwnSenderRef].includes(message.senderRef)) fail();
    return { sourceRef:message.sourceRef, text:text(message.text), date:message.date,
      minute:message.time.slice(0,5), direction:message.senderRef === scope.expectedOwnSenderRef ? 'outgoing' : 'incoming',
      timestamp:message.sourceTimestamp };
  });
  if (tail[0].timestamp > tail[1].timestamp || tail[0].date !== tail[1].date
    || tail[0].text === tail[1].text) fail();
  // Short messages are admissible only as distinct full text/time/direction
  // tuples, unique in this newest local page, never as one generic "OK".
  for (const anchor of tail) {
    const matches = result.messages.filter(message => message.contentType === 0
      && typeof message.text === 'string' && text(message.text) === anchor.text
      && message.date === anchor.date && message.time?.slice(0,5) === anchor.minute
      && (message.senderRef === scope.expectedOwnSenderRef ? 'outgoing' : 'incoming') === anchor.direction);
    if (matches.length !== 1) fail();
  }
  return tail;
}

function minute(value) {
  if (typeof value !== 'string') return null;
  const match = /^(上午|下午)?(\d{1,2}):(\d{2})$/u.exec(compact(value));
  if (!match) return null;
  let hour = Number(match[2]);
  if (Number(match[3]) > 59 || hour > (match[1] ? 12 : 23) || (match[1] && hour < 1)) return null;
  if (match[1]) hour = hour % 12 + (match[1] === '下午' ? 12 : 0);
  return `${String(hour).padStart(2,'0')}:${match[3]}`;
}

export function visibleDate(value, expected, now = Date.now()) {
  const label = compact(value);
  if (label === '今天') return day(now);
  if (label === '昨天') return day(now - 86400000);
  // OCR may omit the opening weekday parenthesis; every date digit and the
  // weekday itself must still be independently present and agree.
  const match = /^(?:(\d{4})[年\/-])?(\d{1,2})[月\/-](\d{1,2})(?:日)?(?:[（(]?(?:週|星期)?([一二三四五六日天])[）)])?$/u.exec(label);
  if (!match) return null;
  const date = `${match[1] ?? expected.slice(0,4)}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0,10) !== date) return null;
  if (match[4] && '日一二三四五六'[new Date(parsed).getUTCDay()] !== match[4].replace('天','日')) return null;
  return date;
}

function rowFrame(item, view) {
  const f = item.frame, root = view.rootFrame;
  if (!f || ![f.x,f.y,f.w,f.h].every(Number.isFinite)) return null;
  const sx = view.dimensions.width / root.width, sy = view.dimensions.height / root.height;
  return {x:Math.floor((f.x-root.x)*sx), y:Math.floor((f.y-root.y)*sy),
    width:Math.floor(f.w*sx), height:Math.floor(f.h*sy)};
}

export function matchBoundDirectRows(rows, tail, date, bounds) {
  if (date !== tail[0]?.date || rows.length < 2) fail();
  const selected = rows.slice(-2);
  if (rows.some((row,i) => !inside(row.frame,bounds)
    || (i > 0 && row.frame.y < rows[i-1].frame.y + rows[i-1].frame.height - 2))) fail();
  const proof = selected.map((row,index) => {
    const content = row.lines.filter(line => text(line.text ?? '') === tail[index].text);
    if (content.length !== 1 || !inside(content[0],row.frame)
      || content[0].x < row.frame.x + 8 || content[0].x + content[0].width > row.frame.x + row.frame.width - 8) fail();
    const clocks = row.lines.filter(line => minute(line.text ?? '') !== null);
    if (clocks.length > 1) fail();
    if (row.lines.some(line => line !== content[0] && !clocks.includes(line)
      && !/^(?:已讀\d*|Read\d*)$/u.test(compact(line.text ?? '')))) fail();
    const clock = clocks[0];
    const center = bounds.x + bounds.width/2, label = content[0];
    const side = label.x > center ? 'outgoing' : label.x + label.width < center ? 'incoming' : null;
    if (!side || side !== tail[index].direction) fail();
    if (clock && (minute(clock.text) !== tail[index].minute
      || (side === 'outgoing' ? clock.x + clock.width > label.x : clock.x < label.x + label.width))) fail();
    return {minute:clock ? minute(clock.text) : null, source:clock ? 'observed' : null};
  });
  if (!proof[0].minute && proof[1].minute && tail[0].minute === tail[1].minute
    && tail[0].direction === tail[1].direction
    && Math.abs(selected[1].frame.y-selected[0].frame.y-selected[0].frame.height) <= 4) {
    proof[0] = {minute:proof[1].minute,source:'adjacent-shared'};
  }
  if (proof.some(item => !item.minute)) fail();
  return { rows:selected, minuteSources:proof.map(item=>item.source) };
}

/** Inspect an already-open exact titled chat. This function has no input calls. */
export async function inspectBoundDirect(ui, api, scope, before, readCurrent, check = () => {}, { consumeVisual = false, now = Date.now } = {}) {
  const confirmed = getConfirmed(ui,scope,now());
  if (confirmed) {
    if (consumeVisual) visualStore(ui).confirmed.delete(scopeKey(scope));
    if (pageDigest(before) !== confirmed.pageDigest) fail('LINE_BOUND_CONTEXT_CHANGED');
    const guard = contextGuard(ui,api,confirmed,readCurrent,check,now);
    const state = await guard.verify();
    const inspected = {...confirmed.inspected,state};
    return {inspected,guard,titleGuard:confirmed.titleGuard,options:composerOptions(inspected,guard),evidence:visualEvidence()};
  }
  const tail = boundDirectTail(before,scope,now());
  const inspected = await inspectDetachedChat(api,scope.chatName,{screenshot:true});
  if (!inspected) fail('LINE_BOUND_WINDOW_REQUIRED');
  const titleGuard = createChatGuard(scope.chatName,inspected,ui.ocr,ui.visual);
  const view = replySourceVisualView(inspected.state,inspected.window,titleGuard,ui.visual);
  if (!view) fail();
  const ocr = await ui.ocr.recognizeImage(view.image);
  if (ocr.coordinateSpace !== 'input-png-pixels' || ocr.scaleFactor !== 1
    || ocr.width !== view.dimensions.width || ocr.height !== view.dimensions.height) fail();
  const rows = inspected.state.elements.filter(item=>item.role==='ListItem')
    .map(item=>({item,frame:rowFrame(item,view)})).filter(row=>inside(row.frame,view.messageBounds))
    .sort((a,b)=>a.frame.y-b.frame.y).map(row=>({...row,lines:ocr.lines.filter(line=>inside(line,row.frame))}));
  const selected = rows.slice(-2);
  if (selected.length !== 2) fail();
  const dateRows = rows.filter(row=>row.frame.y < selected[0].frame.y && row.frame.height <= 50
    && row.lines.some(line=>line.width < 200 && Math.abs(line.x+line.width/2-view.dimensions.width/2)<100
      && /\d+\s*月|今天|昨天|\d{4}[\/-]/u.test(line.text)));
  const dateRow = dateRows.at(-1);
  if (!dateRow) fail();
  let dates = dateRow.lines.map(line=>visibleDate(line.text,tail[0].date)).filter(Boolean);
  if (dates.length !== 1) {
    // Small grey date glyphs need a bounded high-resolution OCR pass, never
    // a guessed substitution for a missing/misread date.
    const region={x:Math.max(dateRow.frame.x,Math.floor(view.dimensions.width/2)-125),y:dateRow.frame.y,
      width:250,height:dateRow.frame.height};
    const crop=await ui.visual.fingerprintRegion(view.image,region,{includeImage:true});
    const dateOcr=await ui.ocr.recognizeImage(crop.image,{upscaleFactor:3});
    dates=dateOcr.lines.map(line=>visibleDate(line.text,tail[0].date)).filter(Boolean);
  }
  if(dates.length!==1)fail();
  const matched=matchBoundDirectRows(rows,tail,dates[0],view.messageBounds);
  const context={x:view.messageBounds.x,y:dateRow.frame.y,width:view.messageBounds.width,
    height:matched.rows[1].frame.y+matched.rows[1].frame.height-dateRow.frame.y};
  const regions=[context,dateRow.frame,...matched.rows.map(row=>row.frame)];
  const fingerprints=await Promise.all(regions.map(region=>ui.visual.fingerprintRegion(view.image,region)));
  const record={scope,inspected,titleGuard,view,regions,fingerprints,pageDigest:pageDigest(before),
    layoutFrames:contextLayoutFrames(inspected.state,[dateRow,...matched.rows])};
  const guard=contextGuard(ui,api,record,readCurrent,check);
  return {inspected,guard,titleGuard,options:composerOptions(inspected,guard),
    evidence:{proofKind:'bound-direct-recent-context',matchedMessageCount:tail.length,dateVerified:true,minuteSources:matched.minuteSources}};
}

export async function prepareBoundDirect(ui,args,{readMessages=readLocalLineBoundDirectMessages,now=Date.now}={}) {
  const scope=boundDirectScope(args,now());
  visualStore(ui).confirmed.delete(scopeKey(scope));
  const deadline=Date.now()+30000;
  const check=()=>{if(Date.now()>=deadline)fail('LINE_PREPARE_TIMEOUT');};
  const read=()=>{check();return readMessages(scope,{runProcess:request=>runReaderProcess(request,
    {timeoutMs:Math.max(1,Math.min(5000,deadline-Date.now()))})});};
  const before=await read();
  // Check the opaque refs before any GUI access, even for injected readers.
  boundDirectTail(before,scope,now());
  return ui.withClient(async api=>{
    let proof;
    try {proof=await inspectBoundDirect(ui,api,scope,before,read,check,{now});}
    catch(error) {
      if(error?.code!=='LINE_BOUND_CONTEXT_UNVERIFIED')throw error;
      check(); return pendingVisualContext(ui,api,scope,before,now,check);
    }
    const fresh=await proof.guard.verify(proof.inspected.state);
    if(findComposer(fresh,proof.options).value!=='')fail('LINE_DRAFT_CONFLICT');
    return {success:true,status:'READY',chatName:args.chatName,chatType:'direct',chatRef:args.expectedChatRef,
      ownSenderRef:args.expectedOwnSenderRef,checkedAt:new Date(now()).toISOString(),guiVerified:true,
      contextVerified:true,draftEmpty:true,staged:false,sendDispatched:false,evidence:proof.evidence};
  },{deadline});
}

const visualContexts = new WeakMap();
const VISUAL_TTL = 90000;
const scopeKey = scope => JSON.stringify([scope.chatName,scope.expectedChatRef,scope.expectedOwnSenderRef]);
const pageDigest = result => hash({chatName:result.chatName,chatRef:result.chatRef,ownSenderRef:result.ownSenderRef,
  chatIdentity:{kind:result.chatIdentity?.kind,knownNameUnique:result.chatIdentity?.knownNameUnique,
    guiDisplayNameUnique:result.chatIdentity?.guiDisplayNameUnique,globalNameUnique:result.chatIdentity?.globalNameUnique},
  scope:{kind:result.scope?.kind,dateFrom:result.scope?.dateFrom,dateTo:result.scope?.dateTo,messageLimit:result.scope?.messageLimit},
  pagination:{limitedBy:result.pagination?.limitedBy,hasMore:result.pagination?.hasMore,
    nextCursor:result.pagination?.nextCursor},
  messages:result.messages.map(message=>({sourceRef:message.sourceRef,sourceTimestamp:message.sourceTimestamp,
    contentType:message.contentType,text:message.text,date:message.date,time:message.time,senderRef:message.senderRef}))});
function visualStore(ui) {
  let store=visualContexts.get(ui);
  if(!store){store={pending:new Map(),confirmed:new Map()};visualContexts.set(ui,store);}
  return store;
}
function trimRecords(map,now) {
  for(const [key,record] of map) if(now-record.capturedAt >= VISUAL_TTL || now < record.capturedAt) map.delete(key);
  while(map.size >= 4) map.delete(map.keys().next().value);
}
function getConfirmed(ui,scope,now) {
  const store=visualStore(ui), key=scopeKey(scope), record=store.confirmed.get(key);
  if(!record) return null;
  if(now-record.capturedAt >= VISUAL_TTL || now < record.capturedAt) {
    store.confirmed.delete(key); fail('LINE_VISUAL_CONTEXT_EXPIRED');
  }
  if(hash(record.scope)!==hash(scope))fail('LINE_BOUND_CONTEXT_CHANGED');
  return record;
}
export function confirmedBoundDirectScope(ui,args,now=Date.now()) {
  const scope=boundDirectScope(args,now), record=visualStore(ui).confirmed.get(scopeKey(scope));
  if(!record) return scope;
  if(now-record.capturedAt >= VISUAL_TTL || now < record.capturedAt) {
    visualStore(ui).confirmed.delete(scopeKey(scope));fail('LINE_VISUAL_CONTEXT_EXPIRED');
  }
  if ((args.dateFrom!==undefined && args.dateFrom!==record.scope.dateFrom)
    || (args.dateTo!==undefined && args.dateTo!==record.scope.dateTo)
    || (args.messageLimit!==undefined && args.messageLimit!==record.scope.messageLimit)) fail('LINE_BOUND_CONTEXT_CHANGED');
  return {...record.scope};
}
const visualEvidence=()=>({proofKind:'bound-direct-caller-visual-context',matchedMessageCount:2,
  dateVerified:true,minuteSources:['caller-observed','caller-observed']});
// Relocation is grounded in the original complete date and newest two rows,
// never in a search for matching pixels elsewhere in the screenshot.
function contextLayoutFrames(state,rows) {
  const parent=rows[0].item.parent_index;
  if(rows.some(row=>row.item.parent_index!==parent)
    || !state.elements.some(item=>item.element_index===parent && item.role==='List'))return undefined;
  return rows.map(row=>({...row.frame}));
}
function relocatedContextRegions(record,state,fresh) {
  const {view,regions,layoutFrames}=record, before=view.messageBounds, after=fresh.messageBounds;
  const headers=state=>state.elements.filter(item=>item.role==='Header')
    .map(item=>({frame:item.frame,label:item.label,name:item.name,text:item.text,value:item.value}));
  if(!layoutFrames || ['x','y','width'].some(key=>before[key]!==after[key])
    || hash(headers(state))!==hash(headers(record.inspected.state)))fail('LINE_BOUND_CONTEXT_CHANGED');
  const rows=state.elements.filter(item=>item.role==='ListItem')
    .map(item=>({item,frame:rowFrame(item,fresh)})).sort((a,b)=>(a.frame?.y??Infinity)-(b.frame?.y??Infinity));
  const selected=rows.slice(-2), original=layoutFrames.slice(1);
  if(selected.length!==2)fail('LINE_BOUND_CONTEXT_CHANGED');
  const delta=selected[1].frame?.y-original[1].y;
  const translated=frame=>({...frame,y:frame.y+delta});
  const sameFrame=(a,b)=>a && ['x','y','width','height'].every(key=>a[key]===b[key]);
  const complete=frame=>inside(frame,after) && frame.x+frame.width<=after.x+after.width
    && frame.y+frame.height<=after.y+after.height;
  const parent=selected[0].item.parent_index;
  const date=rows.filter(row=>row.item.parent_index===parent && sameFrame(row.frame,translated(layoutFrames[0])));
  if(!Number.isFinite(delta) || selected[1].item.parent_index!==parent || date.length!==1
    || !state.elements.some(item=>item.element_index===parent && item.role==='List')
    || selected.some((row,index)=>!sameFrame(row.frame,translated(original[index])))
    || [date[0],...selected].some(row=>!complete(row.frame)))fail('LINE_BOUND_CONTEXT_CHANGED');
  const relocated=regions.map(translated);
  if(relocated.some(region=>!complete(region)))fail('LINE_BOUND_CONTEXT_CHANGED');
  return relocated;
}
function contextGuard(ui,api,record,readCurrent,check=()=>{},now=Date.now) {
  const {scope,inspected,titleGuard,view,regions,fingerprints}=record;
  return {kind:'bound-direct-context',chatName:scope.chatName,target:inspected.target,
    async verify() {
      check();
      if(record.capturedAt!==undefined && (now()-record.capturedAt>=VISUAL_TTL || now()<record.capturedAt)) fail('LINE_VISUAL_CONTEXT_EXPIRED');
      const windows=await api.call('list_windows',{pid:inspected.target.pid});
      const exact=windows.windows.filter(window=>window.app_name==='LINE.exe' && window.title===scope.chatName
        && window.is_on_screen && !window.minimized);
      if(exact.length!==1 || exact[0].window_id!==inspected.target.window_id
        || ['x','y','width','height'].some(key=>exact[0].bounds?.[key]!==inspected.window.bounds?.[key])) fail('LINE_CHAT_STALE');
      const current=await readCurrent();
      boundDirectTail(current,scope,now());
      if(pageDigest(current)!==record.pageDigest)fail('LINE_BOUND_CONTEXT_CHANGED');
      const state=await snapshot(api,inspected.target,{screenshot:true});
      const stateTitle=state.title??state.window_title??state.window?.title;
      if(stateTitle!==undefined && stateTitle!==scope.chatName)fail('LINE_CHAT_STALE');
      const fresh=replySourceVisualView(state,inspected.window,titleGuard,ui.visual);
      if(!fresh || fresh.dimensions.width!==view.dimensions.width || fresh.dimensions.height!==view.dimensions.height
        || hash(fresh.rootFrame)!==hash(view.rootFrame))fail('LINE_BOUND_CONTEXT_CHANGED');
      const currentRegions=hash(fresh.messageBounds)===hash(view.messageBounds) ? regions
        : relocatedContextRegions(record,state,fresh);
      const next=await Promise.all(currentRegions.map(region=>ui.visual.fingerprintRegion(fresh.image,region)));
      if(next.some((item,index)=>item.sha256!==fingerprints[index].sha256))fail('LINE_BOUND_CONTEXT_CHANGED');
      check();
      if(record.capturedAt!==undefined && now()-record.capturedAt>=VISUAL_TTL)fail('LINE_VISUAL_CONTEXT_EXPIRED');
      return state;
    }};
}
async function pendingVisualContext(ui,api,scope,before,now,check=()=>{}) {
  const tail=boundDirectTail(before,scope,now());
  const inspected=await inspectDetachedChat(api,scope.chatName,{screenshot:true});
  if(!inspected)fail('LINE_BOUND_WINDOW_REQUIRED');
  const titleGuard=createChatGuard(scope.chatName,inspected,ui.ocr,ui.visual);
  const view=replySourceVisualView(inspected.state,inspected.window,titleGuard,ui.visual);
  if(!view)fail();
  const rows=inspected.state.elements.filter(item=>item.role==='ListItem')
    .map(item=>({item,frame:rowFrame(item,view)})).sort((a,b)=>(a.frame?.y??Infinity)-(b.frame?.y??Infinity));
  const selected=rows.slice(-2);
  if(selected.length!==2 || selected[0].item.parent_index!==selected[1].item.parent_index
    || !inspected.state.elements.some(item=>item.element_index===selected[0].item.parent_index && item.role==='List')
    || selected.some(row=>!inside(row.frame,view.messageBounds))
    || selected[1].frame.y < selected[0].frame.y+selected[0].frame.height-2)fail();
  let dateRow;
  const candidates=rows.slice(0,-2).filter(row=>row.item.parent_index===selected[0].item.parent_index
    && inside(row.frame,view.messageBounds) && row.frame.height>=14 && row.frame.height<=50).slice(-6).reverse();
  for(const row of candidates) {
    check();
    const region={x:Math.floor(view.dimensions.width/2)-125,y:row.frame.y,width:250,height:row.frame.height};
    if(!inside(region,row.frame))continue;
    const crop=await ui.visual.fingerprintRegion(view.image,region,{includeImage:true});
    if(await (ui.visual.locateDateCapsule??locateLineDateCapsule)(crop.image)){dateRow=row;break;}
  }
  if(!dateRow)fail();
  const segment=rows.slice(rows.indexOf(dateRow));
  if(segment.some((row,i)=>row.item.parent_index!==selected[0].item.parent_index
    || !inside(row.frame,view.messageBounds)
    || (i>0 && row.frame.y<segment[i-1].frame.y+segment[i-1].frame.height-2)))fail();
  const context={x:view.messageBounds.x,y:dateRow.frame.y,width:view.messageBounds.width,
    height:selected[1].frame.y+selected[1].frame.height-dateRow.frame.y};
  if(!inside(context,view.messageBounds))fail();
  const regions=[context,dateRow.frame,...selected.map(row=>row.frame)];
  const fingerprints=await Promise.all(regions.map((region,i)=>ui.visual.fingerprintRegion(view.image,region,{includeImage:i===0})));
  check();
  const capturedAt=now(), token=randomBytes(24).toString('hex');
  const record={scope,inspected,titleGuard,view,regions,fingerprints,pageDigest:pageDigest(before),tail,
    observedTexts:before.messages.slice(-2).map(message=>message.text.replace(/\r\n/gu,'\n').normalize('NFC')),
    capturedAt,layoutFrames:contextLayoutFrames(inspected.state,[dateRow,...selected])};
  const store=visualStore(ui); trimRecords(store.pending,capturedAt);
  store.pending.set(token,record);
  return {success:true,status:'PENDING_VISUAL_CONTEXT',token,expiresAt:new Date(capturedAt+VISUAL_TTL).toISOString(),
    chatName:scope.chatName,chatType:'direct',chatRef:scope.expectedChatRef,ownSenderRef:scope.expectedOwnSenderRef,
    images:[fingerprints[0].image],contextRegion:context,staged:false,sendDispatched:false,contextVerified:false};
}
export async function confirmBoundDirectContext(ui,args,{readMessages=readLocalLineBoundDirectMessages,now=Date.now}={}) {
  const store=visualStore(ui), record=store.pending.get(args.token);
  // Every attempt consumes the token before checking observations or identity.
  store.pending.delete(args.token);
  if(!record)fail('LINE_VISUAL_CONTEXT_TOKEN_INVALID');
  if(now()-record.capturedAt>=VISUAL_TTL || now()<record.capturedAt)fail('LINE_VISUAL_CONTEXT_EXPIRED');
  if(args.chatName!==record.scope.chatName || args.expectedChatRef!==record.scope.expectedChatRef
    || args.expectedOwnSenderRef!==record.scope.expectedOwnSenderRef)fail('LINE_VISUAL_CONTEXT_MISMATCH');
  if(typeof args.observedDate!=='string' || visibleDate(args.observedDate,record.tail[0].date,record.capturedAt)!==record.tail[0].date
    || !Array.isArray(args.observedMessages) || args.observedMessages.length!==2)fail('LINE_VISUAL_CONTEXT_MISMATCH');
  args.observedMessages.forEach((message,index)=>{
    if(!message || typeof message.text!=='string'
      || message.text.replace(/\r\n/gu,'\n').normalize('NFC')!==record.observedTexts[index]
      || minute(message.time??'')!==record.tail[index].minute
      || message.direction!==record.tail[index].direction)fail('LINE_VISUAL_CONTEXT_MISMATCH');
  });
  const deadline=Date.now()+30000;
  const check=()=>{if(Date.now()>=deadline)fail('LINE_PREPARE_TIMEOUT');};
  const read=()=>{check();return readMessages(record.scope,{runProcess:request=>runReaderProcess(request,
    {timeoutMs:Math.max(1,Math.min(5000,deadline-Date.now()))})});};
  return ui.withClient(async api=>{
    const guard=contextGuard(ui,api,record,read,check,now);
    const fresh=await guard.verify();
    if(findComposer(fresh,composerOptions(record.inspected,guard)).value!=='')fail('LINE_DRAFT_CONFLICT');
    trimRecords(store.confirmed,now());store.confirmed.set(scopeKey(record.scope),record);
    return {success:true,status:'READY',chatName:record.scope.chatName,chatType:'direct',chatRef:record.scope.expectedChatRef,
      ownSenderRef:record.scope.expectedOwnSenderRef,checkedAt:new Date(now()).toISOString(),guiVerified:true,
      contextVerified:true,draftEmpty:true,staged:false,sendDispatched:false,evidence:visualEvidence()};
  },{deadline});
}
