'use strict';

async function callAI(userMessage, systemPrompt = '') {
  const res = await fetch('https://stageflow-server-main.onrender.com/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage, system: systemPrompt })
  });
  const data = await res.json();
  return data.reply;
}

const LASTFM_API_KEY      = '4dab2e6b1b2970428ef4976a07231335';
const LASTFM_BASE_URL     = 'https://ws.audioscrobbler.com/2.0/';
const ITUNES_BASE_URL     = 'https://itunes.apple.com/search';
const LYRICS_API_BASE_URL = 'https://api.lyrics.ovh/v1';

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2,'0')}`;
}

function estimateBPM() {
  return Math.floor(Math.random() * 65) + 78;
}

function pickImage(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function renderLyricsHTML(lyricsInput, chordsArr) {
  const lines  = Array.isArray(lyricsInput) ? lyricsInput : String(lyricsInput || '').split('\n');
  const chords = (chordsArr && chordsArr.length) ? chordsArr : ['G','D','Em','C','Am'];
  let chordIdx = 0;
  let html     = '';

  lines.forEach(line => {
    const t = line.trim();
    if (!t) {
      html += '<div class="lyric-line" style="min-height:8px;"></div>';
      return;
    }
    if (/^\[.+\]$/.test(t) || /^(verse|chorus|bridge|outro|intro|pre-?chorus)\b/i.test(t)) {
      html += `<div class="lyric-line" style="color:#1db954;font-weight:600;margin-top:12px;">${esc(t)}</div>`;
      return;
    }
    const chord = chords[chordIdx % chords.length];
    chordIdx++;
    html += `<div class="lyric-line">
      <span class="chord" style="display:block;font-size:0.78em;color:#1db954;font-weight:700;line-height:1;margin-bottom:2px;">${esc(chord)}</span>${esc(t)}</div>`;
  });

  return html || '<div class="lyric-line" style="color:#888;">No lyrics available.</div>';
}

async function getUberchord(chordName) {
  try {
    const clean = chordName.replace(/[^A-Za-z#b0-9]/g,'');
    const res   = await fetch(`https://api.uberchord.com/v1/chords/${encodeURIComponent(clean)}`);
    if (!res.ok) return null;
    const data  = await res.json();
    return Array.isArray(data) && data.length ? data[0] : null;
  } catch { return null; }
}

async function buildChordDiagramsHTML(symbols) {
  if (!symbols || !symbols.length) return '';
  let html = '<h4>Chord Diagrams</h4><div class="chord-diagrams">';
  for (const chord of symbols) {
    const d = await getUberchord(chord);
    html += d
      ? `<div class="diagram"><strong>${esc(d.chordName||chord)}</strong><br>
           <small>Strings: ${esc(d.strings||'N/A')}</small><br>
           <small>Fingering: ${esc(d.fingering||'N/A')}</small></div>`
      : `<div class="diagram"><strong>${esc(chord)}</strong><br><small>No diagram</small></div>`;
  }
  return html + '</div>';
}

async function searchITunes(query, limit = 10) {
  try {
    const url = new URL(ITUNES_BASE_URL);
    url.searchParams.set('term',    query);
    url.searchParams.set('entity',  'song');
    url.searchParams.set('limit',   limit);
    url.searchParams.set('country', 'US');
    const r = await fetch(url);
    return (await r.json()).results || [];
  } catch { return []; }
}

async function getITunesTrackInfo(trackId) {
  try {
    const url = new URL(ITUNES_BASE_URL);
    url.searchParams.set('id',     trackId);
    url.searchParams.set('entity', 'song');
    const r = await fetch(url);
    return (await r.json()).results?.[0] || null;
  } catch { return null; }
}

