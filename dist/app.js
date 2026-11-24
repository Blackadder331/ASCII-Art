import { RAMPS, pixelsToAscii, searchLibrary, cleanPrompt, outputSize, escapeXML, safeFilename } from './core.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const LOCAL_IDS = new Set(['1F98B','1F344','1F480','1FA90','1F408','1F339','1F680','1F47B','1F409','1F3F0','1F419','1F33B','1F30D','1F47D','1F335','1F3AE']);
const STARTERS = [
  { id: '1F480', title: 'Memento mori', category: 'THE CLASSICS' },
  { id: '1FA90', title: 'Out of this world', category: 'SPACE' },
  { id: '1F344', title: 'Forest floor', category: 'NATURE' },
  { id: '1F339', title: 'Say it with flowers', category: 'BOTANICAL' },
];
const state = { library: [], source: null, text: '', name: '', credit: '', sourceURL: '', request: 0, busy: false, zoom: 1, online: false, category: 'all', limit: 40, dimensions: { width: 100, height: 58 } };
const images = new Map();
let toastTimer;

function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3800);
}

function setStatus(message, error = false) {
  $('#status-message').textContent = message;
  $('#status-message').classList.toggle('error', error);
}

function setBusy(busy, message = 'Finding your next masterpiece…') {
  state.busy = busy;
  $('#loading-overlay').hidden = !busy;
  $('#loading-label').textContent = message;
  $('#generate-button').disabled = busy;
  $('#generate-label').textContent = busy ? 'Making characters…' : 'Generate ASCII';
  $('#copy-button').disabled = busy || !state.text;
  $('#download-button').disabled = busy || !state.text;
  $('#preview-panel').setAttribute('aria-busy', String(busy));
}

async function fetchJSON(url, timeout = 12000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`The image service is unavailable (${response.status}). Try an upload or a library illustration.`);
  return response.json();
}

function readImage(url, crossOrigin = false) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { image.src = ''; reject(new Error('That image took too long to load. Try another subject or upload an image.')); }, 15000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('That image could not be opened. Try another subject or upload an image.')); };
    image.src = url;
  });
}

function assetURL(item) {
  return LOCAL_IDS.has(item.id) ? `./assets/openmoji/${item.id}.svg` : `https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg/${item.id}.svg`;
}

async function libraryImage(item) {
  if (!images.has(item.id)) {
    const promise = readImage(assetURL(item), !LOCAL_IDS.has(item.id)).catch(error => { images.delete(item.id); throw error; });
    images.set(item.id, promise);
  }
  return images.get(item.id);
}

function makeAscii(source, columns, settings = {}) {
  const size = outputSize(source.naturalWidth || source.width, source.naturalHeight || source.height, columns);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size.width, size.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, size.width, size.height);
  return { text: pixelsToAscii(context.getImageData(0, 0, size.width, size.height).data, size.width, size.height, settings), ...size };
}

function fitArt() {
  if (!state.text) return;
  const viewport = $('#canvas-viewport');
  const availableWidth = Math.max(180, viewport.clientWidth - 80);
  const availableHeight = Math.max(150, viewport.clientHeight - 110);
  const fontSize = Math.min(availableWidth / (state.dimensions.width * .6), availableHeight / (state.dimensions.height * 1.04), 18) * state.zoom;
  $('#ascii-output').style.fontSize = `${Math.max(1.8, fontSize)}px`;
  $('#zoom-fit').textContent = state.zoom === 1 ? 'Fit' : `${Math.round(state.zoom * 100)}%`;
}

