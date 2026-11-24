import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pixelsToAscii, outputSize, searchLibrary, cleanPrompt, escapeXML } from '../dist/core.js';

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

test('natural language prompts and aliases resolve to meaningful library subjects', async () => {
  const library = JSON.parse(await readFile(new URL('../dist/assets/library.json',import.meta.url)));
  assert.equal(searchLibrary(library,'Please draw a cute cat',1)[0].id,'1F408');
  assert.equal(searchLibrary(library,'Saturn',1)[0].id,'1FA90');
  assert.equal(searchLibrary(library,'A butterfly',1)[0].id,'1F98B');
  assert.equal(searchLibrary(library,'mushrooms',1)[0].id,'1F344');
  assert.equal(searchLibrary(library,'glorpzxywwq',1).length,0);
  assert.equal(cleanPrompt('Please make ASCII art of a rose'),'rose');
});

test('export escapes characters that would corrupt SVG text',()=>{
  assert.equal(escapeXML('<&"\'>'),'&lt;&amp;&quot;&apos;&gt;');
});
