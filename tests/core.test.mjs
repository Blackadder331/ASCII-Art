import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pixelsToAscii, outputSize, searchLibrary, cleanPrompt, artDimensions, cycleIndex, escapeXML } from '../dist/core.js';

test('luminance runs from whitespace to dense ink and preserves the grid', () => {
  const pixels = new Uint8ClampedArray([255,255,255,255,128,128,128,255,0,0,0,255,255,255,255,255]);
  assert.equal(pixelsToAscii(pixels,2,2,{ramp:' .#',contrast:1}), ' .\n# ');
  assert.equal(pixelsToAscii(pixels,2,2,{ramp:' .#',contrast:1,invert:true}), '#.\n #');
});

test('transparent pixels are composited onto white before conversion', () => {
  assert.equal(pixelsToAscii(new Uint8ClampedArray([0,0,0,0,0,0,0,128]),2,1,{ramp:' .#',contrast:1}),' .');
});

test('portrait and landscape output compensate for monospace character proportions', () => {
  assert.deepEqual(outputSize(600,400,100),{width:100,height:38});
  assert.deepEqual(outputSize(400,600,100),{width:100,height:87});
  assert.deepEqual(outputSize(10,10000,1000),{width:180,height:180});
  assert.throws(()=>outputSize(0,100,100));
});

test('keyword search returns every matching original artwork, including aliases', async () => {
  const library = JSON.parse(await readFile(new URL('../dist/assets/library.json',import.meta.url)));
  const skulls = searchLibrary(library,'Please draw a skull');
  assert.equal(skulls.length, 7);
  assert.equal(skulls[0].id, 'ascii-bin-128');
  assert.equal(new Set(skulls.map(item => item.text)).size, 7);
  assert.deepEqual(searchLibrary(library,'skulls'), skulls);
  assert.equal(searchLibrary(library,'Please draw a cute cat').length, 2);
  assert.equal(searchLibrary(library,'horned skull').length, 2);
  assert.equal(searchLibrary(library,'rose').length, 5);
  assert.equal(searchLibrary(library,'glorpzxywwq',1).length,0);
  assert.equal(cleanPrompt('Please make ASCII art of a rose'),'rose');
  assert.equal(searchLibrary(library,'').length, library.length);
  assert.equal(searchLibrary([...library,...library,...library,...library,...library],'skull').length,35);
  assert.equal(searchLibrary([{name:'Skullcap',tags:'hat'}],'skull').length,0);
});

test('archive records contain literal ASCII text, source links, and retained signatures', async () => {
  const library = JSON.parse(await readFile(new URL('../dist/assets/library.json',import.meta.url)));
  assert.equal(new Set(library.map(item=>item.id)).size, library.length);
  for (const item of library) {
    assert.match(item.text, /\n/);
    assert.doesNotMatch(item.text, /[^\x20-\x7e\n]/);
    assert.match(item.sourceURL, /^https:\/\/github\.com\/amwhoi\/ascii-bin\/blob\/main\/asciiart_db\.txt#L\d+$/);
  }
  assert.match(library.find(item=>item.id==='ascii-bin-251').text,/Berton Corson/);
});

test('cycling visits every match and wraps in either direction without changing artwork', async () => {
  const library = JSON.parse(await readFile(new URL('../dist/assets/library.json',import.meta.url)));
  const matches = searchLibrary(library,'skull');
  const original = JSON.stringify(matches);
  let index=0; const visited=new Set();
  for(let i=0;i<matches.length;i++){visited.add(matches[index].id);index=cycleIndex(index,1,matches.length);}
  assert.equal(visited.size,matches.length);
  assert.equal(index,0);
  assert.equal(cycleIndex(index,-1,matches.length),matches.length-1);
  assert.equal(cycleIndex(0,1,1),0);
  assert.equal(cycleIndex(0,-1,0),0);
  assert.equal(JSON.stringify(matches),original);
  assert.deepEqual(artDimensions('  /\\\n /  \\'),{width:5,height:2});
});

test('export escapes characters that would corrupt SVG text',()=>{
  assert.equal(escapeXML('<&"\'>'),'&lt;&amp;&quot;&apos;&gt;');
});