function render() {
  $('#width-value').value = `${$('#width').value} columns`;
  $('#contrast-value').value = `${Number($('#contrast').value).toFixed(1)}×`;
  if (!state.source) return;
  try {
    const result = makeAscii(state.source, Number($('#width').value), { ramp: RAMPS[$('#character-set').value], contrast: Number($('#contrast').value), invert: $('#invert').checked });
    state.text = result.text;
    state.dimensions = { width: result.width, height: result.height };
    $('#ascii-output').textContent = result.text;
    $('#ascii-output').setAttribute('aria-label', `ASCII art of ${state.name}, ${result.width} columns by ${result.height} rows`);
    $('#art-title').textContent = state.name.toUpperCase();
    $('#art-dimensions').textContent = `${result.width} × ${result.height}`;
    $('#character-count').textContent = `${(result.width * result.height).toLocaleString()} CHARACTERS`;
    fitArt();
  } catch (error) {
    setStatus(error.name === 'SecurityError' ? 'This image does not allow browser conversion. Download it and use “From an image” instead.' : error.message, true);
  }
}

function setSource(source, name, credit, sourceURL = '') {
  state.source = source;
  state.name = name;
  state.credit = credit;
  state.sourceURL = sourceURL;
  state.zoom = 1;
  const creditNode = $('#source-credit');
  creditNode.replaceChildren();
  if (sourceURL) {
    const link = document.createElement('a');
    link.href = sourceURL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = credit;
    creditNode.append(link);
  } else creditNode.textContent = credit;
  render();
}

function compose(sources) {
  if (sources.length === 1) return sources[0];
  const canvas = document.createElement('canvas');
  canvas.width = 480 * sources.length;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  sources.forEach((img,i) => ctx.drawImage(img, i * 480 + 20, 40, 440, 440));
  return canvas;
}

async function selectArt(item, { scroll = false } = {}) {
  const request = ++state.request;
  setBusy(true, 'Turning an illustration into characters…');
  setStatus('');
  try {
    const image = await libraryImage(item);
    if (request !== state.request) return;
    setSource(image, item.name, 'OpenMoji · CC BY-SA 4.0', `https://openmoji.org/library/emoji-${item.id}/`);
    state.credit = `OpenMoji: ${item.name}. Artist: ${item.author}. Adapted to ASCII. CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).`;
    $('#prompt').value = item.name;
    setStatus(`Found in the library: ${item.name}.`);
    if (scroll) $('#studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { if (request === state.request) setStatus(error.message, true); }
  finally { if (request === state.request) setBusy(false); }
}

async function onlinePhoto(prompt, request) {
  const term = cleanPrompt(prompt) || prompt.trim();
  const params = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: term, gsrlimit: '6', gsrnamespace: '0', prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: '800', pilicense: 'free', format: 'json', origin: '*' });
  const data = await fetchJSON(`https://en.wikipedia.org/w/api.php?${params}`);
  const pages = Object.values(data.query?.pages || {}).filter(p => p.thumbnail?.source).sort((a,b) => a.index - b.index);
  if (!pages.length) throw new Error(`No image found for “${prompt}”. Try a simpler subject, browse the library, or upload a reference image.`);
  for (const page of pages.slice(0, 3)) {
    if (request !== state.request) return;
    try {
      const image = await readImage(page.thumbnail.source, true);
      // Read a sample before committing: remote servers must permit canvas access.
      makeAscii(image, 30);
      if (request !== state.request) return;
      const url = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage)}`;
      setSource(image, page.title, 'Wikimedia · Source & license', url);
      state.credit = `Photo: ${page.title}. Source and original license: ${url}. Converted to ASCII with ASCII Studio.`;
      setStatus(`Online photo found: ${page.title}. See the source link for its license.`);
      return;
    } catch (error) { if (page === pages.slice(0,3).at(-1)) throw error; }
  }
}

async function generate() {
  const prompt = $('#prompt').value.trim();
  if (!prompt) { setStatus('Give your idea a few words first.', true); $('#prompt').focus(); return; }
  const request = ++state.request;
  setStatus('');
  setBusy(true, state.online ? 'Searching online photos…' : 'Finding the right characters…');
  try {
    const banner = prompt.match(/^(?:text|banner|write|words?)\s*:\s*(.+)$/is);
    if (banner) {
      const content = banner[1].trim();
      const lines = wrapText(content, 18);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(240, Math.max(...lines.map(line => line.length)) * 62 + 60);
      canvas.height = lines.length * 110 + 50;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#000';ctx.font = 'bold 100px "Courier New",monospace';ctx.textBaseline='top';
      lines.forEach((line,i)=>ctx.fillText(line,30,25+i*110));
      setSource(canvas,content,'YOUR WORDS · ASCII STUDIO');state.credit='';
      setStatus('Your words, with a little more character.');return;
    }
    if (state.online) { await onlinePhoto(prompt, request); return; }
    const parts = prompt.split(/\s+(?:and|plus)\s+|\s*\+\s*/i).filter(Boolean).slice(0,4);
    const items = parts.map(part => searchLibrary(state.library, part, 1)[0]);
    if (items.every(Boolean)) {
      const sources = await Promise.all(items.map(libraryImage));
      if (request !== state.request) return;
      const name = items.map(item => item.name).join(' + ');
      setSource(compose(sources), name, 'OpenMoji · CC BY-SA 4.0', items.length === 1 ? `https://openmoji.org/library/emoji-${items[0].id}/` : 'https://openmoji.org/');
      state.credit = `OpenMoji: ${items.map(x => `${x.name} by ${x.author}`).join('; ')}. Adapted to ASCII. CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).`;
      setStatus(`Found in the library: ${name}.`);
    } else {
      $('#loading-label').textContent = 'Looking beyond the library…';
      await onlinePhoto(prompt, request);
    }
  } catch (error) {
    if (request === state.request) setStatus(error.name === 'TimeoutError' || error instanceof TypeError ? 'Online search is unavailable right now. Try the art library or upload an image.' : error.message, true);
  } finally { if (request === state.request) setBusy(false); }
}

