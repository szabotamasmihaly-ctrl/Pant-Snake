// Film player: a timeline of scenes over a 3D studio and a 1600 x 900 overlay box.
// scene = { name, d (seconds), caps: [[t, eyebrow, title, text], ...], run(t, F), enter(F), cut: true }
export function createFilm({ root, scenes, studio, total: wantTotal }) {
  const $ = s => root.querySelector(s);
  const screen = $('.screen'), box = $('.box'), fade = $('.fade');
  const cap = $('.cap'), capOut = root.querySelector('.capOut');
  let acc = 0; scenes.forEach(s => { s.t0 = acc; acc += s.d; }); const TOTAL = acc;
  let T = 0, playing = true, last = performance.now(), curIdx = -1, curCap = null, W = 0, H = 0;

  // chapter chips + scrubber
  const chips = $('.chips'), bar = $('.bar'), fill = bar.querySelector('i'), time = $('.time');
  scenes.forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = s.name;
    b.onclick = () => { seek(s.t0 + .01); }; chips.appendChild(b); s.chip = b;
    if (i) { const u = document.createElement('u'); u.style.left = (s.t0 / TOTAL * 100) + '%'; bar.appendChild(u); }
  });
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

  // labels anchored to 3D points
  const labLayer = document.createElement('div'); labLayer.style.cssText = 'position:absolute;inset:0'; box.appendChild(labLayer);
  const labs = {};
  function label(id, p, title, sub, show, cls = '') {
    let el = labs[id];
    if (!el) { el = labs[id] = document.createElement('div'); el.className = 'lab ' + cls; el.innerHTML = `<i></i><div><b></b><span></span></div>`; labLayer.appendChild(el); }
    el.querySelector('b').textContent = title; el.querySelector('span').textContent = sub || ''; el.querySelector('span').style.display = sub ? '' : 'none';
    const q = studio.project(p, 1600, 900);
    el.style.left = q.x + 'px'; el.style.top = q.y + 'px'; el.style.opacity = show * (q.vis ? 1 : 0); el._used = true;
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

  const F = { studio, box, label, total: TOTAL, get W() { return W; }, get H() { return H; }, $: s => root.querySelector(s) };
  function seek(t) { T = Math.max(0, Math.min(TOTAL, t)); frame(0); }
  function frame(dt) {
    let i = scenes.findIndex(s => T < s.t0 + s.d); if (i < 0) i = scenes.length - 1;
    const s = scenes[i], t = T - s.t0;
    if (i !== curIdx) {
      if (curIdx >= 0 && scenes[curIdx].leave) scenes[curIdx].leave(F);
      box.querySelectorAll('.layer').forEach(l => l.style.opacity = 0);
      cap.classList.remove('top', 'tr'); if (s.capClass) cap.classList.add(s.capClass);
      if (s.enter) s.enter(F);
      scenes.forEach((x, j) => x.chip.classList.toggle('on', j === i));
      s.chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      curIdx = i;
    }
    for (const k in labs) labs[k]._used = false;
    s.run(t, F, dt);
    for (const k in labs) if (!labs[k]._used) labs[k].style.opacity = 0;
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
    box.style.transform = `scale(${W / 1600})`;
    studio.resize(Math.round(W), Math.round(H));
    root.classList.toggle('narrow', W < 720);
    resized = true;
  }
  new ResizeObserver(fit).observe(screen); fit();
  // pause when the film is off screen, resume when it comes back if it was playing
  let wasPlaying = true;
  new IntersectionObserver(([e]) => { if (!e.isIntersecting) { wasPlaying = playing; setPlay(false); } else if (wasPlaying) setPlay(true); }, { threshold: .15 }).observe(screen);
  window.__film = { seek: t => { setPlay(false); seek(t); }, scenes, total: TOTAL, frame: () => frame(0) };
  requestAnimationFrame(loop);
  return { seek, setPlay, total: TOTAL };
}
