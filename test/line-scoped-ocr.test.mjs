import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import { navigationOcrRegion, searchResultsOcrRegion, mixedDirectSearchOcrRegions, rebaseScopedOcr,
  recognizeScopedLineImage, combineNavigationAndResults } from '../src/extensions/line-scoped-ocr.mjs';
import { exactCategoryTab } from '../src/extensions/line-category-tab.mjs';
import { exactSearchResult } from '../src/extensions/line-exact-search.mjs';

const main=JSON.parse(fs.readFileSync(
  new URL('./fixtures/live-window-structure-v2-20260928.json',import.meta.url),'utf8'))
  .find(item=>item.window.window_id===68616);
const dimensions={width:1098,height:1318};
const row=(index,y,height)=>({element_index:index,parent_index:56,role:'ListItem',
  frame:{x:1112,y,w:302,h:height}});
function searchState() {
  const elements=[...main.elements.filter(item=>!(item.role==='ListItem' && item.parent_index===56))
    .map(item=>item.element_index===74?{...item,value:'Example'}:item),
  row(500,149,35),row(501,184,65),row(502,249,65)];
  return {elements,elements_complete:false,
    total_element_count:elements.length,returned_element_count:elements.length};
}
const recognized=(region,lines)=>({coordinateSpace:'input-png-pixels',scaleFactor:1,
  width:region.width,height:region.height,lines});

test('fresh main shell bounds a small crop containing all category tabs',()=>{
  assert.deepEqual(navigationOcrRegion({elements:main.elements},main.window,dimensions),
    {x:0,y:0,width:367,height:131});
  const missingDivider=main.elements.filter(item=>item.role!=='Thumb');
  assert.throws(()=>navigationOcrRegion({elements:missingDivider},main.window,dimensions),
    {code:'LINE_OCR_INVALID_REGION'});
});

test('result crop contains the category and every observed result row',()=>{
  const state=searchState();
  assert.deepEqual(searchResultsOcrRegion(state,main.window,dimensions),
    {x:61,y:108,width:303,height:166});
  const incomplete={...state,elements:state.elements.filter(item=>item.element_index!==502)};
  assert.throws(()=>searchResultsOcrRegion(incomplete,main.window,dimensions),
    {code:'LINE_GROUP_LAYOUT_UNAVAILABLE'});
});

test('crop OCR maps exact words and all result titles to original PNG pixels',async()=>{
  const state=searchState();
  const navRegion=navigationOcrRegion(state,main.window,dimensions);
  const resultsRegion=searchResultsOcrRegion(state,main.window,dimensions);
  const crop=async(_image,region,options)=>{
    assert.deepEqual(options,{includeImage:true});
    return {region,width:region.width,height:region.height,
      image:{tag:region.y===0?'navigation':'results'}};
  };
  const recognize=async image=>image.tag==='navigation'
    ? recognized(navRegion,[
      {text:'好友',x:120,y:16,width:28,height:17,
        words:[{text:'好友',x:120,y:16,width:28,height:17}]},
      {text:'search text',x:110,y:75,width:80,height:18,words:[]},
    ])
    : recognized(resultsRegion,[
      {text:'好友 (2)',x:16,y:5,width:70,height:17,words:[]},
      {text:'Other',x:84,y:42,width:80,height:18,words:[]},
      {text:'Example',x:84,y:107,width:100,height:18,words:[]},
    ]);
  const nav=await recognizeScopedLineImage({},navRegion,dimensions,{crop,recognize});
  const results=await recognizeScopedLineImage({},resultsRegion,dimensions,{crop,recognize});
  const combined=combineNavigationAndResults(nav,results,dimensions);
  assert.equal(combined.lines.length,4);
  assert.equal(combined.lines[0].words[0].x,120);
  assert.equal(combined.lines[1].y,113);
  assert.equal(exactCategoryTab(nav,state.elements,main.window.bounds,dimensions,'direct').element_index,17);
  assert.equal(exactSearchResult(state,main.window,dimensions,combined,'Example','direct').element_index,502);
  assert.throws(()=>exactSearchResult(state,main.window,dimensions,combined,'Missing','direct'),
    {code:'LINE_SEARCH_NOT_UNIQUE'});
});

test('wrong crop, shifted OCR geometry and missing labels fail closed',async()=>{
  const region={x:61,y:108,width:303,height:166};
  assert.throws(()=>rebaseScopedOcr(recognized(region,[
    {text:'Example',x:300,y:3,width:10,height:18,words:[]}]),region,dimensions),
  {code:'LINE_OCR_INVALID_REGION'});
  await assert.rejects(recognizeScopedLineImage({},region,dimensions,{
    crop:async()=>({region:{...region,x:62},width:303,height:166,image:{}}),
    recognize:async()=>recognized(region,[]),
  }),{code:'LINE_OCR_INVALID_REGION'});
  const nav=rebaseScopedOcr(recognized({x:0,y:0,width:367,height:131},[]),
    {x:0,y:0,width:367,height:131},dimensions);
  assert.equal(exactCategoryTab(nav,main.elements,main.window.bounds,dimensions,'direct'),null);
  assert.throws(()=>combineNavigationAndResults(nav,{...nav,lines:[
    {text:'overlap',x:1,y:20,width:30,height:10,words:[]}]},dimensions),
  {code:'LINE_OCR_INVALID_REGION'});
});

test('mixed direct OCR stops at the message header and isolates the full chat title',()=>{
  const bounds={x:1050,y:19,width:1100,height:1400};
  const size={width:1098,height:1398};
  const item=(element_index,role,parent_index,x,y,w,h,extra={})=>({
    element_index,role,parent_index,frame:{x,y,w,h},...extra});
  const elements=[
    item(0,'Window',undefined,1050,19,1100,1400),
    item(1,'Edit',0,1124,82,264,38,{value:'Synthetic Chat'}),
    item(2,'List',0,1112,116,302,1223),
    item(3,'ListItem',2,1112,116,302,34),
    item(4,'ListItem',2,1112,150,302,71),
    item(5,'ListItem',2,1112,221,302,34),
    ...[0,1,2,3].map(index=>item(6+index,'ListItem',2,1112,255+71*index,302,71)),
  ];
  const state={elements,screenshot_width:size.width,screenshot_height:size.height,
    total_element_count:elements.length,returned_element_count:elements.length};
  const regions=mixedDirectSearchOcrRegions(state,{bounds},size,'Synthetic Chat');
  const firstMessageTop=Math.floor((255-bounds.y)*size.height/bounds.height);
  assert.equal(regions.headers.y+regions.headers.height,firstMessageTop);
  assert.ok(regions.title.y>=regions.headers.y);
  assert.ok(regions.title.y+regions.title.height<regions.messageHeaderTop);
  assert.throws(()=>mixedDirectSearchOcrRegions(state,{bounds},size,'Stale Chat'),
    {code:'LINE_OCR_INVALID_REGION'});
});