async function getLyrics(artist, title) {
  try {
    const r = await fetch(`${LYRICS_API_BASE_URL}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
    return (await r.json()).lyrics || '';
  } catch { return ''; }
}

async function getSongChords(title, artist) {
  try {
    const raw    = await callAI(`Chord progression for "${title}" by ${artist}. Return ONLY a JSON array e.g. ["C","G","Am","F"]`);
    const chords = JSON.parse(raw.replace(/```json|```/g,'').trim());
    return Array.isArray(chords) ? chords : [];
  } catch { return []; }
}

async function callLastFM(method, params = {}) {
  const url = new URL(LASTFM_BASE_URL);
  url.searchParams.set('method',  method);
  url.searchParams.set('api_key', LASTFM_API_KEY);
  url.searchParams.set('format',  'json');
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  const r    = await fetch(url);
  const data = await r.json();
  if (data.error) throw new Error(data.message);
  return data;
}

async function searchTracks(query, limit = 10) {
  try { return (await callLastFM('track.search', { track: query, limit })).results.trackmatches.track || []; }
  catch { return []; }
}
async function getTrackInfo(artist, track) {
  try { return (await callLastFM('track.getInfo', { artist, track })).track || null; }
  catch { return null; }
}
async function getArtistInfo(artist) {
  try { return (await callLastFM('artist.getInfo', { artist })).artist || null; }
  catch { return null; }
}
async function getSimilarTracks(artist, track, limit = 5) {
  try { return (await callLastFM('track.getSimilar', { artist, track, limit })).similartracks.track || []; }
  catch { return []; }
}
async function getArtistTopTracks(artist, limit = 10) {
  try { return (await callLastFM('artist.getTopTracks', { artist, limit })).toptracks.track || []; }
  catch { return []; }
}

let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function openModal(id)  { document.getElementById(id).classList.add('active');    document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('active'); document.body.style.overflow = ''; }

document.querySelectorAll('.modal-backdrop').forEach(b => {
  b.addEventListener('click', e => { if (e.target === b) closeModal(b.id); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.active').forEach(m => closeModal(m.id));
});

function renderSongGrid(songs) {
  if (songs) window.songs = songs;
  const list = window.songs || [];

  document.getElementById('songGrid').innerHTML = list.map((s, i) => `
    <div class="song-card" style="position:relative;">
      <div class="song-card-num">#${i+1}</div>
      <div class="song-card-title">${esc(s.title)}</div>
      <div class="song-card-artist">${esc(s.artist || 'Unknown Artist')}</div>
      <div class="song-card-tags">
        ${s.tempo ? `<span class="song-tag">🥁 ${esc(s.tempo)}</span>` : ''}
        ${s.key   ? `<span class="song-tag">🎵 ${esc(s.key)}</span>`   : ''}
        ${(s.tags||[]).slice(0,2).map(t=>`<span class="song-tag">${esc(t)}</span>`).join('')}
        ${s._noLyrics ? `<span class="song-tag song-tag--warn">⚠ No lyrics</span>` : ''}
      </div>
      <button class="song-card-remove" title="Remove" onclick="removeSong(${i})"
        style="position:absolute;top:8px;right:8px;background:transparent;border:none;
               color:#666;font-size:15px;cursor:pointer;padding:2px 6px;border-radius:4px;"
        onmouseenter="this.style.color='#ff4d4d';this.style.background='rgba(255,77,77,.12)'"
        onmouseleave="this.style.color='#666';this.style.background='transparent'">✕</button>
    </div>`).join('');

  document.getElementById('songCount').textContent =
    `${list.length} song${list.length !== 1 ? 's' : ''} ready for the stage`;
}

function removeSong(index) {
  if (!window.songs || index < 0 || index >= window.songs.length) return;
  const removed = window.songs.splice(index, 1)[0];

  const ta = document.getElementById('setlistInput');
  if (ta) ta.value = window.songs
    .map(s => (s.artist && s.artist !== 'Unknown Artist') ? `${s.title} - ${s.artist}` : s.title)
    .join('\n');

  renderSongGrid();

  if (!window.songs.length) {
    document.getElementById('songSection').style.display  = 'none';
    document.getElementById('resultBanner').style.display = 'none';
  }
  showToast(`Removed: ${removed.title}`);
}

let _noLyricsQueue  = [];
let _noLyricsActive = false;

async function processNoLyricsQueue(problemSongs, allSongs) {
  _noLyricsQueue.push(...problemSongs);
  if (!_noLyricsActive) _drainNoLyricsQueue(allSongs);
}

async function _drainNoLyricsQueue(allSongs) {
  if (!_noLyricsQueue.length) { _noLyricsActive = false; return; }
  _noLyricsActive = true;
  const song = _noLyricsQueue.shift();
  await _showNoLyricsDialog(song, allSongs);
  _drainNoLyricsQueue(allSongs);
}

async function _showNoLyricsDialog(song, allSongs) {
  return new Promise(async resolve => {
    let suggestionSong = null;
    const suggestionPromise = callAI(
      `A user typed "${song.original}" but no lyrics were found. ` +
      `The detected title is "${song.title}" by "${song.artist || 'unknown artist'}". ` +
      `Suggest ONE likely song they might have meant if this looks like a typo or obscure variant. ` +
      `Return ONLY a JSON object: {"title":"...","artist":"...","reason":"..."} ` +
      `or null if this song clearly exists but just has no online lyrics.`
    ).then(raw => {
      try {
        const clean = raw.replace(/```json|```/g,'').trim();
        return clean === 'null' ? null : JSON.parse(clean);
      } catch { return null; }
    }).catch(() => null);

    let modal = document.getElementById('noLyricsModal');
    if (!modal) {
      modal = Object.assign(document.createElement('div'), {
        id: 'noLyricsModal',
        className: 'modal-backdrop'
      });
      modal.innerHTML = `
        <div class="modal" style="max-width:500px;">
          <div class="modal-hd">
            <div>
              <div class="modal-title">No Lyrics Found</div>
              <div class="modal-sub" id="nlmSub"></div>
            </div>
          </div>
          <div class="modal-body">
            <div id="nlmBody"></div>
            <div id="nlmSuggestion" style="display:none;" class="nlm-suggestion"></div>
            <div class="nlm-actions" id="nlmActions"></div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }

    const sub     = document.getElementById('nlmSub');
    const body    = document.getElementById('nlmBody');
    const suggBox = document.getElementById('nlmSuggestion');
    const actions = document.getElementById('nlmActions');

    sub.textContent = `"${song.title}" — ${song.artist || 'Unknown Artist'}`;
    body.innerHTML  = `
      <p style="color:var(--text2);margin-bottom:16px;line-height:1.65;">
        We couldn't find lyrics for this song. It may be an obscure track, a local/indie song,
        or there might be a spelling error in the title or artist name.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <span style="font-size:.8rem;color:var(--text3);">What would you like to do?</span>
      </div>`;

    suggBox.style.display = 'none';
    suggBox.innerHTML     = '';

    actions.innerHTML = `
      <button class="btn-secondary" style="flex:1;min-width:120px;font-size:15px;" onclick="_nlmKeep('${esc(song.title)}','${esc(song.artist||'')}')">
        Keep anyway
      </button>
      <button class="btn-secondary nlm-remove-btn" style="flex:1;min-width:120px;font-size:15px;" onclick="_nlmRemove('${esc(song.title)}','${esc(song.artist||'')}')">
        Remove song
      </button>`;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    modal._resolve = resolve;
    modal._song    = song;
    modal._all     = allSongs;

    const suggestion = await suggestionPromise;
    if (suggestion && suggestion.title) {
      suggBox.style.display = 'block';
      suggBox.innerHTML = `
        <div class="nlm-suggestion-label">Did you mean…?</div>
        <div class="nlm-suggestion-card">
          <div>
            <div class="nlm-suggestion-title">${esc(suggestion.title)}</div>
            <div class="nlm-suggestion-artist">${esc(suggestion.artist)}</div>
            <div class="nlm-suggestion-reason">${esc(suggestion.reason || '')}</div>
          </div>
          <button class="btn-primary" style="flex-shrink:0;padding:8px 16px;font-size:.82rem;"
            onclick="_nlmSwap('${esc(song.title)}','${esc(song.artist||'')}','${esc(suggestion.title)}','${esc(suggestion.artist)}')">
            Use this
          </button>
        </div>`;
    }
  });
}

