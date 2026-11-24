import { RAMPS, pixelsToAscii, searchLibrary, filterArchive, artworkCredit, artDimensions, cycleIndex, outputSize, escapeXML, safeFilename } from './core.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STARTERS = [
  { id: 'ascii-bin-128', query: 'skull', title: 'Memento mori', category: 'THE CLASSICS' },
  { id: 'ascii-bin-56', query: 'dragon', title: 'Here be dragons', category: 'FANTASY' },
  { id: 'ascii-bin-254', query: 'cat', title: 'Nine lives in text', category: 'CHARACTERS' },
  { id: 'ascii-bin-219', query: 'rose', title: 'Say it with flowers', category: 'BOTANICAL' },
];
const state = { library: [], source: null, nativeArt: null, matches: [], matchIndex: 0, query: '', matchCategory: 'all', text: '', name: '', credit: '', sourceURL: '', request: 0, busy: false, zoom: 1, category: 'all', limit: 40, dimensions: { width: 100, height: 58 } };
let toastTimer;
state.archives = [];
state.archiveFilter = 'all';
state.matchArchive = 'all';
state.remixing = false;

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
  $('#generate-label').textContent = busy ? 'Making characters…' : 'Find / create ASCII';
  $('#copy-button').disabled = busy || !state.text;
  $('#download-button').disabled = busy || !state.text;
  $('#preview-panel').setAttribute('aria-busy', String(busy));
}

async function fetchJSON(url, timeout = 12000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error(`The library is unavailable (${response.status}). Try an image upload.`);
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
  if (!state.source && !state.nativeArt) return;
  try {
    const result = state.nativeArt && !state.remixing
      ? { text: state.nativeArt.text, ...artDimensions(state.nativeArt.text) }
      : makeAscii(state.source, Number($('#width').value), { ramp: RAMPS[$('#character-set').value], contrast: Number($('#contrast').value), invert: $('#invert').checked });
    state.text = result.text;
    state.dimensions = { width: result.width, height: result.height };
    $('#ascii-output').textContent = result.text;
    $('#ascii-output').setAttribute('aria-label', `ASCII art of ${state.name}, ${result.width} columns by ${result.height} rows`);
    $('#art-title').textContent = `${state.name}${state.remixing ? ' · REMIX' : ''}`.toUpperCase();
    $('#art-dimensions').textContent = `${result.width} × ${result.height}`;
    $('#character-count').textContent = `${result.text.replace(/\n/g, '').length.toLocaleString()} CHARACTERS`;
    const original = Boolean(state.nativeArt) && !state.remixing;
    $('#conversion-settings').hidden = false;
    ['width','contrast','character-set','invert','reset-button'].forEach(id => { $(`#${id}`).disabled = original; });
    $('#remix-button').hidden = !state.nativeArt;
    $('#remix-button').textContent = state.remixing ? 'Restore original artwork' : 'Remix artwork';
    $('#settings-note').textContent = original
      ? 'Viewing the original. Choose Remix artwork to adjust density, contrast, and characters.'
      : state.remixing ? 'Adjusting a converted copy. Restore the original anytime; source credits stay attached.'
      : 'Adjust density, contrast, and characters to make it yours.';
    $('#archive-note').hidden = !state.nativeArt;
    fitArt();
  } catch (error) {
    setStatus(error.name === 'SecurityError' ? 'This image does not allow browser conversion. Download it and use “From an image” instead.' : error.message, true);
  }
}

function setSource(source, name, credit, sourceURL = '') {
  state.source = source;
  state.nativeArt = null;
  state.remixing = false;
  state.matches = [];
  state.name = name;
  state.credit = credit;
  state.sourceURL = sourceURL;
  state.zoom = 1;
  renderCredit(credit, sourceURL);
  renderNavigator();
  render();
}

function renderCredit(credit, sourceURL) {
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
}

function renderNavigator() {
  $('#result-navigator').hidden = !state.matches.length;
  $('#result-count').textContent = `${state.matchIndex + 1} of ${state.matches.length}`;
  $('#result-query').textContent = state.query ? `Matches for “${state.query}”` : 'Browsing the archive';
  $('#previous-art').disabled = $('#next-art').disabled = state.matches.length < 2;
}