function switchTab(mode) {
  const upload = mode === 'upload';
  for (const name of ['imagine', 'upload']) {
    const active = (name === 'upload') === upload;
    $(`#${name}-tab`).setAttribute('aria-selected', String(active));
    $(`#${name}-tab`).tabIndex = active ? 0 : -1;
    $(`#${name}-panel`).hidden = !active;
  }
  setStatus('');
}

async function uploadImage(file) {
  if (!file) return;
  if (!['image/png','image/jpeg','image/webp','image/gif','image/avif','image/bmp'].includes(file.type)) { setStatus('Please choose a JPG, PNG, WEBP, GIF, AVIF, or BMP image.', true); return; }
  if (file.size > 20 * 1024 * 1024) { setStatus('That file is over 20 MB. Please choose a smaller image.', true); return; }
  const request = ++state.request;
  switchTab('upload');
  setBusy(true, 'Giving your image a new character…');
  const url = URL.createObjectURL(file);
  try {
    const image = await readImage(url);
    if (request !== state.request) return;
    if (image.naturalWidth * image.naturalHeight > 60_000_000) throw new Error('This image is too large to process comfortably. Resize it below 60 megapixels and try again.');
    const name = file.name.replace(/\.[^.]+$/, '');
    const frozen = document.createElement('canvas');
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth,image.naturalHeight));
    frozen.width = Math.round(image.naturalWidth*scale);frozen.height = Math.round(image.naturalHeight*scale);
    frozen.getContext('2d').drawImage(image,0,0,frozen.width,frozen.height);
    setSource(frozen, name, 'YOUR IMAGE · PROCESSED ON YOUR DEVICE');
    state.credit = '';
    $('#upload-note').textContent = `${file.name} · ${image.naturalWidth} × ${image.naturalHeight} px. Converted on your device.`;
    $('#drop-zone strong').textContent = 'Choose another image';
    $('#drop-zone span').textContent = 'or drop one here to replace it';
    setStatus(file.type === 'image/gif' ? 'Converted a single frame. Adjust the settings to make it yours.' : 'Your image is ready. Adjust the settings to make it yours.');
  } catch (error) { if (request === state.request) setStatus(error.message, true); }
  finally { URL.revokeObjectURL(url); $('#file-input').value = ''; if (request === state.request) setBusy(false); }
}