window._nlmKeep = function(title, artist) {
  const modal = document.getElementById('noLyricsModal');
  const song  = window.songs && window.songs.find(s =>
    s.title.toLowerCase() === title.toLowerCase() &&
    (s.artist||'').toLowerCase() === artist.toLowerCase());
  if (song) song._noLyrics = true;
  renderSongGrid();
  _nlmClose(modal);
};

window._nlmRemove = function(title, artist) {
  const modal = document.getElementById('noLyricsModal');
  if (window.songs) {
    const idx = window.songs.findIndex(s =>
      s.title.toLowerCase() === title.toLowerCase() &&
      (s.artist||'').toLowerCase() === artist.toLowerCase());
    if (idx !== -1) {
      window.songs.splice(idx, 1);
      renderSongGrid();
      if (!window.songs.length) {
        document.getElementById('songSection').style.display  = 'none';
        document.getElementById('resultBanner').style.display = 'none';
      }
      showToast(`Removed: ${title}`);
    }
  }
  _nlmClose(modal);
};

window._nlmSwap = function(oldTitle, oldArtist, newTitle, newArtist) {
  const modal = document.getElementById('noLyricsModal');
  if (window.songs) {
    const song = window.songs.find(s =>
      s.title.toLowerCase() === oldTitle.toLowerCase() &&
      (s.artist||'').toLowerCase() === oldArtist.toLowerCase());
    if (song) {
      song.title         = newTitle;
      song.artist        = newArtist;
      song._noLyrics     = false;
      song._lyricsLoaded = false;
      song._chordsLoaded = false;
      delete song.lyrics;
      delete song.chords;
      const ta = document.getElementById('setlistInput');
      if (ta) ta.value = window.songs
        .map(s => (s.artist && s.artist !== 'Unknown Artist') ? `${s.title} - ${s.artist}` : s.title)
        .join('\n');
      renderSongGrid();
      showToast(`Swapped to: ${newTitle} — ${newArtist}`);
    }
  }
  _nlmClose(modal);
};

function _nlmClose(modal) {
  modal.classList.remove('active');
  document.body.style.overflow = '';
  if (modal._resolve) { modal._resolve(); modal._resolve = null; }
}

async function handleAnalyze() {
  const input = document.getElementById('setlistInput').value.trim();
  if (!input) return;

  const btn = document.getElementById('analyzeBtn');
  btn.disabled  = true;
  btn.innerHTML = `<span style="display:flex;gap:4px"><span class="ld"></span><span class="ld"></span><span class="ld"></span></span> Analyzing…`;

  document.getElementById('resultBanner').style.display       = 'none';
  document.getElementById('autocorrectSection').style.display = 'none';
  document.getElementById('songSection').style.display        = 'none';

  const overlay = document.getElementById('analyzeOverlay');
  const bar     = document.getElementById('analyzeBar');
  const step    = document.getElementById('analyzeStep');

  function setProgress(pct, label) {
    bar.style.width  = `${pct}%`;
    step.textContent = label;
  }

  overlay.style.display = 'flex';
  setProgress(5, 'Reading your setlist…');

  try {
    const lines = input.split('\n').map(l => l.trim()).filter(Boolean);

    setProgress(20, 'Sending to AI for analysis…');

    const raw = await callAI(`You are a music expert for a live performance app.
Setlist (one entry per line, format "Song - Artist"):
${lines.join('\n')}

Return ONLY a JSON array — no markdown, no explanation:
[{"original":"...","corrected":"...","title":"...","artist":"...","tempo":"~120 BPM","key":"A minor","tags":["rock"],"changed":true}]`);

    setProgress(55, 'Processing song data…');

    let parsed;
    try   { parsed = JSON.parse(raw.replace(/```json|```/g,'').trim()); }
    catch { parsed = lines.map(l => { const [t,a]=l.split('-').map(s=>s.trim()); return {original:l,corrected:l,title:t||l,artist:a||'',changed:false,tags:[]}; }); }

    window.songs = parsed.map(song => {
      const rich = (window.pendingSongs||[]).find(p =>
        p.title.toLowerCase()===song.title.toLowerCase() &&
        p.artist.toLowerCase()===song.artist.toLowerCase());
      return { ...song, ...(rich||{}) };
    });
    window.pendingSongs = [];

    setProgress(72, 'Checking song corrections…');

    const fixes  = parsed.filter(p => p.changed);
    const banner = document.getElementById('resultBanner');
    banner.textContent = fixes.length
      ? `Analyzed ${parsed.length} song(s) — ${fixes.length} autocorrection(s) applied.`
      : `Analyzed ${parsed.length} song(s) — everything looks great!`;
    banner.style.display = 'block';

    if (fixes.length) {
      document.getElementById('autocorrectList').innerHTML = fixes.map(ac => `
        <div class="autocorrect-item">
          <span class="ac-original">${esc(ac.original)}</span>
          <span class="ac-arrow">→</span>
          <span class="ac-corrected">${esc(ac.corrected)}</span>
          <span class="ac-badge">Fixed</span>
        </div>`).join('');
      document.getElementById('autocorrectSection').style.display = 'block';
    }

    setProgress(85, 'Checking lyrics availability…');

    renderSongGrid(parsed);
    document.getElementById('songSection').style.display = 'block';

    const problemSongs = [];
    const lyricsChecks = parsed.map(async song => {
      if (song._lyricsLoaded && song.lyrics && song.lyrics.length) return;
      const lyr = await getLyrics(song.artist || 'Unknown', song.title);
      if (!lyr || !lyr.trim()) {
        problemSongs.push(song);
      } else {
        song.lyrics        = lyr.split('\n');
        song._lyricsLoaded = true;
      }
    });

    await Promise.all(lyricsChecks);

    setProgress(100, 'Done!');
    await new Promise(r => setTimeout(r, 420));

    overlay.style.display = 'none';
    setProgress(0, '');

    if (problemSongs.length) {
      processNoLyricsQueue(problemSongs, window.songs);
    }

  } catch (err) {
    console.error('Analysis error:', err);
    overlay.style.display = 'none';
    setProgress(0, '');
    const banner = document.getElementById('resultBanner');
    banner.textContent = 'Analysis failed. Check your connection and try again.';
    banner.style.display = 'block';
  }

  btn.disabled  = false;
  btn.innerHTML = 'Add to Setlist';
}