function selectArt(item, { matches = state.library, query = '', category = 'all', archive = 'all', scroll = false } = {}) {
  ++state.request;
  state.matches = matches;
  state.matchIndex = matches.findIndex(match => match.id === item.id);
  state.query = query;
  state.matchCategory = category;
  state.matchArchive = archive;
  state.source = null;
  state.nativeArt = item;
  state.remixing = false;
  state.name = item.name;
  state.credit = artworkCredit(item);
  state.sourceURL = item.sourceURL;
  state.zoom = 1;
  const origin = item.origins.find(origin => origin.sourceId === archive) || item.origins[0];
  renderCredit(`${origin.source} · SOURCE ↗`, origin.sourceURL);
  $('#art-author').textContent = origin.author || 'Original artist credit retained in the drawing';
  $('#art-license').textContent = origin.license;
  $('#art-license').href = origin.licenseURL;
  renderNavigator();
  render();
  setBusy(false);
  setStatus(`${matches.length} archive ${matches.length === 1 ? 'match' : 'matches'}. ${item.name}.`);
  if (scroll) $('#studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cycleArt(step) {
  if (!state.matches.length) return;
  const item = state.matches[cycleIndex(state.matchIndex, step, state.matches.length)];
  selectArt(item, { matches: state.matches, query: state.query, category: state.matchCategory, archive: state.matchArchive });
}

function toggleRemix() {
  if (!state.nativeArt) return;
  state.remixing = !state.remixing;
  if (state.remixing) {
    const lines = state.nativeArt.text.split('\n');
    const size = artDimensions(state.nativeArt.text);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 2400 / Math.max(size.width * 9.6 + 20, size.height * 16.64 + 20));
    canvas.width = Math.ceil((size.width * 9.6 + 20) * scale);
    canvas.height = Math.ceil((size.height * 16.64 + 20) * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#000';ctx.font = '16px "Courier New", monospace';ctx.textBaseline = 'top';
    lines.forEach((line, i) => ctx.fillText(line, 10, 10 + i * 16.64));
    state.source = canvas;
  } else state.source = null;
  state.credit = `${state.remixing ? 'Remixed from original ASCII artwork.\n' : ''}${artworkCredit(state.nativeArt)}`;
  state.zoom = 1;
  render();
  setStatus(state.remixing ? 'Remix ready. Adjust the controls below.' : 'Original artwork restored, character for character.');
}

async function generate() {
  const prompt = $('#prompt').value.trim();
  if (!prompt) { setStatus('Give your idea a few words first.', true); $('#prompt').focus(); return; }
  ++state.request;
  setStatus('');
  setBusy(true, 'Finding the right characters…');
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
    const matches = searchLibrary(state.library, prompt);
    if (matches.length) selectArt(matches[0], { matches, query: prompt });
    else {
      state.matches = [];
      renderNavigator();
      setStatus(`No archive matches for “${prompt}” yet. Try a simpler keyword, explore the library, or upload an image to create it. The previous artwork is still on the canvas.`, true);
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally { setBusy(false); }
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
  let items = filterArchive(state.library, state.archiveFilter, state.category);
  if (search.trim()) items = searchLibrary(items, search, items.length);
  $('#library-results-count').textContent = `${items.length.toLocaleString()} ASCII artworks${search.trim() ? ` matching “${search.trim()}”` : ''}`;
  thumbnailObserver.disconnect();
  $('#library-grid').replaceChildren();
  for (const item of items.slice(0,state.limit)) {
    const button = document.createElement('button');button.className='library-item';button.setAttribute('aria-label',`View ${item.name}`);
    button.classList.toggle('selected', state.nativeArt?.id === item.id);
    const art = makeThumbnail(item, 'library-art');
    const label = document.createElement('span');label.textContent=item.name;
    const source = document.createElement('small');source.textContent=item.source;
    button.append(art,label,source);button.addEventListener('click',() => {
      $('#library-dialog').close();switchTab('imagine');
      $('#prompt').value = search;
      selectArt(item,{matches:items,query:search,category:state.category,archive:state.archiveFilter,scroll:true});
    });
    $('#library-grid').append(button);
  }
  if (!items.length) { const empty=document.createElement('p');empty.textContent='No archive matches yet. Try a simpler keyword, or create your own from an image in the studio.';empty.style.cssText='grid-column:1/-1;padding:25px 0;font-size:14px';$('#library-grid').append(empty); }
  $('#load-more').hidden = items.length <= state.limit;
  $$('.ascii-thumbnail').forEach(node => thumbnailObserver.observe(node));
}

function makeThumbnail(item, className) {
  const art = document.createElement('div');art.className=`ascii-thumbnail ${className}`;
  const pre=document.createElement('pre');pre.setAttribute('aria-hidden','true');pre.textContent=item.text;
  const size=artDimensions(item.text);art.dataset.columns=size.width;art.dataset.rows=size.height;
  art.append(pre);thumbnailObserver.observe(art);return art;
}

const thumbnailObserver = new ResizeObserver(entries => {
  for (const {target} of entries) {
    const font=Math.min((target.clientWidth-24)/(Number(target.dataset.columns)*.6),(target.clientHeight-24)/(Number(target.dataset.rows)*1.04),12);
    target.querySelector('pre').style.fontSize=`${Math.max(1,font)}px`;
  }
});

function openLibrary(query = '', category = 'all', archive = 'all') {
  state.category=category;state.limit=40;
  state.archiveFilter=archive;
  $('#archive-filter').value=archive;
  $('#library-search').value=query;
  $$('[data-category]').forEach(button=>button.classList.toggle('selected',button.dataset.category===category));
  renderLibrary();$('#library-dialog').showModal();$('#library-search').focus();
}

function renderStarters() {
  for (const starter of STARTERS) {
    const item = state.library.find(x => x.id === starter.id);if (!item) continue;
    const button = document.createElement('button');button.className='starter-card';button.setAttribute('aria-label',`Browse ${starter.query} ASCII art`);
    const art = makeThumbnail(item, 'starter-art');
    const info = document.createElement('div');info.className='starter-info';const title=document.createElement('span');title.textContent=starter.title;const category=document.createElement('span');category.textContent=starter.category;info.append(title,category);button.append(art,info);
    button.addEventListener('click',() => { switchTab('imagine');$('#prompt').value=starter.query;selectArt(item,{matches:searchLibrary(state.library,starter.query),query:starter.query,scroll:true}); });$('#starter-grid').append(button);
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
$('#previous-art').addEventListener('click',()=>cycleArt(-1));
$('#next-art').addEventListener('click',()=>cycleArt(1));
$('#view-matches').addEventListener('click',()=>openLibrary(state.query,state.matchCategory,state.matchArchive));
$('#archive-filter').addEventListener('change',event=>{state.archiveFilter=event.target.value;state.limit=40;renderLibrary();});
$('#ascii-output').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)&&state.matches.length){event.preventDefault();cycleArt(event.key==='ArrowLeft'?-1:1);}});
$('#drop-zone').addEventListener('click',() => $('#file-input').click());
$('#file-input').addEventListener('change',event => uploadImage(event.target.files[0]));
['dragenter','dragover'].forEach(name => $('#drop-zone').addEventListener(name,event => {event.preventDefault();$('#drop-zone').classList.add('drag-over');}));
['dragleave','drop'].forEach(name => $('#drop-zone').addEventListener(name,event => {event.preventDefault();$('#drop-zone').classList.remove('drag-over');}));
$('#drop-zone').addEventListener('drop',event => uploadImage(event.dataTransfer.files[0]));
window.addEventListener('dragover',event => event.preventDefault());
window.addEventListener('drop',event => event.preventDefault());
['width','contrast','character-set','invert'].forEach(id => $(`#${id}`).addEventListener('input',render));
$('#reset-button').addEventListener('click',resetSettings);
$('#remix-button').addEventListener('click',toggleRemix);
$('#copy-button').addEventListener('click',copyArt);
$('#download-button').addEventListener('click',() => {const open=$('#download-menu').hidden;$('#download-menu').hidden=!open;$('#download-button').setAttribute('aria-expanded',String(open));if(open) $('#download-menu button').focus();});
$$('[data-download]').forEach(button => button.addEventListener('click',() => exportArt(button.dataset.download)));
document.addEventListener('click',event => {if(!event.target.closest('.download-wrap'))closeDownload();});
$('#download-menu').addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const buttons=$$('#download-menu button');const index=buttons.indexOf(document.activeElement);buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}});
$('#zoom-in').addEventListener('click',() => {state.zoom=Math.min(3,state.zoom+.25);fitArt();});
$('#zoom-out').addEventListener('click',() => {state.zoom=Math.max(.5,state.zoom-.25);fitArt();});
$('#zoom-fit').addEventListener('click',() => {state.zoom=1;fitArt();});
$('#expand-button').addEventListener('click',expandCanvas);
$('#shuffle-button').addEventListener('click',()=>{const pool=state.library.filter(item=>item.name!==state.name);if(pool.length){switchTab('imagine');$('#prompt').value='';selectArt(pool[Math.floor(Math.random()*pool.length)]);}});
$$('[data-open-library]').forEach(button=>button.addEventListener('click',()=>openLibrary()));
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
    const [library, metadata] = await Promise.all([fetchJSON('./assets/library.json'),fetchJSON('./assets/archives.json')]);
    state.library = library;
    state.archives = metadata.sources;
    $('#archive-count').textContent=state.archives.length;
    for (const source of state.archives) {
      const option=document.createElement('option');option.value=source.id;option.textContent=`${source.name} (${source.count.toLocaleString()})`;$('#archive-filter').append(option);
    }
    $('#library-count').textContent=state.library.length.toLocaleString();
    const matches = searchLibrary(state.library, 'cat');
    $('#prompt').value = 'cat';
    selectArt(matches[0], {matches, query:'cat'});
    renderStarters();
  } catch(error){setStatus('The studio could not load its library. You can still upload your own image.',true);}
  finally {setBusy(false);}
}
init();