function resetSettings() {
  $('#width').value = 100;
  $('#contrast').value = 1.2;
  $('#character-set').value = 'classic';
  $('#invert').checked = false;
  state.zoom = 1;
  render();
  notify('Settings reset. A fresh start.');
}

function closeDownload() {
  $('#download-menu').hidden = true;
  $('#download-button').setAttribute('aria-expanded', 'false');
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');link.href = url;link.download = filename;
  document.body.append(link);link.click();link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportArt(format) {
  closeDownload();
  if (!state.text || state.busy) return;
  const filename = safeFilename(state.name);
  const attribution = state.credit ? `${state.credit}\n${state.sourceURL}` : '';
  if (format === 'txt') {
    saveBlob(new Blob([state.text + (attribution ? `\n\n${attribution}\n` : '\n')], { type: 'text/plain;charset=utf-8' }), `${filename}.txt`);
    notify('Plain text, ready to go.');return;
  }
  const lines = state.text.split('\n');
  const font = 16, lineHeight = 16.64, padding = 40;
  const width = Math.ceil(state.dimensions.width * font * .6 + padding * 2);
  const attributionLines = attribution ? wrapText(attribution.replace(/\n/g,' '), Math.max(35, Math.floor((width-padding*2)/6))) : [];
  const height = Math.ceil(lines.length * lineHeight + padding * 2 + (attributionLines.length ? attributionLines.length * 12 + 20 : 0));
  const footerY = height - padding - attributionLines.length * 12;
  if (format === 'svg') {
    const footer = attributionLines.map((line,i) => `<text x="${padding}" y="${footerY + i * 12}" font-size="9">${escapeXML(line)}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${escapeXML(state.name)} — ASCII Studio</title><desc>${escapeXML(attribution)}</desc><rect width="100%" height="100%" fill="#bee8a9"/><g fill="#171c14" font-family="'Courier New',monospace" font-size="${font}" font-weight="600" xml:space="preserve">${lines.map((line,i) => `<text x="${padding}" y="${padding+font+i*lineHeight}">${escapeXML(line)}</text>`).join('')}${footer}</g></svg>`;
    saveBlob(new Blob([svg], {type:'image/svg+xml'}), `${filename}.svg`);notify('SVG exported, characters and all.');return;
  }
  const canvas = document.createElement('canvas');canvas.width = width;canvas.height = height;
  const ctx = canvas.getContext('2d');ctx.fillStyle = '#bee8a9';ctx.fillRect(0,0,width,height);ctx.fillStyle = '#171c14';ctx.font = `600 ${font}px "Courier New",monospace`;ctx.textBaseline = 'top';
  lines.forEach((line,i) => ctx.fillText(line,padding,padding+i*lineHeight));
  ctx.font = '9px "Courier New",monospace';attributionLines.forEach((line,i) => ctx.fillText(line,padding,footerY+i*12));
  canvas.toBlob(blob => { if (blob) { saveBlob(blob,`${filename}.png`);notify('PNG exported. Made for sharing.'); } else notify('Could not export this image. Please try TXT instead.'); },'image/png');
}

function wrapText(text, max) {
  const words = text.split(' '), lines = [];let line = '';
  for (let word of words) {
    while (word.length > max) { if (line) {lines.push(line);line='';} lines.push(word.slice(0,max));word=word.slice(max); }
    if ((line + word).length > max) {lines.push(line.trim());line='';}
    line += `${word} `;
  }
  if (line) lines.push(line.trim());
  return lines;
}

async function copyArt() {
  if (!state.text || state.busy) return;
  const text = state.text + (state.credit ? `\n\n${state.credit}\n${state.sourceURL}` : '');
  try {
    await navigator.clipboard.writeText(text);
    $('#copy-button span').textContent = 'Copied!';
    notify('Copied. Paste with a monospace font.');
    setTimeout(() => { $('#copy-button span').textContent = 'Copy art'; },2000);
  } catch {
    const area = document.createElement('textarea');area.value = text;area.style.cssText = 'position:fixed;left:-9999px';document.body.append(area);area.select();
    const ok = document.execCommand('copy');area.remove();
    notify(ok ? 'Copied. Paste with a monospace font.' : 'Clipboard unavailable. Use Download → Plain text.');
  }
}

function renderLibrary() {
  const search = $('#library-search').value;
  let items = state.category === 'all' ? state.library : state.library.filter(item => item.group === state.category);
  if (search.trim()) items = searchLibrary(items, search, items.length);
  $('#library-results-count').textContent = `${items.length.toLocaleString()} illustrations${search.trim() ? ` matching “${search.trim()}”` : ''}`;
  $('#library-grid').replaceChildren();
  for (const item of items.slice(0,state.limit)) {
    const button = document.createElement('button');button.className='library-item';button.setAttribute('aria-label',`Create ${item.name}`);
    const img = document.createElement('img');img.src=assetURL(item);img.alt='';img.loading='lazy';
    img.onerror = () => { img.style.visibility='hidden'; };
    const label = document.createElement('span');label.textContent=item.name;
    button.append(img,label);button.addEventListener('click',() => { $('#library-dialog').close();switchTab('imagine');selectArt(item,{scroll:true}); });
    $('#library-grid').append(button);
  }
  if (!items.length) { const empty=document.createElement('p');empty.textContent='No matches yet. Try a simpler word, or use online photo search in the studio.';empty.style.cssText='grid-column:1/-1;padding:25px 0;font-size:13px';$('#library-grid').append(empty); }
  $('#load-more').hidden = items.length <= state.limit;
}

async function renderStarters() {
  for (const starter of STARTERS) {
    const item = state.library.find(x => x.id === starter.id);if (!item) continue;
    const button = document.createElement('button');button.className='starter-card';button.setAttribute('aria-label',`Create ${item.name}`);
    const art = document.createElement('div');art.className='starter-art';const pre=document.createElement('pre');pre.setAttribute('aria-hidden','true');art.append(pre);
    const info = document.createElement('div');info.className='starter-info';const title=document.createElement('span');title.textContent=starter.title;const category=document.createElement('span');category.textContent=starter.category;info.append(title,category);button.append(art,info);
    button.addEventListener('click',() => { switchTab('imagine');selectArt(item,{scroll:true}); });$('#starter-grid').append(button);
    try { pre.textContent = makeAscii(await libraryImage(item),66,{contrast:1.3}).text; } catch { pre.textContent='[ + ]'; }
  }
}

function expandCanvas() {
  const expanded = $('#preview-panel').classList.toggle('expanded');
  $('#expand-button').setAttribute('aria-pressed',String(expanded));
  $('#expand-button').setAttribute('aria-label',expanded?'Close expanded canvas':'Expand canvas');
  $('#expand-button').title=expanded?'Close expanded canvas (Esc)':'Expand canvas';
  document.body.style.overflow=expanded?'hidden':'';
  fitArt();
}

$('#prompt-form').addEventListener('submit',event => { event.preventDefault();generate(); });
$$('[data-prompt]').forEach(button => button.addEventListener('click',() => { $('#prompt').value=button.dataset.prompt;generate(); }));
$('#imagine-tab').addEventListener('click',() => switchTab('imagine'));
$('#upload-tab').addEventListener('click',() => switchTab('upload'));
$$('[role=tab]').forEach(tab => tab.addEventListener('keydown',event => { if (['ArrowLeft','ArrowRight'].includes(event.key)) {event.preventDefault();const next=tab.id==='imagine-tab'?'upload':'imagine';switchTab(next);$(`#${next}-tab`).focus();} }));
$('#online-search-toggle').addEventListener('click',() => { state.online=!state.online;$('#online-search-toggle').setAttribute('aria-pressed',String(state.online));$('#online-search-toggle').textContent=state.online?'Online photos on · use illustrations instead':'Search online photos instead';setStatus(state.online?'Your search terms will be sent to Wikipedia to find a source photo.':'Illustration library selected.'); });
$('#drop-zone').addEventListener('click',() => $('#file-input').click());
$('#file-input').addEventListener('change',event => uploadImage(event.target.files[0]));
['dragenter','dragover'].forEach(name => $('#drop-zone').addEventListener(name,event => {event.preventDefault();$('#drop-zone').classList.add('drag-over');}));
['dragleave','drop'].forEach(name => $('#drop-zone').addEventListener(name,event => {event.preventDefault();$('#drop-zone').classList.remove('drag-over');}));
$('#drop-zone').addEventListener('drop',event => uploadImage(event.dataTransfer.files[0]));
window.addEventListener('dragover',event => event.preventDefault());
window.addEventListener('drop',event => event.preventDefault());
['width','contrast','character-set','invert'].forEach(id => $(`#${id}`).addEventListener('input',render));
$('#reset-button').addEventListener('click',resetSettings);
$('#copy-button').addEventListener('click',copyArt);
$('#download-button').addEventListener('click',() => {const open=$('#download-menu').hidden;$('#download-menu').hidden=!open;$('#download-button').setAttribute('aria-expanded',String(open));if(open) $('#download-menu button').focus();});
$$('[data-download]').forEach(button => button.addEventListener('click',() => exportArt(button.dataset.download)));
document.addEventListener('click',event => {if(!event.target.closest('.download-wrap'))closeDownload();});
$('#download-menu').addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const buttons=$$('#download-menu button');const index=buttons.indexOf(document.activeElement);buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}});
$('#zoom-in').addEventListener('click',() => {state.zoom=Math.min(3,state.zoom+.25);fitArt();});
$('#zoom-out').addEventListener('click',() => {state.zoom=Math.max(.5,state.zoom-.25);fitArt();});
$('#zoom-fit').addEventListener('click',() => {state.zoom=1;fitArt();});
$('#expand-button').addEventListener('click',expandCanvas);
$('#shuffle-button').addEventListener('click',()=>{const pool=state.library.filter(item=>LOCAL_IDS.has(item.id)&&item.name!==state.name);if(pool.length)selectArt(pool[Math.floor(Math.random()*pool.length)]);});
$$('[data-open-library]').forEach(button=>button.addEventListener('click',()=>{renderLibrary();$('#library-dialog').showModal();$('#library-search').focus();}));
$('#about-button').addEventListener('click',()=>$('#about-dialog').showModal());
$$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
let searchTimer;$('#library-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.limit=40;renderLibrary();},150);});
$$('[data-category]').forEach(button=>button.addEventListener('click',()=>{state.category=button.dataset.category;state.limit=40;$$('[data-category]').forEach(b=>b.classList.toggle('selected',b===button));renderLibrary();}));
$('#load-more').addEventListener('click',()=>{state.limit+=40;renderLibrary();});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!$('#imagine-panel').hidden){event.preventDefault();generate();}if(event.key==='Escape'){closeDownload();if($('#preview-panel').classList.contains('expanded'))expandCanvas();}});
new ResizeObserver(fitArt).observe($('#canvas-viewport'));

async function init() {
  setBusy(true,'Warming up the characters…');
  try {
    state.library = await fetchJSON('./assets/library.json');
    $('#library-count').textContent=state.library.length.toLocaleString();
    const butterfly = await readImage('./assets/butterfly.svg');
    setSource(butterfly,'Butterfly study','ORIGINAL STUDY · ASCII STUDIO');
    state.credit='';
    renderStarters();
  } catch(error){setStatus('The studio could not load its library. You can still upload your own image.',true);}
  finally {setBusy(false);}
}
init();