async function runLookup() {
  const query = document.getElementById('lookupInput').value.trim();
  if (!query) return;

  document.getElementById('lookupLoading').style.display = 'flex';
  document.getElementById('lookupResults').innerHTML     = '';

  try {
    const [lfmResults, itunesResults] = await Promise.all([
      searchTracks(query, 6),
      searchITunes(query, 6)
    ]);

    const combined = [];

    if (lfmResults.length) {
      const enhanced = await Promise.all(lfmResults.map(async t => {
        const info = await getTrackInfo(t.artist, t.name).catch(() => null);
        const image = pickImage(
          t.image?.[3]?.['#text'],
          t.image?.[2]?.['#text'],
          t.image?.[1]?.['#text'],
          t.image?.[0]?.['#text']
        );
        return {
          title:     t.name,
          artist:    t.artist,
          year:      info?.wiki?.published ? new Date(info.wiki.published).getFullYear() : '',
          genre:     info?.toptags?.tag?.[0]?.name || '',
          album:     info?.album?.title || '',
          ytQuery:   `${t.name} ${t.artist} official audio`,
          listeners: parseInt(t.listeners)||0,
          image,
          source:    'lastfm'
        };
      }));
      combined.push(...enhanced);
    }

    if (itunesResults.length) {
      combined.push(...itunesResults.map(t => ({
        title:      t.trackName,
        artist:     t.artistName,
        album:      t.collectionName || '',
        genre:      t.primaryGenreName || '',
        year:       t.releaseDate ? new Date(t.releaseDate).getFullYear() : '',
        duration:   t.trackTimeMillis ? Math.floor(t.trackTimeMillis/1000) : 0,
        previewUrl: t.previewUrl || '',
        artworkUrl: t.artworkUrl100 || t.artworkUrl60 || '',
        trackId:    t.trackId,
        source:     'itunes'
      })));
    }

    const seen    = new Set();
    const unique  = combined.filter(r => {
      const k = `${r.title.toLowerCase()}-${r.artist.toLowerCase()}`;
      return seen.has(k) ? false : seen.add(k);
    }).slice(0, 10);

    if (unique.length) {
      renderSuggestions(unique);
    } else {
      const raw  = await callAI(`Music database search: "${query}". Return ONLY JSON array:
[{"title":"...","artist":"...","year":2001,"genre":"rock","album":"...","ytQuery":"title artist official audio"}]`);
      const sugs = JSON.parse(raw.replace(/```json|```/g,'').trim());
      renderSuggestions(sugs.map(s=>({...s,source:'ai'})));
    }
  } catch (err) {
    console.error('Lookup error:', err);
    renderSuggestions([{title:query,artist:'Unknown Artist',year:'',genre:'',ytQuery:query,source:'fallback'}]);
  }

  document.getElementById('lookupLoading').style.display = 'none';
}

function renderSuggestions(suggestions) {
  document.getElementById('lookupResults').innerHTML = suggestions.map(song => {
    const imgSrc = pickImage(song.artworkUrl, song.image);
    return `
    <div class="lookup-item">
      <div class="lookup-main">
        ${imgSrc
          ? `<img class="lookup-artwork" src="${esc(imgSrc)}" alt="art"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="lookup-artwork-placeholder" style="display:none;">🎵</div>`
          : '<div class="lookup-artwork-placeholder">🎵</div>'}
        <div class="lookup-info">
          <div class="lookup-title">${esc(song.title)}</div>
          <div class="lookup-artist">${esc(song.artist)}</div>
          <div class="lookup-meta">
            ${song.album    ? `<span class="lookup-album">${esc(song.album)}</span>`   : ''}
            ${song.year     ? `<span class="lookup-year">${esc(song.year)}</span>`     : ''}
            ${song.genre    ? `<span class="lookup-genre">${esc(song.genre)}</span>`   : ''}
            ${song.duration ? `<span class="lookup-duration">${formatDuration(song.duration)}</span>` : ''}
            ${song.listeners ? `<span class="lookup-listeners">${parseInt(song.listeners).toLocaleString()} listeners</span>` : ''}
          </div>
        </div>
      </div>
      <div class="lookup-actions">
        <button class="lookup-btn info-btn"
          onclick="showSongInfo('${esc(song.artist)}','${esc(song.title)}','${esc(song.source)}','${esc(song.trackId||'')}')">Info</button>
        ${song.previewUrl ? `<button class="lookup-btn preview-btn"
          onclick="playPreview('${esc(song.previewUrl)}','${esc(song.title)} - ${esc(song.artist)}')">Preview</button>` : ''}
        <button class="lookup-btn yt-btn"
          onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(song.ytQuery||song.title+' '+song.artist)}','_blank')">YouTube</button>
        <button class="lookup-btn add-btn"
          onclick="addToSetlist('${esc(song.title)}','${esc(song.artist)}','${esc(song.source)}','${esc(song.trackId||'')}',${song.listeners||0},'${esc(song.album||'')}','${esc(song.genre||'')}',${song.year||0},${song.duration||0},'${esc(song.artworkUrl||song.image||'')}','${esc(song.previewUrl||'')}')">+ Add</button>
      </div>
    </div>`;
  }).join('');
}

