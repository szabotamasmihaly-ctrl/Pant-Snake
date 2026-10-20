// Film player: a timeline of scenes over a 3D studio and an overlay box (1600 x 900, or 560 wide on a phone's tall stage).
// scene = { name, d (seconds), caps: [[t, eyebrow, title, text], ...], run(t, F), enter(F), cut: true, dark: true }
export function createFilm({ root, scenes, studio, total: wantTotal }) {
  const $ = s => root.querySelector(s);
  const screen = $('.screen'), box = $('.box'), fade = $('.fade');
  const cap = $('.cap'), capOut = root.querySelector('.capOut');
  let acc = 0; scenes.forEach(s => { s.t0 = acc; acc += s.d; }); const TOTAL = acc;
  let T = 0, playing = true, last = performance.now(), curIdx = -1, curCap = null, W = 0, H = 0;
  let BW = 1600, BH = 900, portrait = false;

  // chapter chips + scrubber
  const chips = $('.chips'), bar = $('.bar'), fill = bar.querySelector('i'), time = $('.time');
  scenes.forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = s.name;
    b.onclick = () => { seek(s.t0 + .01); }; chips.appendChild(b); s.chip = b;
    if (i) { const u = document.createElement('u'); u.style.left = (s.t0 / TOTAL * 100) + '%'; bar.appendChild(u); }
  });
  // keep the current chip in view by scrolling the chip row only, never the page
  const showChip = b => { const r = b.getBoundingClientRect(), c = chips.getBoundingClientRect();
    if (r.left < c.left || r.right > c.right) chips.scrollTo({ left: chips.scrollLeft + r.left - c.left - (c.width - r.width) / 2, behavior: 'smooth' }); };
  const fmt = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
  bar.setAttribute('aria-valuemax', Math.round(TOTAL));
  const barSeek = e => { const r = bar.getBoundingClientRect(); seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * TOTAL); };
  bar.addEventListener('pointerdown', e => { barSeek(e); const mv = ev => barSeek(ev); const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
  bar.addEventListener('keydown', e => { if (e.key === 'ArrowRight') seek(T + 5); if (e.key === 'ArrowLeft') seek(T - 5); });
  const playBtn = $('#play');
  const setPlay = p => { playing = p; playBtn.textContent = p ? 'Pause' : 'Play'; if (p && T >= TOTAL - .01) seek(0); };
  playBtn.onclick = () => setPlay(!playing);
  screen.addEventListener('click', e => { if (e.target.closest('a,button')) return; setPlay(!playing); });
  addEventListener('keydown', e => {
    if (e.target.closest('input,textarea')) return;
    if (e.key === ' ' && document.activeElement === document.body) { e.preventDefault(); setPlay(!playing); }
  });

  // labels: the box stays put on screen (placed where its point is when it appears), a dot follows the 3D point
  // and a thin line joins them, so the text never shakes while the snake turns
  const labLayer = document.createElement('div'); labLayer.style.cssText = 'position:absolute;inset:0'; box.appendChild(labLayer);
  const NS = 'http://www.w3.org/2000/svg', leadSvg = document.createElementNS(NS, 'svg');
  leadSvg.setAttribute('class', 'leads'); leadSvg.setAttribute('viewBox', '0 0 1600 900'); labLayer.appendChild(leadSvg);
  const labs = {};
  function label(id, p, title, sub, show, cls = '', off = null, pos = null) {   // pos: where the box goes on the phone stage
    let el = labs[id];
    if (!el) {
      el = labs[id] = document.createElement('div'); el.className = 'lab ' + cls; el.innerHTML = '<div><b></b><span></span></div>'; labLayer.appendChild(el);
      el._dot = document.createElement('i'); el._dot.className = 'ldot ' + cls; labLayer.appendChild(el._dot);
      el._line = document.createElementNS(NS, 'line'); el._line.setAttribute('class', 'lead ' + cls); leadSvg.appendChild(el._line);
    }
    if (el._title !== title || el._sub !== sub) {
      el.querySelector('b').textContent = title; el.querySelector('span').textContent = sub || ''; el.querySelector('span').style.display = sub ? '' : 'none';
      el._title = title; el._sub = sub; el._fix = null;
    }
    const q = studio.project(p, BW, BH), inside = q.vis && q.x > 0 && q.x < BW && q.y > 0 && q.y < BH, o = show * (inside ? 1 : 0), left = cls.includes('left');
    if (!el._fix || o <= .001) {
      // place the box once, beside its point, kept whole inside the frame
      const k = portrait ? .5 : 1, ox = (off ? off[0] : (left ? -64 : 64)) * k, oy = (off ? off[1] : -34) * k;
      const w = el.offsetWidth || 240, h = el.offsetHeight || 60, m = portrait ? 12 : 24;
      const x = left ? Math.min(BW - m, Math.max(w + m, q.x + ox)) : Math.max(m, Math.min(BW - w - m, q.x + ox));
      const px = pos && portrait ? (left ? Math.max(w + m, pos[0]) : Math.min(BW - w - m, pos[0])) : x;
      el._fix = { x: Math.round(px), y: Math.round(Math.min(BH - h / 2 - m, Math.max(h / 2 + m, pos && portrait ? pos[1] : q.y + oy))) };
    }
    const f = el._fix;
    el.style.left = f.x + 'px'; el.style.top = f.y + 'px'; el.style.opacity = o;
    el._dot.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)`; el._dot.style.opacity = o;
    const l = el._line; l.setAttribute('x1', q.x.toFixed(1)); l.setAttribute('y1', q.y.toFixed(1)); l.setAttribute('x2', f.x); l.setAttribute('y2', f.y); l.style.opacity = o * .7;
    el._used = true;
  }

  function setCap(c) {
    const key = c ? c.join('|') : '';
    if (key === curCap) return; curCap = key;
    const apply = el => {
      el.querySelector('.k').textContent = c ? c[1] : ''; el.querySelector('h2').innerHTML = c ? c[2] : ''; el.querySelector('p').innerHTML = c ? c[3] : '';
    };
    cap.classList.add('hide');
    clearTimeout(setCap.tm);
    setCap.tm = setTimeout(() => { apply(cap); if (c && c[2]) cap.classList.remove('hide'); }, curIdx < 0 ? 0 : 260);
    if (capOut) apply(capOut);
  }

  const F = { studio, box, label, total: TOTAL, get W() { return W; }, get H() { return H; }, get BW() { return BW; }, get BH() { return BH; }, get portrait() { return portrait; }, $: s => root.querySelector(s) };
  function seek(t) { T = Math.max(0, Math.min(TOTAL, t)); frame(0); }
  function frame(dt) {
    let i = scenes.findIndex(s => T < s.t0 + s.d); if (i < 0) i = scenes.length - 1;
    const s = scenes[i], t = T - s.t0;
    if (i !== curIdx) {
      if (curIdx >= 0 && scenes[curIdx].leave) scenes[curIdx].leave(F);
      box.querySelectorAll('.layer').forEach(l => l.style.opacity = 0);
      cap.classList.remove('top', 'tr'); if (s.capClass) cap.classList.add(s.capClass);
      screen.classList.toggle('dk', !!s.dark);
      if (s.enter) s.enter(F);
      scenes.forEach((x, j) => x.chip.classList.toggle('on', j === i));
      showChip(s.chip);
      curIdx = i;
    }
    for (const k in labs) labs[k]._used = false;
    s.run(t, F, dt);
    for (const k in labs) if (!labs[k]._used) { const l = labs[k]; l.style.opacity = l._dot.style.opacity = l._line.style.opacity = 0; l._fix = null; }
    // fades at cuts
    const fin = s.cut === false ? 0 : Math.max(0, 1 - t / .45), fout = (scenes[i + 1] && scenes[i + 1].cut !== false) ? Math.max(0, 1 - (s.d - t) / .45) : 0;
    fade.style.opacity = Math.max(fin, fout);
    let c = null; for (const cc of (s.caps || [])) if (t >= cc[0]) c = cc;
    setCap(c);
    studio.render();
    fill.style.width = (T / TOTAL * 100) + '%'; bar.setAttribute('aria-valuenow', Math.round(T));
    time.textContent = `${fmt(T)} / ${fmt(TOTAL)}`;
  }
  function loop(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (playing) { T += dt; if (T >= TOTAL) { T = TOTAL - .001; setPlay(false); } }
    if (playing || resized) { frame(playing ? dt : 0); resized = false; }
    requestAnimationFrame(loop);
  }
  let resized = true;
  function fit() {
    const r = screen.getBoundingClientRect(); W = r.width; H = r.height;
    if (!W || !H) return;
    const was = portrait; portrait = W / H < 1.2;
    BW = portrait ? 560 : 1600; BH = portrait ? Math.round(560 * H / W) : 900;
    box.style.width = BW + 'px'; box.style.height = BH + 'px'; box.style.transform = `scale(${W / BW})`;
    leadSvg.setAttribute('viewBox', `0 0 ${BW} ${BH}`);
    studio.resize(Math.round(W), Math.round(H));
    root.classList.toggle('narrow', W < 720); root.classList.toggle('portrait', portrait);
    if (was !== portrait) { for (const k in labs) labs[k]._fix = null; const s = scenes[curIdx]; if (s && s.enter) s.enter(F); }
    resized = true;
  }
  new ResizeObserver(fit).observe(screen); fit();
  // light or dark studio, following the page
  const theme = () => { studio.setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'); resized = true; };
  addEventListener('themechange', theme); theme();
  // pause when the film is off screen, resume when it comes back if it was playing
  let wasPlaying = true;
  new IntersectionObserver(([e]) => { if (!e.isIntersecting) { wasPlaying = playing; setPlay(false); } else if (wasPlaying) setPlay(true); }, { threshold: .15 }).observe(screen);
  window.__film = { seek: t => { setPlay(false); seek(t); }, scenes, total: TOTAL, frame: () => frame(0) };
  requestAnimationFrame(loop);
  return { seek, setPlay, total: TOTAL };
}
