// Les dés du commissaire : motif iconique du tirage.
//   Des.rendre(conteneur, { valeur, n = 2, taille = 120, tremble = true, pose = false })
//        -> { faces, rouler() (Promise), poser(), valeur(v) }
//   Des.faces(valeur, n)   chiffres 1-6 dérivés de la valeur (même valeur, mêmes faces)
//   Des.sceau(valeur, px)  petit SVG inline statique (chaîne HTML)
//   Des.tirer(valeur)      mélange seedé (xmur3 + mulberry32 + Fisher-Yates), mêmes entrées, même liste
// Maquette : le vrai programme utilise HMAC-SHA256, ici un hash simple suffit à montrer le principe.
(function () {
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex64(str) {
    const g = xmur3(str); let s = '';
    for (let i = 0; i < 8; i++) s += g().toString(16).padStart(8, '0');
    return s;
  }
  function faces(valeur, n) {
    const g = xmur3('des:' + String(valeur)); const r = [];
    for (let i = 0; i < (n || 2); i++) r.push(g() % 6 + 1);
    return r;
  }
  const tirageMemo = {};
  function tirer(valeur) {
    if (tirageMemo[valeur]) return tirageMemo[valeur];
    const P = window.PACTE, liste = P.inscrits;
    const rng = mulberry32(xmur3('melange:' + valeur)());
    const ordre = liste.slice();
    for (let i = ordre.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = ordre[i]; ordre[i] = ordre[j]; ordre[j] = t; }
    const empreinteListe = hex64('liste:' + liste.map((x) => x.numero).join('|'));
    const tires = ordre.slice(0, P.places);
    return (tirageMemo[valeur] = {
      ordre, tires, attente: ordre.slice(P.places), empreinteListe,
      empreinteResultat: hex64('resultat:' + valeur + ':' + empreinteListe + ':' + tires.map((x) => x.numero).join('|')),
    });
  }

  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  // Orientation du cube qui amène la face k face au lecteur.
  const VUE = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  const PLACE = { 1: 'rotateY(0deg)', 2: 'rotateY(90deg)', 3: 'rotateX(90deg)', 4: 'rotateX(-90deg)', 5: 'rotateY(-90deg)', 6: 'rotateY(180deg)' };
  const TILT = [-18, -22];                       // inclinaison de lecture du cube
  const LUMIERE = (() => { const v = [-0.35, -0.75, 0.55], l = Math.hypot(...v); return v.map((x) => x / l); })();
  const NORMALES = [1, 2, 3, 4, 5, 6].map((k) => { const p = new DOMMatrix(PLACE[k]).transformPoint(new DOMPoint(0, 0, 1, 0)); return [p.x, p.y, p.z]; });

  // Dé blanc (ivoire léger), points bleus creusés (accent #0a5cff). Le cube est plein : un noyau de six plans carrés SANS arrondi,
  // un peu rentrés sous les faces, bouche les coins arrondis ; il est éclairé comme les faces, donc le coin se lit comme un biseau
  // plein sous tous les angles. Seuls transform et opacity bougent.
  const css = `
  .des { --des-base: var(--color-accent, #0a5cff); position: relative; display: flex; justify-content: center; align-items: flex-end; gap: calc(var(--d, 120px) * .36); perspective: 900px; padding: calc(var(--d, 120px) * .25) 0; touch-action: manipulation; }
  .des.plateau { gap: calc(var(--d, 120px) * .3); padding: calc(var(--d, 120px) * .6) calc(var(--d, 120px) * .2) calc(var(--d, 120px) * .34); overflow: hidden; border-radius: 28px;
    background: radial-gradient(70% 55% at 50% 92%, color-mix(in srgb, var(--des-base) 16%, transparent), transparent 75%), linear-gradient(180deg, color-mix(in srgb, var(--color-fond) 90%, #000) 0%, var(--color-fond) 70%);
    box-shadow: inset 0 8px 18px rgb(0 0 0 / .13), inset 0 -1px 0 rgb(255 255 255 / .6), 0 0 0 1px var(--color-bord); }
  html[data-theme="sombre"] .des.plateau, .sombre-local .des.plateau { box-shadow: inset 0 8px 20px rgb(0 0 0 / .45), inset 0 -1px 0 rgb(255 255 255 / .07), 0 0 0 1px var(--color-bord); }
  .des.plateau::after { content: ''; position: absolute; left: 12%; right: 12%; bottom: calc(var(--d, 120px) * .2); height: 1px; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-texte-2) 28%, transparent), transparent); pointer-events: none; }
  .des-scene { position: relative; flex: none; width: var(--d, 120px); height: var(--d, 120px); transform-style: preserve-3d; transition: transform 260ms var(--ease-sortie, ease-out); }
  .des-saut, .des-tilt, .des-cube { width: 100%; height: 100%; transform-style: preserve-3d; position: relative; }
  .des-saut { transform-origin: 50% 100%; }
  .des-tilt { transform: rotateX(-18deg) rotateY(-22deg); }
  .des-halo { position: absolute; left: 50%; bottom: 4%; width: 78%; aspect-ratio: 2.4; border-radius: 50%; transform: translateX(-50%); opacity: 0; pointer-events: none; background: radial-gradient(closest-side, color-mix(in srgb, var(--des-base) 30%, transparent), transparent); }
  .des.tremble .des-halo { animation: des-halo 2.8s ease-in-out infinite; }
  .des.tremble .des-saut { animation: des-flotte 3.6s ease-in-out infinite; }
  .des.tremble .des-tilt { animation: des-tremble 4.8s ease-in-out infinite; }
  .des.tremble .des-ombre { animation: des-ombre 3.6s ease-in-out infinite; }
  .des.tremble .des-scene:nth-of-type(2) .des-saut, .des.tremble .des-scene:nth-of-type(2) .des-ombre { animation-delay: -1.5s; }
  .des.tremble .des-scene:nth-of-type(2) .des-tilt { animation-delay: -2.1s; animation-duration: 5.6s; }
  .des[role="button"] { cursor: pointer; -webkit-user-select: none; user-select: none; }
  .des[role="button"]:not(.roule):hover .des-scene { transform: translateY(-4px); }
  .des[role="button"]:not(.roule):active .des-scene { transform: translateY(1px) scale(.97); }
  .des[role="button"]:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 4px; border-radius: 28px; }
  @keyframes des-halo { 0%, 100% { opacity: .5; transform: translateX(-50%) scale(.9); } 50% { opacity: .95; transform: translateX(-50%) scale(1.08); } }
  @keyframes des-flotte { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes des-ombre { 0%, 100% { transform: scale(1); opacity: .5; } 50% { transform: scale(.86); opacity: .34; } }
  @keyframes des-tremble { 0%, 100% { transform: rotateX(-18deg) rotateY(-22deg) rotateZ(0deg); } 25% { transform: rotateX(-14deg) rotateY(-28deg) rotateZ(1.4deg); } 50% { transform: rotateX(-21deg) rotateY(-18deg) rotateZ(-.8deg); } 75% { transform: rotateX(-16deg) rotateY(-25deg) rotateZ(1deg); } }

  .des-ombre { position: absolute; left: 4%; right: 4%; bottom: -8%; height: 17%; border-radius: 50%; opacity: .5; background: radial-gradient(closest-side, rgb(10 20 60 / .5), rgb(10 20 60 / .22) 55%, transparent); }
  html[data-theme="sombre"] .des-ombre, .sombre-local .des-ombre { background: radial-gradient(closest-side, rgb(0 0 0 / .8), rgb(0 0 0 / .4) 55%, transparent); }
  .des:not(.plateau) .des-ombre { bottom: -16%; opacity: .32; }

  .des-noyau, .des-face { position: absolute; inset: 0; backface-visibility: hidden; }
  .des-noyau { inset: 4%; background: #e6e3da; overflow: hidden; }
  .des-nlum { position: absolute; inset: 0; background: rgb(24 34 70); opacity: 0; }
  .des-face { display: grid; grid-template: repeat(3, 1fr) / repeat(3, 1fr); padding: calc(var(--d, 120px) * .14); border-radius: calc(var(--d, 120px) * .17); overflow: hidden;
    background: radial-gradient(90% 70% at 26% 16%, #fff, transparent 62%), linear-gradient(150deg, #fffffd 0%, #f6f4ee 48%, #e4e1d8 100%);
    box-shadow: inset 0 0 0 calc(var(--d, 120px) * .012) rgb(255 255 255 / .9), inset 0 calc(var(--d, 120px) * .04) calc(var(--d, 120px) * .07) rgb(255 255 255 / .9), inset 0 calc(var(--d, 120px) * -.06) calc(var(--d, 120px) * .1) rgb(70 62 40 / .22); }
  .des-lum, .des-lux, .des-reflet { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
  .des-lum { background: rgb(24 34 70); opacity: 0; }
  .des-lux { background: linear-gradient(135deg, rgb(255 255 255 / .9), rgb(255 255 255 / 0) 80%); opacity: 0; }
  .des-reflet { background: linear-gradient(105deg, transparent 34%, rgb(10 92 255 / .10) 50%, transparent 66%); transform: translateX(-140%); display: none; }
  .des.tremble .des-reflet { display: block; animation: des-reflet 5.2s ease-in-out infinite; }
  .des.tremble .des-scene:nth-of-type(2) .des-reflet { animation-delay: -2.2s; }
  @keyframes des-reflet { 0% { transform: translateX(-140%); } 34%, 100% { transform: translateX(140%); } }
  .des-pip { position: relative; align-self: center; justify-self: center; width: 74%; aspect-ratio: 1; border-radius: 50%;
    background: radial-gradient(circle at 62% 68%, color-mix(in srgb, var(--des-base) 82%, #fff) 0, var(--des-base) 55%, color-mix(in srgb, var(--des-base) 72%, #000) 100%);
    box-shadow: inset calc(var(--d, 120px) * .014) calc(var(--d, 120px) * .026) calc(var(--d, 120px) * .034) rgb(0 20 100 / .55), 0 calc(var(--d, 120px) * .012) 0 rgb(255 255 255 / .95), 0 calc(var(--d, 120px) * -.006) 0 rgb(60 50 30 / .18); }
  .des-pip.un { width: 100%; }
  .des-eclat { position: absolute; left: 0; top: 0; border-radius: 50%; pointer-events: none; }
  @media (prefers-reduced-motion: reduce) { .des *, .des { animation: none !important; transition: none !important; } .des-halo { opacity: .6; } }
  `;
  function injecterCss() {
    if (document.getElementById('des-css')) return;
    const s = document.createElement('style'); s.id = 'des-css'; s.textContent = css; document.head.appendChild(s);
  }

  function faceHtml(k) {
    const pips = (PIPS[k] || []).map((c) => `<span class="des-pip${k === 1 ? ' un' : ''}" style="grid-area:${Math.floor(c / 3) + 1}/${(c % 3) + 1}"></span>`).join('');
    return `<div class="des-face" style="transform:${PLACE[k]} translateZ(calc(var(--d,120px)/2))" data-k="${k}">${pips}<span class="des-lum"></span><span class="des-lux"></span><span class="des-reflet"></span></div>`;
  }
  const noyauHtml = () => [1, 2, 3, 4, 5, 6].map((k) => `<div class="des-noyau" style="transform:${PLACE[k]} translateZ(calc(var(--d,120px)*.46))"><span class="des-nlum"></span></div>`).join('');
  const sansAnim = () => (window.Maquette && window.Maquette.fige) || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bornes = (x, a, b) => Math.max(a, Math.min(b, x));

  // Éclairage : la luminosité de chaque face suit son orientation courante (dessus clair, côtés sombres).
  function eclairer(lums, luxs, nlums, rx, ry, rz) {
    const m = new DOMMatrix(`rotateX(${TILT[0]}deg) rotateY(${TILT[1]}deg) rotateZ(${rz}deg) rotateX(${rx}deg) rotateY(${ry}deg)`);
    NORMALES.forEach((n, i) => {
      const w = m.transformPoint(new DOMPoint(n[0], n[1], n[2], 0));
      const b = w.x * LUMIERE[0] + w.y * LUMIERE[1] + w.z * LUMIERE[2];
      const o = bornes((0.55 - b) * 0.55, 0, 0.36).toFixed(3);
      lums[i].style.opacity = o; nlums[i].style.opacity = o;
      luxs[i].style.opacity = bornes((b - 0.55) * 1.4, 0, 0.5).toFixed(3);
    });
  }

  // Trajectoire d'un jet : chute puis rebonds amortis. Retourne l'altitude (en côtés de dé, négatif = en l'air).
  const CONTACTS = [[0.36, 1], [0.62, 0.55], [0.79, 0.28], [0.9, 0.12]];
  const REBONDS = [[0.36, 0.62, 0.34], [0.62, 0.79, 0.15], [0.79, 0.9, 0.055]];
  function altitude(p, h0) {
    if (p < 0.36) { const u = p / 0.36; return -h0 * (1 - u * u); }
    for (const [a, b, h] of REBONDS) if (p < b) { const u = (p - a) / (b - a); return -h * 4 * u * (1 - u); }
    return 0;
  }
  // Tassement : bosse brève juste après chaque contact, d'autant plus forte que l'impact l'est.
  function tassement(p) {
    let t = 0;
    for (const [pc, force] of CONTACTS) { const u = (p - pc) / 0.07; if (u > 0 && u < 1) t = Math.max(t, Math.sin(Math.PI * u) * force); }
    return t;
  }

  function rendre(conteneur, opts) {
    injecterCss();
    opts = opts || {};
    const n = opts.n || 2;
    const D = opts.taille || 120;
    const plateau = opts.plateau != null ? opts.plateau : D >= 80;
    let valeur = opts.valeur != null ? opts.valeur : (window.PACTE && window.PACTE.valeur) || '';
    let finales = faces(valeur, n);
    const departs = finales.map((k) => (k % 6) + 1);
    conteneur.classList.remove('roule', 'tremble');
    conteneur.classList.add('des');
    conteneur.classList.toggle('plateau', plateau);
    if (opts.tremble !== false && !sansAnim()) conteneur.classList.add('tremble');
    conteneur.style.setProperty('--d', D + 'px');
    conteneur.style.transform = '';
    conteneur.innerHTML = '<span class="des-halo"></span>' + finales.map(() => `<div class="des-scene"><div class="des-ombre"></div><div class="des-saut"><div class="des-tilt"><div class="des-cube">${noyauHtml()}${[1, 2, 3, 4, 5, 6].map(faceHtml).join('')}</div></div></div></div>`).join('');
    const scenes = [...conteneur.querySelectorAll('.des-scene')];
    const cubes = scenes.map((s) => s.querySelector('.des-cube'));
    const tilts = scenes.map((s) => s.querySelector('.des-tilt'));
    const sauts = scenes.map((s) => s.querySelector('.des-saut'));
    const ombres = scenes.map((s) => s.querySelector('.des-ombre'));
    const lums = cubes.map((c) => [...c.querySelectorAll('.des-lum')]);
    const luxs = cubes.map((c) => [...c.querySelectorAll('.des-lux')]);
    const nlums = cubes.map((c) => [...c.querySelectorAll('.des-nlum')]);
    const cur = departs.map((k) => ({ rx: VUE[k][0], ry: VUE[k][1], rz: 0 }));
    const dessiner = (i) => {
      const o = cur[i];
      cubes[i].style.transform = `rotateX(${o.rx}deg) rotateY(${o.ry}deg)`;
      eclairer(lums[i], luxs[i], nlums[i], o.rx, o.ry, o.rz);
    };
    const poserA = (liste) => liste.forEach((k, i) => { cur[i] = { rx: VUE[k][0], ry: VUE[k][1], rz: 0 }; dessiner(i); });
    poserA(opts.pose ? finales : departs);
    let trame = 0;

    const repos = () => {
      cancelAnimationFrame(trame);
      conteneur.style.transform = '';
      scenes.forEach((_, i) => { sauts[i].style.transform = ''; tilts[i].style.transform = ''; ombres[i].style.transform = ''; ombres[i].style.opacity = ''; });
    };

    function eclat() {
      const r = conteneur.getBoundingClientRect(), cadre = r.left, haut = r.top;
      scenes.forEach((s, i) => {
        const b = s.getBoundingClientRect(), cx = b.left - cadre + b.width / 2, cy = b.bottom - haut - D * 0.05;
        const anneau = document.createElement('span'); anneau.className = 'des-eclat';
        Object.assign(anneau.style, { width: D * 0.9 + 'px', height: D * 0.9 + 'px', left: cx - D * 0.45 + 'px', top: cy - D * 0.45 + 'px', border: '2px solid var(--des-base)' });
        conteneur.appendChild(anneau);
        anneau.animate([{ transform: 'scale(.35,.12)', opacity: .8 }, { transform: 'scale(1.7,.55)', opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)', delay: i * 60 }).onfinish = () => anneau.remove();
        for (let j = 0; j < 7; j++) {
          const a = (-Math.PI * (0.1 + 0.8 * (j / 6))), dist = D * (0.5 + 0.25 * ((j * 37) % 5) / 4), pt = document.createElement('span'); pt.className = 'des-eclat';
          const t = Math.max(4, D * 0.045);
          Object.assign(pt.style, { width: t + 'px', height: t + 'px', left: cx - t / 2 + 'px', top: cy - t / 2 + 'px', background: j % 2 ? 'var(--des-base)' : '#fff', boxShadow: '0 0 6px var(--des-base)' });
          conteneur.appendChild(pt);
          pt.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist * 0.9}px) scale(.3)`, opacity: 0 }], { duration: 620 + (j % 3) * 80, easing: 'cubic-bezier(.15,.7,.3,1)', delay: i * 60 }).onfinish = () => pt.remove();
        }
      });
    }

    const ctrl = {
      get faces() { return finales.slice(); },
      valeur(v) { valeur = v; finales = faces(v, n); return finales; },
      poser() { repos(); conteneur.classList.remove('tremble', 'roule'); poserA(finales); },
      rouler() {
        if (sansAnim()) { ctrl.poser(); return Promise.resolve(finales); }
        repos();
        conteneur.classList.remove('tremble'); conteneur.classList.add('roule');
        const W = conteneur.clientWidth;
        const jets = finales.map((k, i) => {
          const o = cur[i];
          return {
            delai: i * 130, duree: 1750 + i * 110,
            x0: -W * (0.5 + 0.34 * (i % 2) + 0.12 * Math.floor(i / 2)), expo: i % 2 ? 2.7 : 2.0,
            h0: 0.62 + 0.12 * i, rx0: o.rx % 360, ry0: o.ry % 360,
            rx1: VUE[k][0] + 360 * (2 + (i % 2)), ry1: VUE[k][1] + 360 * (3 - (i % 2)), rz: 12 + 6 * i,
          };
        });
        const total = Math.max(...jets.map((j) => j.delai + j.duree));
        return new Promise((ok) => {
          const t0 = performance.now();
          const pas = (now) => {
            const t = now - t0;
            let secousse = 0;
            jets.forEach((j, i) => {
              const p = bornes((t - j.delai) / j.duree, 0, 1);
              const e = 1 - Math.pow(1 - p, j.expo), er = 1 - Math.pow(1 - p, 2.6);
              const x = j.x0 * (1 - e), y = altitude(p, j.h0) * D, ts = tassement(p);
              const sy = 1 - 0.17 * ts, sx = 1 + 0.1 * ts;
              sauts[i].style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
              const air = bornes(-y / (D * 0.6), 0, 1);
              ombres[i].style.transform = `translateX(${x.toFixed(1)}px) scale(${(1 + 0.4 * air + 0.12 * ts).toFixed(3)})`;
              ombres[i].style.opacity = (0.62 - 0.46 * air + 0.1 * ts).toFixed(3);
              const rz = j.rz * Math.sin(p * 9) * Math.pow(1 - p, 2);
              cur[i] = { rx: j.rx0 + (j.rx1 - j.rx0) * er, ry: j.ry0 + (j.ry1 - j.ry0) * er, rz };
              tilts[i].style.transform = `rotateX(${TILT[0]}deg) rotateY(${TILT[1]}deg) rotateZ(${rz.toFixed(2)}deg)`;
              dessiner(i);
              if (i === 0 || p < 1) secousse = Math.max(secousse, ts);
            });
            conteneur.style.transform = secousse ? `translateY(${(secousse * 2.6).toFixed(2)}px)` : '';
            if (t < total) { trame = requestAnimationFrame(pas); return; }
            repos(); poserA(finales);
            conteneur.classList.remove('roule');
            if (plateau) eclat();
            ok(finales);
          };
          trame = requestAnimationFrame(pas);
        });
      },
    };
    return ctrl;
  }

  // Sceau : mini dés blancs, points bleus.
  let sceauNo = 0;
  function sceau(valeur, px) {
    const f = faces(valeur != null ? valeur : (window.PACTE && window.PACTE.valeur) || '', 2);
    const id = 'ds' + (++sceauNo);
    const d = (k, x, y, rot) => {
      const pips = PIPS[k].map((c) => { const cx = x + 4.2 + (c % 3) * 5.8, cy = y + 4.2 + Math.floor(c / 3) * 5.8, r = k === 1 ? 2.3 : 1.45;
        return `<circle cx="${cx}" cy="${cy + 0.3}" r="${r + .15}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#0a5cff"/><circle cx="${cx - .25}" cy="${cy - .3}" r="${r * .55}" fill="#003fb8" fill-opacity=".45"/>`; }).join('');
      return `<g transform="rotate(${rot} ${x + 10} ${y + 10})"><rect x="${x}" y="${y + 1.2}" width="20" height="20" rx="5.5" fill="#0a1440" fill-opacity=".28"/><rect x="${x}" y="${y}" width="20" height="20" rx="5.5" fill="url(#${id}b)" stroke="#c9c5b8" stroke-width=".6"/>${pips}</g>`;
    };
    return `<svg class="des-sceau" role="img" aria-label="Sceau du tirage : dés ${f[0]} et ${f[1]}" width="${px || 32}" height="${px || 32}" viewBox="0 0 36 36"><defs><linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#f4f2eb"/><stop offset="1" stop-color="#e0ddd3"/></linearGradient></defs>${d(f[0], 2, 12, -12)}${d(f[1], 14, 3, 14)}</svg>`;
  }

  window.Des = { rendre, faces, sceau, tirer, hex64, xmur3, mulberry32 };
})();