function playPreview(url, title) {
  const audio = document.getElementById('previewAudio');
  if (audio.src === url && !audio.paused) { audio.pause(); showToast(`Paused: ${title}`); }
  else { audio.src = url; audio.play().then(()=>showToast(`Playing: ${title}`)).catch(()=>showToast('Preview not available')); }
}

async function showSongInfo(artist, title, source = 'lastfm', trackId = '') {
  let modal = document.getElementById('songInfoModal');
  if (!modal) {
    modal = Object.assign(document.createElement('div'), { id:'songInfoModal', className:'modal-backdrop' });
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-hd">
          <div><div class="modal-title">Song Information</div><div class="modal-sub" id="songInfoTitle"></div></div>
          <button class="modal-close" onclick="closeModal('songInfoModal')">✕</button>
        </div>
        <div class="modal-body" id="songInfoContent"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target===modal) closeModal('songInfoModal'); });
  }

  document.getElementById('songInfoTitle').textContent = `${title} — ${artist}`;
  document.getElementById('songInfoContent').innerHTML =
    '<div class="loading-row"><div class="ld"></div><div class="ld"></div><div class="ld"></div></div>';
  openModal('songInfoModal');

  try {
    const [lfmTrack, lfmArtist, similar, lyricsText, songChords] = await Promise.all([
      getTrackInfo(artist, title),
      getArtistInfo(artist),
      getSimilarTracks(artist, title, 5),
      getLyrics(artist, title),
      getSongChords(title, artist)
    ]);

    const itunesData = (source==='itunes' && trackId) ? await getITunesTrackInfo(trackId) : null;

    if (window.songs) {
      const match = window.songs.find(s =>
        s.title.toLowerCase()===title.toLowerCase() && s.artist.toLowerCase()===artist.toLowerCase());
      if (match) {
        if (lyricsText && !match._lyricsLoaded) { match.lyrics=lyricsText.split('\n'); match._lyricsLoaded=true; }
        if (songChords.length && !match._chordsLoaded) { match.chords=songChords; match._chordsLoaded=true; }
        const dur = itunesData?.trackTimeMillis ? Math.floor(itunesData.trackTimeMillis/1000)
          : (Number(lfmTrack?.duration)>0 ? Math.floor(Number(lfmTrack.duration)/1000) : 0);
        if (dur>0) match.duration = dur;
      }
    }

    const artworkSrc = pickImage(
      itunesData?.artworkUrl100, itunesData?.artworkUrl60,
      lfmTrack?.album?.image?.[3]?.['#text'], lfmTrack?.album?.image?.[2]?.['#text']
    );
    const bpm = estimateBPM();
    let content = '';

    content += `<div class="song-info-section" style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
      ${artworkSrc ? `<div class="song-info-artwork">
        <img src="${esc(artworkSrc)}" alt="art" onerror="this.parentElement.style.display='none'"
          style="width:120px;height:120px;border-radius:8px;object-fit:cover;"></div>` : ''}
      <div class="song-info-details" style="flex:1;min-width:160px;">
        <h3 style="margin:0 0 8px;">${esc(title)}</h3>
        <p><strong>Artist:</strong> ${esc(artist)}</p>
        ${(itunesData?.collectionName||lfmTrack?.album?.title) ? `<p><strong>Album:</strong> ${esc(itunesData?.collectionName||lfmTrack.album.title)}</p>` : ''}
        ${(itunesData?.primaryGenreName||lfmTrack?.toptags?.tag?.length) ? `<p><strong>Genre:</strong> ${esc(itunesData?.primaryGenreName||lfmTrack.toptags.tag.slice(0,3).map(t=>t.name).join(', '))}</p>` : ''}
        ${itunesData?.trackTimeMillis ? `<p><strong>Duration:</strong> ${formatDuration(Math.floor(itunesData.trackTimeMillis/1000))}</p>`
          : (Number(lfmTrack?.duration)>0 ? `<p><strong>Duration:</strong> ${formatDuration(Math.floor(Number(lfmTrack.duration)/1000))}</p>` : '')}
        ${lfmTrack?.listeners ? `<p><strong>Listeners:</strong> ${parseInt(lfmTrack.listeners).toLocaleString()}</p>` : ''}
        ${lfmTrack?.playcount  ? `<p><strong>Play Count:</strong> ${parseInt(lfmTrack.playcount).toLocaleString()}</p>`  : ''}
        <p><strong>Est. BPM:</strong> ${bpm}</p>
        ${itunesData?.previewUrl ? `<p><button class="preview-btn" onclick="playPreview('${esc(itunesData.previewUrl)}','${esc(title)} - ${esc(artist)}')">▶ Play Preview</button></p>` : ''}
      </div>
    </div>`;

    if (songChords.length) {
      content += `<div class="song-info-section">
        <h4>Chords</h4>
        <div class="chords-display">${songChords.map(c=>`<span class="chord-tag">${esc(c)}</span>`).join(' ')}</div>
      </div>`;
      const diag = await buildChordDiagramsHTML(songChords);
      if (diag) content += `<div class="song-info-section">${diag}</div>`;
    }

    if (lyricsText) {
      const lines = lyricsText.split('\n');
      content += `<div class="song-info-section">
        <h4>Lyrics</h4>
        <div class="lyrics-preview">
          ${renderLyricsHTML(lines.slice(0,24), songChords)}
          ${lines.length>24 ? '<div class="lyric-line" style="color:#888;">…</div>' : ''}
        </div>
        <div style="margin-top:10px;">
          <a href="https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(artist+' '+title)}"
             target="_blank" style="color:#1db954;font-weight:bold;font-size:14px;">
            Get exact chords on Ultimate Guitar →</a>
        </div>
      </div>`;
    }

    if (lfmArtist?.bio?.summary) {
      const bio = lfmArtist.bio.summary.replace(/<[^>]*>/g,'').replace(/Read more.*$/i,'').trim();
      if (bio) content += `<div class="song-info-section"><h4>About ${esc(artist)}</h4><p>${esc(bio)}</p></div>`;
    }

    if (similar?.length) {
      content += `<div class="song-info-section"><h4>Similar Songs</h4><div class="similar-songs">
        ${similar.slice(0,5).map(t=>`<div class="similar-song"
          onclick="showSongInfo('${esc(t.artist.name)}','${esc(t.name)}')">
          <span class="similar-title">${esc(t.name)}</span>
          <span class="similar-artist">by ${esc(t.artist.name)}</span></div>`).join('')}
      </div></div>`;
    }

    if (lfmArtist) {
      const tops = await getArtistTopTracks(artist, 5);
      if (tops.length) {
        content += `<div class="song-info-section"><h4>Popular by ${esc(artist)}</h4><div class="popular-tracks">
          ${tops.slice(0,5).map((t,i)=>`<div class="popular-track"
            onclick="addToSetlist('${esc(t.name)}','${esc(t.artist?.name||artist)}','lastfm','',${parseInt(t.listeners)||0},'','',0,0,'','')">
            <div class="track-rank">#${i+1}</div>
            <div class="track-info">
              <div class="track-title">${esc(t.name)}</div>
              <div class="track-plays">${parseInt(t.playcount||0).toLocaleString()} plays</div>
            </div>
            <button class="add-small-btn">+</button></div>`).join('')}
        </div></div>`;
      }
    }

    document.getElementById('songInfoContent').innerHTML = content || '<p>No additional information available.</p>';
  } catch (err) {
    console.error('Song info error:', err);
    document.getElementById('songInfoContent').innerHTML = '<p>Failed to load. Please try again.</p>';
  }
}

function addToSetlist(title, artist, source, trackId, listeners, album, genre, year, duration, artworkUrl, previewUrl) {
  if (!window.pendingSongs) window.pendingSongs = [];
  window.pendingSongs.push({ title, artist, album, genre, year, duration, artworkUrl, previewUrl, source, trackId, listeners });

  const line = (artist && artist !== 'Unknown Artist') ? `${title} - ${artist}` : title;
  const ta   = document.getElementById('setlistInput');
  ta.value   = ta.value ? `${ta.value}\n${line}` : line;

  closeModal('lookupModal');
  document.getElementById('lookupInput').value      = '';
  document.getElementById('lookupResults').innerHTML = '<div class="empty-state">Search for a song above, or hold the button to hum / sing</div>';
  showToast(`Added: ${line}`);
}

let _recognition = null;
let _isRecording = false;

(function initHumBtn() {
  const btn = document.getElementById('humBtn');
  if (!btn) return;

  function onHoldStart(e) {
    e.preventDefault();
    if (_isRecording) return;
    startHumListening();
  }

  function onHoldEnd(e) {
    e.preventDefault();
    if (!_isRecording) return;
    stopHumListening();
  }

  btn.addEventListener('mousedown',  onHoldStart);
  btn.addEventListener('touchstart', onHoldStart, { passive: false });
  btn.addEventListener('mouseup',    onHoldEnd);
  btn.addEventListener('mouseleave', onHoldEnd);
  btn.addEventListener('touchend',   onHoldEnd);
  btn.addEventListener('touchcancel',onHoldEnd);
})();

function startHumListening() {
  if (window.plugins && window.plugins.speechRecognition) {
    window.plugins.speechRecognition.hasPermission(
      (hasPerm) => {
        if (hasPerm) {
          _startCordovaSpeech();
        } else {
          window.plugins.speechRecognition.requestPermission(
            () => _startCordovaSpeech(),
            () => showToast('Microphone permission denied')
          );
        }
      },
      () => showToast('Could not check microphone permission')
    );
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voice recognition not supported'); return; }

  _recognition = new SR();
  _recognition.lang             = 'en-US';
  _recognition.interimResults   = false;
  _recognition.maxAlternatives  = 1;
  _recognition.continuous       = false;

  _recognition.onresult = async e => {
    const t = e.results[0][0].transcript;
    setRecording(false);
    const h = document.getElementById('humHeard');
    h.style.display = 'block';
    h.innerHTML = `Heard: <span>"${esc(t)}"</span>`;
    document.getElementById('lookupInput').value = t;
    await runLookup();
  };
  _recognition.onerror = () => { setRecording(false); showToast('Could not hear clearly. Try again.'); };
  _recognition.onend   = () => setRecording(false);
  _recognition.start();
  setRecording(true);
}

function stopHumListening() {
  if (window.plugins && window.plugins.speechRecognition) {
    window.plugins.speechRecognition.stopListening(
      () => setRecording(false),
      () => setRecording(false)
    );
  } else if (_recognition) {
    try { _recognition.stop(); } catch(e) {}
  }
  setRecording(false);
}

function _startCordovaSpeech() {
  setRecording(true);
  window.plugins.speechRecognition.startListening(
    async (matches) => {
      setRecording(false);
      const t = matches && matches[0] ? matches[0] : '';
      if (!t) { showToast('Could not hear clearly. Try again.'); return; }
      const h = document.getElementById('humHeard');
      h.style.display = 'block';
      h.innerHTML = `Heard: <span>"${esc(t)}"</span>`;
      document.getElementById('lookupInput').value = t;
      await runLookup();
    },
    (err) => {
      setRecording(false);
      showToast('Could not hear clearly. Try again.');
      console.error('Speech error:', err);
    },
    { language: 'en-US', matches: 1, showPopup: false }
  );
}

function setRecording(state) {
  _isRecording = state;
  const btn = document.getElementById('humBtn');
  if (state) {
    btn.className = 'hum-btn recording';
    btn.innerHTML = `<div class="rec-dots"><div class="rec-dot"></div><div class="rec-dot"></div><div class="rec-dot"></div></div> Listening… release to stop`;
  } else {
    btn.className = 'hum-btn';
    btn.innerHTML = 'Hold to Hum or Sing — release to search';
  }
}

let currentSongIndex    = 0;
let performanceTimer    = null;
let currentSongDuration = 0;
let currentSongElapsed  = 0;
let isPlaying           = false;

let _scrollTimer     = null;
let _autoScrolling   = true;
let _userScrolling   = false;
let _userScrollTimer = null;

function startAutoScroll() {
  stopAutoScroll();
  _autoScrolling = true;

  function tick() {
    const container = document.getElementById('perfLyricsContainer');
    if (!container || !_autoScrolling || _userScrolling) {
      _scrollTimer = requestAnimationFrame(tick);
      return;
    }
    if (currentSongDuration > 0) {
      const progress  = Math.min(currentSongElapsed / currentSongDuration, 1);
      const maxScroll = container.scrollHeight - container.clientHeight;
      const targetY   = maxScroll * progress;
      const currentY  = container.scrollTop;
      const gap       = targetY - currentY;
      if (Math.abs(gap) > 1) container.scrollTop += gap * 0.03;
    }
    _scrollTimer = requestAnimationFrame(tick);
  }

  _scrollTimer = requestAnimationFrame(tick);

  const container = document.getElementById('perfLyricsContainer');
  if (container) {
    container.addEventListener('touchstart', _onUserScroll,   { passive: true });
    container.addEventListener('mousedown',  _onUserScroll,   { passive: true });
    container.addEventListener('touchend',   _onUserScrollEnd,{ passive: true });
    container.addEventListener('mouseup',    _onUserScrollEnd,{ passive: true });
  }
}

function _onUserScroll() {
  _userScrolling = true;
  clearTimeout(_userScrollTimer);
  _setScrollIndicator(false);
}

function _onUserScrollEnd() {
  clearTimeout(_userScrollTimer);
  _userScrollTimer = setTimeout(() => {
    _userScrolling = false;
    _setScrollIndicator(true);
  }, 4000);
}

function stopAutoScroll() {
  if (_scrollTimer) { cancelAnimationFrame(_scrollTimer); _scrollTimer = null; }
  _autoScrolling = false;
  clearTimeout(_userScrollTimer);
  _userScrolling = false;

  const container = document.getElementById('perfLyricsContainer');
  if (container) {
    container.removeEventListener('touchstart', _onUserScroll);
    container.removeEventListener('mousedown',  _onUserScroll);
    container.removeEventListener('touchend',   _onUserScrollEnd);
    container.removeEventListener('mouseup',    _onUserScrollEnd);
  }
}

function _setScrollIndicator(active) {
  const pill = document.getElementById('autoScrollPill');
  if (!pill) return;
  if (active) {
    pill.textContent       = 'Auto scroll';
    pill.style.background  = 'rgba(0,245,212,.15)';
    pill.style.color       = 'var(--mint)';
    pill.style.borderColor = 'rgba(0,245,212,.3)';
  } else {
    pill.textContent       = 'Manual scroll';
    pill.style.background  = 'rgba(255,255,255,.06)';
    pill.style.color       = 'var(--text3)';
    pill.style.borderColor = 'var(--border)';
  }
}

function toggleAutoScroll() {
  _autoScrolling = !_autoScrolling;
  _userScrolling  = false;
  clearTimeout(_userScrollTimer);
  _setScrollIndicator(_autoScrolling);
}

function startPerformanceMode() {
  if (!window.songs || !window.songs.length) {
    showToast('No songs to perform. Add songs to your setlist first.');
    return;
  }
  if (window.plugins && window.plugins.insomnia) {
    window.plugins.insomnia.keepAwake();
  } else if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(lock => { window._wakeLock = lock; }).catch(() => {});
  }

  document.getElementById('songSection').style.display        = 'none';
  document.getElementById('performanceSection').style.display = 'block';
  currentSongIndex   = 0;
  isPlaying          = false;
  currentSongElapsed = 0;
  _setPlayBtn('▶');
  loadSong(0);
}

function startTimer() {
  stopTimer();
  performanceTimer = setInterval(() => {
    currentSongElapsed++;
    if (currentSongElapsed >= currentSongDuration) {
      currentSongElapsed = currentSongDuration;
      _updateTimerDisplay();
      stopTimer();
      stopAutoScroll();
      nextSong();
    } else {
      _updateTimerDisplay();
    }
  }, 1000);
}

function stopTimer() {
  if (performanceTimer) { clearInterval(performanceTimer); performanceTimer = null; }
}

function _setPlayBtn(label) {
  const btn = document.getElementById('perfPlayBtn');
  if (btn) btn.textContent = label;
}

function _updateTimerDisplay() {
  const fill = document.getElementById('perfProgress');
  if (fill) {
    const pct = currentSongDuration > 0
      ? Math.min(100, (currentSongElapsed / currentSongDuration) * 100) : 0;
    fill.style.width = `${pct}%`;
  }
  const timeEl = document.getElementById('perfTime');
  if (timeEl) {
    const e = Math.min(currentSongElapsed, currentSongDuration);
    const d = currentSongDuration;
    timeEl.textContent =
      `${Math.floor(e/60)}:${String(e%60).padStart(2,'0')} / ${Math.floor(d/60)}:${String(d%60).padStart(2,'0')}`;
  }
}

async function loadSong(index) {
  const song = window.songs[index];

  stopTimer();
  stopAutoScroll();
  currentSongElapsed = 0;

  document.getElementById('perfSongTitle').textContent = song.title;
  document.getElementById('perfSongMeta').textContent  = song.artist || 'Unknown Artist';

  const lyricsContainer = document.getElementById('perfLyricsContainer');
  if (lyricsContainer) lyricsContainer.scrollTop = 0;

  const lyricsEl = document.getElementById('perfLyrics');
  lyricsEl.innerHTML = '<div class="lyric-line" style="color:#888;font-style:italic;">Loading lyrics and chords…</div>';

  currentSongDuration = (song.duration && song.duration > 0) ? song.duration : 210;
  _updateTimerDisplay();
  _setScrollIndicator(true);

  if (song._lyricsLoaded && song._chordsLoaded) {
    lyricsEl.innerHTML  = renderLyricsHTML(song.lyrics, song.chords);
    currentSongDuration = (song.duration && song.duration > 0) ? song.duration : Math.max(60, song.lyrics.length * 3);
    currentSongElapsed  = 0;
    _updateTimerDisplay();
    _loadDiagramsAsync(song.chords);
    if (isPlaying) { startTimer(); startAutoScroll(); }
    return;
  }

  const [fetchedLyricsRaw, fetchedChords] = await Promise.all([
    song._lyricsLoaded ? Promise.resolve('') : getLyrics(song.artist || 'Unknown', song.title),
    song._chordsLoaded ? Promise.resolve([]) : getSongChords(song.title, song.artist || 'Unknown')
  ]);

  let lyrics = song.lyrics?.length ? song.lyrics : null;
  let chords = song.chords?.length ? song.chords : null;
  let tempo  = song.tempo  || '';

  if (!lyrics && fetchedLyricsRaw) {
    lyrics = fetchedLyricsRaw.split('\n');
    song.lyrics = lyrics; song._lyricsLoaded = true;
  }
  if (!chords && fetchedChords.length) {
    chords = fetchedChords;
    song.chords = chords; song._chordsLoaded = true;
  }

  if ((!lyrics || !lyrics.length) || (!chords || !chords.length)) {
    try {
      const raw   = await callAI(`Provide accurate information for "${song.title}" by ${song.artist||'Unknown'}.
Return ONLY valid JSON (no markdown):
{"lyrics":["line 1","line 2","...more lines..."],"chords":["C","G","Am","F"],"tempo":"120 BPM"}`);
      let clean   = raw.trim().replace(/```json\s*/g,'').replace(/```\s*$/g,'');
      const si    = clean.indexOf('{'), ei = clean.lastIndexOf('}')+1;
      if (si>=0&&ei>si) clean = clean.slice(si,ei);
      const data  = JSON.parse(clean);

      if ((!lyrics||!lyrics.length) && Array.isArray(data.lyrics) && data.lyrics.length) {
        lyrics = data.lyrics; song.lyrics = lyrics; song._lyricsLoaded = true;
      }
      if ((!chords||!chords.length) && Array.isArray(data.chords) && data.chords.length) {
        chords = data.chords; song.chords = chords; song._chordsLoaded = true;
      }
      if (!tempo && data.tempo) tempo = typeof data.tempo==='string' ? data.tempo : data.tempo[0]||'';
    } catch (err) { console.error('AI fallback:', err); }
  }

  if (!lyrics || !Array.isArray(lyrics) || !lyrics.length) {
    lyrics = [`[${esc(song.title)}]`, 'Lyrics unavailable.', 'Try searching on Ultimate Guitar.'];
  }
  if (!chords || !Array.isArray(chords) || !chords.length) {
    chords = ['C','G','Am','F'];
  }
  if (!tempo) tempo = `~${estimateBPM()} BPM`;

  song.lyrics = lyrics;
  song.chords = chords;
  song.tempo  = tempo;

  lyricsEl.innerHTML = renderLyricsHTML(lyrics, chords);

  if (!song.duration || song.duration <= 0) song.duration = Math.max(60, lyrics.length * 3);
  currentSongDuration = song.duration;
  currentSongElapsed  = 0;
  _updateTimerDisplay();

  _loadDiagramsAsync(chords);

  if (isPlaying) { startTimer(); startAutoScroll(); }
}

function _loadDiagramsAsync(chords) {
  const el = document.getElementById('perfChordDiagrams');
  if (!el || !chords?.length) return;
  el.innerHTML = '<small style="color:#888;">Loading diagrams…</small>';
  buildChordDiagramsHTML(chords.slice(0,6)).then(h => { el.innerHTML = h; });
}

function togglePerformance() {
  if (!isPlaying) {
    isPlaying = true;
    _setPlayBtn('||');
    startTimer();
    startAutoScroll();
  } else {
    isPlaying = false;
    _setPlayBtn('▶');
    stopTimer();
    stopAutoScroll();
  }
}

function prevSong() {
  if (currentSongIndex > 0) { currentSongIndex--; loadSong(currentSongIndex); }
}

function nextSong() {
  if (currentSongIndex < (window.songs?.length||0)-1) {
    currentSongIndex++;
    loadSong(currentSongIndex);
  } else {
    stopTimer();
    stopAutoScroll();
    isPlaying = false;
    _setPlayBtn('▶');
    showToast('Setlist complete!');
  }
}

function exitPerformanceMode() {
  stopTimer();
  stopAutoScroll();
  isPlaying = false;
  _setPlayBtn('▶');
  if (window.plugins && window.plugins.insomnia) {
    window.plugins.insomnia.allowSleepAgain();
  } else if (window._wakeLock) {
    window._wakeLock.release();
    window._wakeLock = null;
  }
  document.getElementById('performanceSection').style.display = 'none';
  document.getElementById('songSection').style.display        = 'block';
}