/* ODC Data Driven Manager · lógica del recorrido */
(function () {
  'use strict';

  /*
   * Audio de Insight: si grabas locuciones, guárdalas como audio/pantalla-01.mp3,
   * audio/pantalla-02.mp3, … (número de pantalla con dos dígitos) y cambia esto a true.
   * Mientras sea false, Insight lee el guion con la voz del navegador.
   */
  var USE_AUDIO_FILES = false;

  /*
   * Video del avatar de Insight: guarda los videos como video/pantalla-01.mp4, video/pantalla-02.mp4, …
   * (agrégalos también a imsmanifest.xml) y cambia esto a true. La ventana de Insight mostrará el video
   * de la pantalla actual; si un video no existe, vuelve a la imagen y a la voz del navegador.
   */
  var USE_AVATAR_VIDEO = true;

  // Ponderación de la nota (storyboard): actividades 40 %, simuladores 35 %, evaluación final 25 %.
  var WEIGHTS = { act: 0.40, sim: 0.35, fin: 0.25 };
  var PASS_SCORE = 70;
  var ACTIVITIES = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
  var MAX_ATTEMPTS = 3;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var screens = $$('.screen');
  var current = 0;

  /* Íconos del sprite Lucide incluido en index.html */
  function icon(name, cls) {
    return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }

  /* Ícono y color de cada módulo (barra lateral y encabezados de pantalla) */
  var MODS = {
    'Introducción': { icon: 'compass', color: 'blue' },
    'Módulo 1 · Fundamentos': { icon: 'database', color: 'teal' },
    'Módulo 2 · Calidad y gobernanza': { icon: 'shield-check', color: 'blue' },
    'Módulo 3 · Tipos de analítica': { icon: 'chart-line', color: 'orange' },
    'Módulo 4 · Apoyo a la decisión': { icon: 'workflow', color: 'purple' },
    'Módulo 5 · IA en la gestión': { icon: 'brain-circuit', color: 'green' },
    'Módulo 6 · Visualización': { icon: 'chart-pie', color: 'navy' },
    'Módulo 7 · Casos reales': { icon: 'briefcase', color: 'red' },
    'Módulo 8 · Simuladores': { icon: 'sliders-horizontal', color: 'teal' },
    'Cierre': { icon: 'award', color: 'orange' }
  };
  var SCREEN_ICONS = [
    [/^Ruta/, 'map'], [/^Actividad/, 'target'], [/^Caso Netflix/, 'tv'], [/^Caso UPS/, 'truck'],
    [/^Caso Walmart/, 'store'], [/^Simulador 1/, 'tag'], [/^Simulador 2/, 'briefcase'],
    [/^Evaluación/, 'trophy'], [/^Conclusiones/, 'lightbulb'], [/^Créditos/, 'library']
  ];
  function modOf(s) { return MODS[s.dataset.mod] || MODS['Introducción']; }
  function colorOf(s) { return s.dataset.color || modOf(s).color; }
  function screenIcon(s) {
    for (var k = 0; k < SCREEN_ICONS.length; k++) if (SCREEN_ICONS[k][0].test(s.dataset.title)) return SCREEN_ICONS[k][1];
    return modOf(s).icon;
  }

  /* Encabezado visible de cada pantalla, a partir de data-title y data-pill */
  screens.forEach(function (s) {
    if (s.hasAttribute('data-cover')) return;
    var c = colorOf(s);
    var head = document.createElement('header');
    head.className = 'screen-head';
    head.style.setProperty('--sh-c', 'var(--' + c + ')');
    head.style.setProperty('--sh-fg', 'var(--' + c + '-fg)');
    head.innerHTML = '<span class="sh-icon">' + icon(screenIcon(s)) + '</span><div><p class="sh-eyebrow">' +
      escapeHTML(s.dataset.pill || '') + '</p><h2 class="sh-title">' + escapeHTML(s.dataset.title) + '</h2></div>';
    s.insertBefore(head, s.firstChild);
  });

  /* Ilustración: ícono grande dentro de un círculo con anillos (actividades y cuestionarios) */
  function spot(name) {
    return '<div class="spot" aria-hidden="true"><span class="spot-ring"></span><span class="spot-ring r2"></span>' +
      '<span class="spot-core">' + icon(name) + '</span></div>';
  }

  /* Mejoras visuales sobre el HTML existente: no cambian ningún texto del contenido */
  (function enhance() {
    // Tarjetas: franja ilustrada (ícono grande + marca de agua) y cuerpo de texto aparte
    $$('.card').forEach(function (card) {
      var body = document.createElement('div');
      body.className = 'card-body';
      Array.prototype.slice.call(card.childNodes).forEach(function (n) {
        if (n.nodeType === 1 && /\b(ico|num|seen)\b/.test(n.className)) return;
        body.appendChild(n);
      });
      card.appendChild(body);
      var svg = $('.ico svg', card);
      if (svg) {
        var wm = svg.cloneNode(true);
        wm.setAttribute('class', 'i wm');
        $('.ico', card).appendChild(wm);
      }
    });

    // Citas: salen del medio del texto y se muestran al final del mismo bloque, con su propio diseño.
    // Cita parentética = paréntesis con «Autor, año» (una o varias separadas por punto y coma).
    var CITE = /\s*\(([^()]*?,\s*\d{4}[a-z]?(?:\s*;[^()]*?,\s*\d{4}[a-z]?)*)\)/g;
    var NARRATIVE_END = /\s*(Según [^<.]*?en \d{4}(?:\s*y\s*[^<.]*?en \d{4})*)\s*$/;
    function citeBox(text) {
      return '<span class="cite">' + icon('book-open') + '<span>' + text + '</span></span>';
    }
    $$('.screen p, .screen li, .screen .stat span').forEach(function (el) {
      if (el.closest('.audio, .refs, .meta, .quiz') || el.querySelector('p, li')) return;
      var html = el.innerHTML;
      var found = [];
      html = html.replace(CITE, function (m, c) { found.push(c); return ''; });
      html = html.replace(NARRATIVE_END, function (m, c) { found.push(c); return ''; });
      if (!found.length) return;
      el.innerHTML = html + citeBox(found.join('; '));
    });
    // Líneas que ya son solo fuentes o referencias: mismo diseño de cita
    $$('.screen .source, .screen .stat span').forEach(function (el) {
      if (el.classList.contains('source') || /^Fuente:/.test(el.textContent)) {
        el.classList.add('cite', 'cite-line');
        el.insertAdjacentHTML('afterbegin', icon('book-open'));
      }
    });

    // Casos (módulo 7): cada paso de la ruta toma el color de su título para la línea de tiempo
    $$('.case .flow > div').forEach(function (step) {
      var h = $('h4', step);
      if (h && h.style.background) step.style.setProperty('--c', h.style.background);
    });

    // Casos: cada uno lleva una gráfica pequeña que dibuja su propia cifra (decorativa, sin texto nuevo)
    var CASE_CHARTS = {
      // Netflix: ≈ 80 % de las horas reproducidas → anillo al 80 %
      'case-netflix': '<svg class="stat-chart" viewBox="0 0 42 42" aria-hidden="true">' +
        '<circle cx="21" cy="21" r="15.9" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="5"/>' +
        '<circle cx="21" cy="21" r="15.9" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" ' +
        'stroke-dasharray="80 20" stroke-dashoffset="25" pathLength="100"/></svg>',
      // UPS: ruta original (zigzag) frente a la ruta optimizada (suave)
      'case-ups': '<svg class="stat-chart route" viewBox="0 0 64 40" aria-hidden="true">' +
        '<path d="M4 34 L18 8 L30 30 L44 6 L60 30" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="2" stroke-dasharray="3 3"/>' +
        '<path d="M4 34 C20 30 40 14 60 30" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="4" cy="34" r="3.5" fill="currentColor"/><circle cx="60" cy="30" r="3.5" fill="currentColor"/></svg>',
      // Walmart: ritmo normal frente a ≈ 7 veces antes del huracán
      'case-walmart': '<svg class="stat-chart" viewBox="0 0 56 42" aria-hidden="true">' +
        '<rect x="8" y="35" width="15" height="5" rx="2" fill="currentColor" fill-opacity=".3"/>' +
        '<rect x="33" y="5" width="15" height="35" rx="2" fill="currentColor"/></svg>'
    };
    Object.keys(CASE_CHARTS).forEach(function (id) {
      var s = document.getElementById(id);
      var stat = s && $$('.case .stat', s)[id === 'case-ups' ? 1 : 0];
      if (stat) stat.insertAdjacentHTML('afterbegin', CASE_CHARTS[id]);
    });

    // Portada: íconos junto a la institución y los autores, y un collage
    // decorativo de tablero (gráficas y módulos) en lugar de los puntos
    var cover = $('.cover');
    if (cover) {
      var cps = $$(':scope > div:first-child > p', cover);
      if (cps[0]) cps[0].insertAdjacentHTML('afterbegin', icon('graduation-cap'));
      if (cps[1]) cps[1].classList.add('cover-sub');
      if (cps[2]) { cps[2].classList.add('cover-authors'); cps[2].insertAdjacentHTML('afterbegin', icon('users')); }
      var art = $('.dots', cover);
      if (art) {
        art.className = 'cover-art';
        var orbit = ['database', 'shield-check', 'chart-pie', 'workflow', 'brain-circuit', 'chart-line', 'briefcase', 'sliders-horizontal'];
        art.innerHTML =
          '<div class="ca-card ca-bars"><span class="ca-dots"><i></i><i></i><i></i></span>' +
            '<svg viewBox="0 0 220 120" preserveAspectRatio="none">' +
              '<g class="ca-grid"><line x1="0" y1="30" x2="220" y2="30"/><line x1="0" y1="60" x2="220" y2="60"/><line x1="0" y1="90" x2="220" y2="90"/></g>' +
              '<g class="ca-bar"><rect x="12" y="70" width="22" height="50" rx="4"/><rect x="46" y="54" width="22" height="66" rx="4"/><rect x="80" y="62" width="22" height="58" rx="4"/>' +
              '<rect x="114" y="38" width="22" height="82" rx="4"/><rect x="148" y="28" width="22" height="92" rx="4"/><rect x="182" y="12" width="22" height="108" rx="4"/></g>' +
              '<polyline class="ca-line" points="23,60 57,44 91,52 125,28 159,20 193,6" pathLength="100"/>' +
            '</svg></div>' +
          '<div class="ca-card ca-donut"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" class="ca-ring"/>' +
            '<circle cx="21" cy="21" r="15.9" class="ca-seg s1" pathLength="100" stroke-dasharray="45 55" stroke-dashoffset="25"/>' +
            '<circle cx="21" cy="21" r="15.9" class="ca-seg s2" pathLength="100" stroke-dasharray="30 70" stroke-dashoffset="-20"/>' +
            '<circle cx="21" cy="21" r="15.9" class="ca-seg s3" pathLength="100" stroke-dasharray="25 75" stroke-dashoffset="-50"/></svg></div>' +
          '<div class="ca-card ca-kpi"><span class="ca-kpi-ico">' + icon('trending-up') + '</span>' +
            '<svg viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points="0,26 14,22 28,24 42,15 56,17 70,9 84,11 100,3"/></svg></div>' +
          '<div class="ca-orbit">' + orbit.map(function (n, k) { return '<span style="--k:' + k + '">' + icon(n) + '</span>'; }).join('') + '</div>';
      }
    }

    // Big Data: el centro del mapa de las 5 V lleva su ícono
    $$('.vmap .core').forEach(function (c) { c.insertAdjacentHTML('afterbegin', '<span class="core-ico">' + icon('database') + '</span>'); });

    // Zonas de arrastrar y soltar con su ícono
    var ZONE_ICONS = {
      vol: 'hard-drive', vel: 'zap', 'var': 'shapes', ver: 'badge-check', val: 'gem',
      desc: 'history', pred: 'trending-up', pres: 'route',
      verde: 'circle-check', amarillo: 'triangle-alert', rojo: 'octagon-alert',
      lin: 'chart-line', bar: 'chart-column', disp: 'chart-scatter', hist: 'chart-column-big'
    };
    $$('.zone').forEach(function (z) {
      var st = $('strong', z);
      if (st && ZONE_ICONS[z.dataset.id]) st.insertAdjacentHTML('afterbegin', '<span class="zone-ico">' + icon(ZONE_ICONS[z.dataset.id]) + '</span>');
    });
    $$('.dnd > div > .label').forEach(function (l) {
      l.insertAdjacentHTML('afterbegin', icon(/Arrastra/.test(l.textContent) ? 'move' : 'target'));
    });

    // Instrucciones de las actividades como aviso destacado
    $$('.lead').forEach(function (p) {
      var b = p.firstElementChild;
      if (b && b.tagName === 'B' && /^Instrucciones/.test(b.textContent)) {
        p.classList.add('instr');
        p.insertAdjacentHTML('afterbegin', '<span class="instr-ico">' + icon('list-checks') + '</span>');
      }
    });

    // Detective: botones de clasificación con el ícono de cada característica de calidad
    var DIM_ICONS = { exactitud: 'crosshair', completitud: 'list-checks', consistencia: 'equal', unicidad: 'fingerprint', validez: 'file-text', oportunidad: 'clock' };
    $$('.classify button').forEach(function (b) { b.insertAdjacentHTML('afterbegin', icon(DIM_ICONS[b.dataset.dim])); });

    // Proceso de decisión: cada descripción repite el ícono y el color de su fase
    var chevs = $$('.chev');
    $$('.steps-desc > div').forEach(function (d, i) {
      var s = chevs[i] && $('svg', chevs[i]);
      if (!s) return;
      var w = document.createElement('span');
      w.className = 'step-ico';
      w.style.setProperty('--c', chevs[i].style.background);
      w.appendChild(s.cloneNode(true));
      d.insertBefore(w, d.firstChild);
      var mark = s.cloneNode(true); // marca de agua para llenar el fondo de la columna
      mark.setAttribute('class', 'i wm');
      d.style.setProperty('--c', chevs[i].style.background);
      d.appendChild(mark);
    });

    // Insight: tarjeta centrada con marco para el avatar (o su video)
    $$('.avatar').forEach(function (a) {
      a.classList.add('insight-card');
      var b = $('button', a);
      if (b) b.classList.add('insight-media');
      var sm = $('small', a);
      if (sm) sm.insertAdjacentHTML('afterbegin', icon('headphones'));
    });

    // Insight con video: la tarjeta trae el video listo para reproducir y «Ver más» abre la ventana
    // con la transcripción y el mismo video. (En actividades no hay tarjeta: solo voz.)
    $$('.screen[data-video]').forEach(function (s) {
      var old = $('.insight-card .insight-media', s);
      if (!old || !USE_AVATAR_VIDEO || isActivity(s)) return;
      // El marco pasa a ser un contenedor (no un botón) para poder llevar dentro la barra de avance
      var media = document.createElement('div');
      media.className = 'insight-media is-video';
      media.innerHTML = '<video playsinline preload="none" data-src="video/' + s.dataset.video + '.mp4"></video>' +
        '<button class="iv-btn" aria-label="Reproducir el video de Insight">' + icon('play', 'iv-play') + icon('pause', 'iv-pause') + icon('rotate-ccw', 'iv-again') + '</button>' +
        '<div class="iv-seek" role="slider" tabindex="0" aria-label="Avance del video" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<span class="iv-fill"></span><span class="iv-thumb"></span></div>';
      old.parentNode.replaceChild(media, old);
      var v = $('video', media);
      var seek = $('.iv-seek', media);
      var btn = $('.iv-btn', media);
      var state = function (cls) { media.classList.remove('playing', 'ended'); if (cls) media.classList.add(cls); };
      v.addEventListener('play', function () { state('playing'); btn.setAttribute('aria-label', 'Pausar el video de Insight'); });
      v.addEventListener('pause', function () { if (!v.ended) state(''); btn.setAttribute('aria-label', 'Reproducir el video de Insight'); });
      v.addEventListener('ended', function () { state('ended'); btn.setAttribute('aria-label', 'Ver otra vez el video de Insight'); });
      ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked'].forEach(function (ev) {
        v.addEventListener(ev, function () { paintSeek(seek, v); });
      });
      bindSeek(seek, function () { if (!v.src) loadCardVideo(s); return v; });
      var toggle = function () {
        if (!v.src) loadCardVideo(s);
        if (v.paused || v.ended) { if (v.ended) v.currentTime = 0; v.play().catch(function () { openDrawer(true); }); }
        else v.pause();
      };
      btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
      v.addEventListener('click', toggle);
      var sm = $('.insight-card > small', s);
      if (sm) sm.outerHTML = '<button class="iv-more" data-insight>' + icon('file-text') + '<span>Ver más</span></button>';
    });
  })();

  /* Barra de avance de los videos: se toca o se arrastra para ir a cualquier punto,
     y con el teclado las flechas mueven 5 segundos */
  function fmtTime(t) {
    if (!isFinite(t) || t < 0) return '–:––';
    t = Math.floor(t);
    return Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60);
  }
  function paintSeek(bar, v) {
    var p = v && isFinite(v.duration) && v.duration > 0 ? v.currentTime / v.duration * 100 : 0;
    $('.iv-fill', bar).style.width = p + '%';
    $('.iv-thumb', bar).style.left = p + '%';
    bar.setAttribute('aria-valuenow', String(Math.round(p)));
    bar.setAttribute('aria-valuetext', v ? fmtTime(v.currentTime) + ' de ' + fmtTime(v.duration) : '');
  }
  function bindSeek(bar, getV) {
    var drag = false;
    var at = function (e) {
      var r = bar.getBoundingClientRect();
      return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    };
    var go = function (f) {
      var v = getV();
      if (!v || !isFinite(v.duration) || !v.duration) return;
      v.currentTime = f * v.duration;
      paintSeek(bar, v);
    };
    bar.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      drag = true;
      bar.classList.add('dragging');
      try { bar.setPointerCapture(e.pointerId); } catch (err) { /* puntero no capturable: se sigue sin captura */ }
      go(at(e));
    });
    bar.addEventListener('pointermove', function (e) { if (drag) go(at(e)); });
    var end = function () { drag = false; bar.classList.remove('dragging'); };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    bar.addEventListener('click', function (e) { e.stopPropagation(); });
    bar.addEventListener('keydown', function (e) {
      var v = getV();
      if (!v) return;
      var step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
      if (step == null && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      e.stopPropagation(); // que las flechas no cambien de pantalla
      if (e.key === 'Home') v.currentTime = 0;
      else if (e.key === 'End' && isFinite(v.duration)) v.currentTime = v.duration;
      else v.currentTime = Math.max(0, Math.min(isFinite(v.duration) ? v.duration : Infinity, v.currentTime + step));
      paintSeek(bar, v);
    });
  }

  // Solo se carga el video de la pantalla visible; los demás quedan en pausa
  function loadCardVideo(s) {
    var v = cardVideo(s);
    if (v && !v.src) { v.preload = 'auto'; v.src = v.dataset.src + '#t=0.1'; }
  }
  function pauseCardVideos() {
    $$('.insight-media.is-video video').forEach(function (v) { if (!v.paused) v.pause(); });
  }


  /* ------------------------------------------------------------------ */
  /* Estado persistente (cmi.suspend_data)                               */
  /* ------------------------------------------------------------------ */
  // k: actividad 7 (c = caso elegido, r = resultado de cada campo y de cada pregunta del caso nuevo, d = terminada)
  var state = { v: '', s: {}, t: {}, k: { c: -1, r: [], d: false }, p: '', q: [] };

  function loadState() {
    var raw = SCORM.get('cmi.suspend_data');
    if (raw) {
      try {
        var data = JSON.parse(raw);
        for (var k in data) state[k] = data[k];
      } catch (e) { /* datos corruptos: se empieza de cero */ }
    }
  }

  var saveTimer = null;
  function saveState(now) {
    clearTimeout(saveTimer);
    var write = function () {
      var json = JSON.stringify(state);
      SCORM.set('cmi.suspend_data', json);
      SCORM.commit();
    };
    if (now) write(); else saveTimer = setTimeout(write, 600);
  }

  function isVisited(i) { return state.v.charAt(i) === '1'; }
  function markVisited(i) {
    while (state.v.length < screens.length) state.v += '0';
    state.v = state.v.substring(0, i) + '1' + state.v.substring(i + 1);
  }

  function setScore(key, value) {
    var best = state.s[key] || 0;
    state.s[key] = Math.max(best, Math.round(value));
    updateGrade();
    saveState(true);
  }

  function avg(keys) {
    var sum = 0;
    keys.forEach(function (k) { sum += state.s[k] || 0; });
    return sum / keys.length;
  }

  function finalPoints() {
    var sum = 0, answered = 0;
    for (var i = 0; i < 10; i++) {
      if (state.q[i] != null) { sum += state.q[i]; answered++; }
    }
    return { sum: sum, answered: answered };
  }

  function grade() {
    var act = avg(ACTIVITIES);
    var sim = avg(['sim1', 'sim2']);
    var fin = finalPoints();
    var total = Math.round(act * WEIGHTS.act + sim * WEIGHTS.sim + fin.sum * WEIGHTS.fin);
    return { act: Math.round(act), sim: Math.round(sim), fin: fin.sum, done: fin.answered === 10, total: total };
  }

  function updateGrade() {
    var g = grade();
    // Sin masteryscore en el manifiesto: el curso decide aprobado/reprobado al terminar la evaluación final.
    if (g.total > 0 || g.done) SCORM.set('cmi.core.score.raw', g.total);
    if (g.done) SCORM.set('cmi.core.lesson_status', g.total >= PASS_SCORE ? 'passed' : 'failed');
    renderResults();
  }

  function stars(score) {
    var n = score >= 100 ? 3 : score >= 60 ? 2 : score > 0 ? 1 : 0;
    var html = '<span class="stars" role="img" aria-label="' + n + ' de 3 estrellas">';
    for (var k = 0; k < 3; k++) html += icon('star', k < n ? 'on' : 'off');
    return html + '</span>';
  }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  /* ------------------------------------------------------------------ */
  /* Navegación                                                           */
  /* ------------------------------------------------------------------ */
  function indexOfId(id) {
    for (var i = 0; i < screens.length; i++) if (screens[i].id === id) return i;
    return -1;
  }

  function go(i) {
    if (i < 0 || i >= screens.length) return;
    stopSpeech();
    closeDrawer();
    screens[current].classList.remove('active');
    current = i;
    var s = screens[i];
    s.classList.add('active');
    $('#stage').scrollTop = 0;

    $('#screenTitle').textContent = s.dataset.title;
    var pill = $('#screenPill');
    var color = colorOf(s);
    pill.textContent = s.dataset.pill || '';
    pill.style.setProperty('--pill-c', 'var(--' + color + '-fg)');
    // El fondo animado y la línea de la barra toman el color del módulo
    $('#app').style.setProperty('--accent', 'var(--' + (color === 'navy' ? 'blue' : color) + ')');

    $('#counter').textContent = (i + 1) + ' / ' + screens.length;
    $('#progressBar').style.width = ((i + 1) / screens.length * 100) + '%';
    $('#prevBtn').disabled = i === 0;
    $('#nextBtn').disabled = i === screens.length - 1;
    $('#audioBtn').hidden = !$('.audio', s);

    pauseCardVideos();
    loadCardVideo(s);
    markVisited(i);
    $$('[data-seen]').forEach(function (el) { el.hidden = !isVisited(indexOfId(el.dataset.seen)); });
    refreshNav();
    SCORM.set('cmi.core.lesson_location', String(i));
    saveState();
    if (s.querySelector('[data-results]')) renderResults();
  }

  $('#prevBtn').addEventListener('click', function () { go(current - 1); });
  $('#nextBtn').addEventListener('click', function () { go(current + 1); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') return;
    if (!$('#drawer').hidden || menuIsOverlay()) {
      if (e.key === 'Escape') { closeDrawer(); closeMenu(true); }
      return;
    }
    if (e.key === 'ArrowRight') go(current + 1);
    if (e.key === 'ArrowLeft') go(current - 1);
  });
  document.addEventListener('click', function (e) {
    var next = e.target.closest('[data-next]');
    if (next) go(current + 1);
    var link = e.target.closest('[data-goto]');
    if (link) go(indexOfId(link.dataset.goto));
    var ins = e.target.closest('[data-insight]');
    if (ins) openDrawer(true);
  });

  /* Índice: barra lateral agrupada por módulo (fija en escritorio, panel en móvil) */
  var desktopQuery = window.matchMedia ? window.matchMedia('(min-width: 1100px)') : { matches: true };
  var openGroups = {};

  function buildMenu() {
    var groups = [];
    screens.forEach(function (s, i) {
      var g = groups[groups.length - 1];
      if (!g || g.mod !== s.dataset.mod) groups.push(g = { mod: s.dataset.mod, items: [] });
      g.items.push(i);
    });
    var html = '';
    groups.forEach(function (g, gi) {
      var meta = MODS[g.mod] || MODS['Introducción'];
      var parts = g.mod.split(' · ');
      html += '<div class="nav-group" data-g="' + gi + '" style="--m-c:var(--' + meta.color + ');--m-fg:var(--' + meta.color + '-fg)">' +
        '<button class="nav-mod" aria-expanded="false" aria-controls="navg' + gi + '">' +
        '<span class="m-ico">' + icon(meta.icon) + '</span>' +
        '<span class="m-txt">' + (parts[1] ? '<small>' + escapeHTML(parts[0]) + '</small><span>' + escapeHTML(parts[1]) + '</span>'
          : '<span>' + escapeHTML(parts[0]) + '</span>') + '</span>' +
        '<span class="m-count" data-count></span>' + icon('chevron-down', 'chev-i') + '</button>' +
        '<ol class="nav-items" id="navg' + gi + '" hidden>';
      g.items.forEach(function (i) {
        html += '<li><button data-i="' + i + '"><span class="n">' + (i + 1) + '</span><span class="t">' +
          escapeHTML(screens[i].dataset.title) + '</span>' + icon('circle-check', 'v') + '</button></li>';
      });
      html += '</ol></div>';
    });
    var list = $('#menuList');
    list.innerHTML = html;
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (b) { go(parseInt(b.dataset.i, 10)); closeMenu(); return; }
      var m = e.target.closest('.nav-mod');
      if (m) {
        var gi = m.parentNode.dataset.g;
        openGroups[gi] = m.getAttribute('aria-expanded') !== 'true';
        refreshNav();
      }
    });
  }

  function refreshNav() {
    var curGroup = null;
    $$('#menuList .nav-group').forEach(function (g) {
      var items = $$('button[data-i]', g);
      var seen = 0;
      items.forEach(function (b) {
        var i = parseInt(b.dataset.i, 10);
        var isCur = i === current;
        b.classList.toggle('cur', isCur);
        b.classList.toggle('seen', isVisited(i));
        if (isCur) { b.setAttribute('aria-current', 'page'); curGroup = g.dataset.g; } else b.removeAttribute('aria-current');
        if (isVisited(i)) seen++;
      });
      $('[data-count]', g).textContent = seen + '/' + items.length;
      g.dataset.hasCur = items.some(function (b) { return b.classList.contains('cur'); }) ? '1' : '';
    });
    $$('#menuList .nav-group').forEach(function (g) {
      var open = g.dataset.g === curGroup ? openGroups[g.dataset.g] !== false : !!openGroups[g.dataset.g];
      $('.nav-mod', g).setAttribute('aria-expanded', String(open));
      $('.nav-items', g).hidden = !open;
    });
    var visited = 0;
    for (var i = 0; i < screens.length; i++) if (isVisited(i)) visited++;
    var pct = Math.round(visited / screens.length * 100);
    $('#visitedPct').textContent = pct + ' %';
    $('#visitedBar').style.width = pct + '%';
    $('#visitedText').textContent = visited + ' de ' + screens.length + ' pantallas vistas';
  }

  function menuIsOverlay() { return $('#menu').classList.contains('open'); }
  function openMenu() {
    if (desktopQuery.matches) return;
    refreshNav();
    $('#menu').classList.add('open');
    $('#menuBackdrop').hidden = false;
    $('#menuBtn').setAttribute('aria-expanded', 'true');
    var cur = $('#menuList button.cur') || $('#menuClose');
    setTimeout(function () { cur.focus(); }, 60);
  }
  function closeMenu(restoreFocus) {
    if (!menuIsOverlay()) return;
    $('#menu').classList.remove('open');
    $('#menuBackdrop').hidden = true;
    $('#menuBtn').setAttribute('aria-expanded', 'false');
    if (restoreFocus) $('#menuBtn').focus();
  }
  $('#menuBtn').addEventListener('click', openMenu);
  $('#menuClose').addEventListener('click', function () { closeMenu(true); });
  $('#menuBackdrop').addEventListener('click', function () { closeMenu(true); });
  var onDesktopChange = function () { closeMenu(false); };
  if (desktopQuery.addEventListener) desktopQuery.addEventListener('change', onDesktopChange);
  else if (desktopQuery.addListener) desktopQuery.addListener(onDesktopChange);

  /* ------------------------------------------------------------------ */
  /* Insight: guion, lectura y voz                                        */
  /* ------------------------------------------------------------------ */
  var audioEl = null;
  var speaking = false;

  var videoEl = null;
  var lastFocus = null;

  function screenFile(ext, folder) {
    var n = current + 1;
    return folder + '/pantalla-' + (n < 10 ? '0' : '') + n + '.' + ext;
  }

  function showAvatarImage() {
    videoEl = null;
    $('#seekRow').hidden = true; // sin video no hay barra de avance
    $('#insightMedia').classList.remove('is-video');
    $('#insightMedia').innerHTML = '<img src="assets/insight.webp" alt="Insight, guía virtual">';
  }
  // Un play() interrumpido por una pausa (o bloqueado por el navegador) no es un error del video:
  // solo se cambia a la imagen cuando el archivo no se puede reproducir
  function onPlayFail(e) {
    if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) { setSpeaking(false); return; }
    videoFallback();
  }
  // Si el video no existe o no se puede reproducir: imagen + voz del navegador (una sola vez)
  function videoFallback() {
    if (!videoEl) return;
    var wasPlaying = speaking;
    showAvatarImage();
    if (wasPlaying) speak();
  }

  // En las actividades y la evaluación final Insight no aparece: solo se escucha su voz
  function isActivity(s) { return /^(Actividad|Evaluación final)/.test(s.dataset.title); }

  /* Citas de la transcripción: se muestran debajo de cada párrafo, con el mismo diseño de las
     páginas. El texto del guion no cambia; también se reconocen citas con un paréntesis de menos. */
  var AUTH = '[A-ZÁÉÍÓÚÖ][\\wáéíóúñöüčÁÉÍÓÚÑÖ\\-]*(?:\\s+(?:et\\s+al\\.?|&amp;|&|y|[A-ZÁÉÍÓÚÖ][\\wáéíóúñöüčÁÉÍÓÚÑÖ\\-]*))*';
  var ITEM = AUTH + ',\\s*\\d{4}[a-z]?';
  var LIST = ITEM + '(?:\\s*;\\s*' + ITEM + ')*';
  var T_BALANCED = /\s*\(([^()]*?,\s*\d{4}[a-z]?(?:\s*;[^()]*?,\s*\d{4}[a-z]?)*)\)/g;
  var T_OPEN_END = /\s*\(([^()]*?,\s*\d{4}[a-z]?(?:\s*;[^()]*?,\s*\d{4}[a-z]?)*)\s*$/;
  var T_NO_OPEN = new RegExp('\\s*(' + LIST + ')\\)', 'g');
  // Una sola pasada para conservar el orden en que aparecen las citas
  var T_ANY = new RegExp(T_BALANCED.source + '|' + T_NO_OPEN.source, 'g');
  function citeTranscript(box) {
    $$('p', box).forEach(function (p) {
      var found = [];
      var take = function (m, a, b) { found.push((a || b).trim()); return ' '; };
      var t = p.innerHTML.replace(T_ANY, take).replace(T_OPEN_END, take);
      if (!found.length) return;
      t = t.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').replace(/([.!?])\s*\./g, '$1').trim();
      p.innerHTML = t + '<span class="cite">' + icon('book-open') + '<span>' + found.join('<br>') + '</span></span>';
    });
  }
  // Texto que lee la voz: el párrafo sin sus citas
  function spokenText(p) {
    var c = p.cloneNode(true);
    $$('.cite', c).forEach(function (x) { x.remove(); });
    return c.textContent.replace(/\([^)]*\d{4}[^)]*\)/g, '');
  }

  // Video de Insight de una pantalla (data-video="modulo1-1" → video/modulo1-1.mp4)
  function videoSrc(s) { return USE_AVATAR_VIDEO && s.dataset.video ? 'video/' + s.dataset.video + '.mp4' : ''; }
  function cardVideo(s) { return $('.insight-media.is-video video', s); }
  var voiceSrc = null;

  function openDrawer(autoplay) {
    var s = screens[current];
    var audio = $('.audio', s);
    var voiceOnly = isActivity(s);
    var src = videoSrc(s);
    // Si el video de la tarjeta ya iba avanzando, la ventana sigue desde ese punto
    var card = cardVideo(s);
    var resumeAt = card ? card.currentTime || 0 : 0;
    var wasPlaying = !!(card && !card.paused && !card.ended);
    if (card) card.pause();
    lastFocus = document.activeElement;
    $('#drawer').classList.toggle('voice-only', voiceOnly);
    $('#drawerSub').textContent = s.dataset.title;
    $('#drawerScript').innerHTML = audio ? audio.innerHTML : '<p>Esta pantalla no tiene audio.</p>';
    citeTranscript($('#drawerScript'));
    voiceSrc = voiceOnly && src ? src : null; // actividades: se oye el audio del video, sin imagen
    if (src && !voiceOnly) {
      // Sin controles nativos: el video se recorta para ocultar la marca de agua (ver styles.css)
      $('#insightMedia').innerHTML = '<video src="' + src + '" playsinline preload="auto"></video>';
      videoEl = $('#insightMedia video');
      ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked'].forEach(function (ev) {
        videoEl.addEventListener(ev, function (e) { if (e.target === videoEl) paintDrawerSeek(); });
      });
      $('#seekRow').hidden = false;
      paintDrawerSeek();
      videoEl.addEventListener('click', function () { if (videoEl.paused) play(); else stopSpeech(); });
      videoEl.addEventListener('error', videoFallback);
      // Solo cuenta el video que sigue en pantalla (uno descartado puede emitir eventos tarde)
      var onVideo = function (on) { return function (e) { if (e.target === videoEl) setSpeaking(on); }; };
      videoEl.addEventListener('play', onVideo(true));
      videoEl.addEventListener('pause', onVideo(false));
      videoEl.addEventListener('ended', onVideo(false));
      $('#insightMedia').classList.add('is-video');
    } else {
      showAvatarImage();
      $('#insightMedia').classList.remove('is-video');
    }
    $('#drawer').hidden = false;
    $('#drawerBackdrop').hidden = false;
    setTimeout(function () { $('#drawerClose').focus(); }, 50);
    if (audio && (autoplay || wasPlaying)) play(resumeAt);
    else if (videoEl && resumeAt) seekWhenReady(videoEl, resumeAt);
  }
  // Un video recién creado aún no tiene datos: el salto se aplica cuando ya puede buscar
  function seekWhenReady(v, t) {
    if (!t) return;
    if (v.readyState >= 1) { v.currentTime = t; return; }
    v.addEventListener('loadedmetadata', function () { v.currentTime = t; }, { once: true });
  }
  function closeDrawer() {
    if ($('#drawer').hidden) return;
    // La tarjeta de la pantalla queda en el mismo punto del video
    var card = cardVideo(screens[current]);
    if (card && videoEl && videoEl.currentTime) { try { card.currentTime = videoEl.currentTime; } catch (e) { /* sin datos aún */ } }
    stopSpeech();
    $('#drawer').hidden = true;
    $('#drawerBackdrop').hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function setSpeaking(on) {
    $('#drawer').classList.toggle('speaking', on);
    $('#playBtn span').textContent = on ? 'Reproduciendo…' : 'Escuchar';
  }

  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    var voices = speechSynthesis.getVoices();
    var prefs = ['es-CO', 'es-419', 'es-MX', 'es-US', 'es-ES'];
    for (var i = 0; i < prefs.length; i++) {
      for (var j = 0; j < voices.length; j++) if (voices[j].lang.replace('_', '-') === prefs[i]) return voices[j];
    }
    for (var k = 0; k < voices.length; k++) if (/^es/i.test(voices[k].lang)) return voices[k];
    return null;
  }

  function play(from) {
    var resume = typeof from === 'number' ? from : null;
    stopSpeech();
    if (videoEl) { // video del avatar: reemplaza la voz del navegador
      speaking = true;
      if (resume != null) seekWhenReady(videoEl, resume);
      else if (videoEl.ended) videoEl.currentTime = 0; // «Escuchar» continúa donde se pausó
      videoEl.play().catch(onPlayFail);
      return;
    }
    if (voiceSrc || USE_AUDIO_FILES) {
      audioEl = new Audio(voiceSrc || screenFile('mp3', 'audio'));
      audioEl.addEventListener('error', speak);
      audioEl.addEventListener('ended', function () { setSpeaking(false); });
      audioEl.play().catch(speak);
      setSpeaking(true);
      return;
    }
    speak();
  }

  function speak() {
    if (!('speechSynthesis' in window)) { toast('Tu navegador no permite leer en voz alta; lee el guion en el panel.'); return; }
    var paras = $$('#drawerScript p');
    var voice = pickVoice();
    speaking = true;
    setSpeaking(true);
    var i = 0;
    var next = function () {
      paras.forEach(function (p) { p.classList.remove('speaking'); });
      if (!speaking || i >= paras.length) { stopSpeech(); return; }
      var p = paras[i++];
      p.classList.add('speaking');
      var u = new SpeechSynthesisUtterance(spokenText(p));
      u.lang = voice ? voice.lang : 'es-CO';
      if (voice) u.voice = voice;
      u.rate = 1;
      u.onend = next;
      u.onerror = function () { stopSpeech(); };
      speechSynthesis.speak(u);
    };
    next();
  }

  function stopSpeech() {
    speaking = false;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (audioEl) { audioEl.pause(); audioEl = null; }
    if (videoEl && !videoEl.paused) videoEl.pause();
    $$('#drawerScript p').forEach(function (p) { p.classList.remove('speaking'); });
    setSpeaking(false);
  }

  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = function () {};
  $('#audioBtn').addEventListener('click', function () { openDrawer(true); });
  $('#playBtn').addEventListener('click', function () { play(); });
  // Avance del video en la ventana: barra, retroceder y adelantar 10 s, tiempo transcurrido
  function paintDrawerSeek() {
    paintSeek($('#drawerSeek'), videoEl);
    $('#drawerTime').textContent = videoEl ? fmtTime(videoEl.currentTime) + ' / ' + fmtTime(videoEl.duration) : '';
  }
  bindSeek($('#drawerSeek'), function () { return videoEl; });
  var jump = function (sec) {
    if (!videoEl) return;
    var d = isFinite(videoEl.duration) ? videoEl.duration : Infinity;
    videoEl.currentTime = Math.max(0, Math.min(d, videoEl.currentTime + sec));
    paintDrawerSeek();
  };
  $('#backBtn').addEventListener('click', function () { jump(-10); });
  $('#fwdBtn').addEventListener('click', function () { jump(10); });
  $('#stopBtn').addEventListener('click', stopSpeech);
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#drawerBackdrop').addEventListener('click', closeDrawer);

  // Celulares y tablets: la ventana es una hoja inferior que se cierra deslizándola hacia abajo
  // desde su barra superior (ver «hoja inferior» en styles.css)
  (function () {
    var sheet = $('#drawer'), grip = $('#drawer header');
    var mq = window.matchMedia('(max-width: 899px)');
    var startY = null, dy = 0;
    function settle(close) {
      sheet.classList.remove('dragging');
      sheet.classList.add('settling');
      sheet.style.transform = close ? 'translateY(100%)' : '';
      setTimeout(function () {
        sheet.classList.remove('settling');
        if (close) { closeDrawer(); sheet.style.transform = ''; }
      }, close ? 200 : 230);
    }
    grip.addEventListener('touchstart', function (e) {
      if (!mq.matches || e.touches.length !== 1 || e.target.closest('button')) return;
      startY = e.touches[0].clientY; dy = 0;
      sheet.classList.add('dragging');
    }, { passive: true });
    grip.addEventListener('touchmove', function (e) {
      if (startY == null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    function end() {
      if (startY == null) return;
      startY = null;
      settle(dy > Math.min(120, sheet.offsetHeight * 0.25));
    }
    grip.addEventListener('touchend', end);
    grip.addEventListener('touchcancel', end);
  })();

  // Orden aleatorio para que las actividades no sean lineales: reordena los elementos
  // existentes (conservan sus eventos y datos) dentro de su contenedor
  function shuffleIndexes(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; }
    return a;
  }
  function shuffleChildren(parent, selector) {
    if (!parent) return;
    var items = $$(selector, parent).filter(function (el) { return el.parentNode === parent; });
    shuffleIndexes(items.length).forEach(function (i) { parent.appendChild(items[i]); });
  }

  /* ------------------------------------------------------------------ */
  /* Actividad: arrastrar y soltar (1, 3, 5, 6)                           */
  /* ------------------------------------------------------------------ */
  function initDnD(root) {
    var key = root.dataset.act;
    var pool = $('.dnd-items', root);
    var zones = $$('.zone', root);
    var fb = $('.feedback', root);
    var scoreBox = $('.score', root);
    var verifyBtn = $('[data-verify]', root);
    var chips = $$('.chip', root);
    var selected = null;
    var dragged = null;
    var checked = false;
    shuffleChildren(pool, '.chip');

    function showScore() {
      var sc = state.s[key] || 0;
      scoreBox.innerHTML = '<span>Puntos: ' + sc + ' / 100</span>' + stars(sc);
    }
    showScore();
    if ((state.t[key] || 0) >= MAX_ATTEMPTS) { // al volver al curso: avisar desde el inicio
      fb.className = 'feedback info';
      fb.textContent = 'Ya usaste tus ' + MAX_ATTEMPTS + ' intentos. Tu mejor puntaje quedó registrado.';
    }

    function clearMarks() { chips.forEach(function (c) { c.classList.remove('right', 'wrong'); }); }
    function select(chip) {
      if (selected) selected.classList.remove('selected');
      selected = chip === selected ? null : chip;
      if (selected) selected.classList.add('selected');
      zones.forEach(function (z) { z.classList.toggle('armed', !!selected); });
    }
    function place(chip, target) {
      target.appendChild(chip);
      chip.classList.remove('selected', 'right', 'wrong');
      selected = null;
      zones.forEach(function (z) { z.classList.remove('armed', 'over'); });
      if (checked) { checked = false; verifyBtn.textContent = 'Verificar respuestas'; }
    }

    chips.forEach(function (chip) {
      chip.setAttribute('draggable', 'true');
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('role', 'button');
      chip.addEventListener('dragstart', function (e) {
        dragged = chip;
        chip.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', chip.dataset.id); } catch (err) { /* IE */ }
      });
      chip.addEventListener('dragend', function () { chip.classList.remove('dragging'); dragged = null; });
      chip.addEventListener('click', function (e) { e.stopPropagation(); select(chip); });
      chip.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(chip); } });
    });

    zones.concat([pool]).forEach(function (z) {
      z.addEventListener('dragover', function (e) { e.preventDefault(); z.classList.add('over'); });
      z.addEventListener('dragleave', function () { z.classList.remove('over'); });
      z.addEventListener('drop', function (e) { e.preventDefault(); z.classList.remove('over'); if (dragged) place(dragged, z); });
      z.addEventListener('click', function () { if (selected) place(selected, z); });
    });
    zones.forEach(function (z) {
      z.setAttribute('tabindex', '0');
      z.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && selected) { e.preventDefault(); place(selected, z); } });
    });

    verifyBtn.addEventListener('click', function () {
      var attempts = state.t[key] || 0;
      if (checked) { // reintentar: las tarjetas mal ubicadas vuelven a la lista
        chips.forEach(function (c) { if (c.classList.contains('wrong')) pool.appendChild(c); });
        shuffleChildren(pool, '.chip');
        clearMarks();
        checked = false;
        verifyBtn.textContent = 'Verificar respuestas';
        fb.className = 'feedback info';
        fb.textContent = 'Te quedan ' + (MAX_ATTEMPTS - attempts) + ' intento(s).';
        return;
      }
      var unplaced = chips.filter(function (c) { return c.parentNode === pool; });
      if (unplaced.length) {
        fb.className = 'feedback info';
        fb.textContent = 'Ubica todas las tarjetas antes de verificar (faltan ' + unplaced.length + ').';
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        fb.className = 'feedback info';
        fb.textContent = 'Ya usaste tus ' + MAX_ATTEMPTS + ' intentos. Tu mejor puntaje quedó registrado.';
        return;
      }
      var right = 0;
      chips.forEach(function (c) {
        var ok = c.parentNode.dataset.id === c.dataset.ans;
        c.classList.add(ok ? 'right' : 'wrong');
        if (ok) right++;
      });
      var score = right / chips.length * 100;
      state.t[key] = attempts + 1;
      setScore(key, score);
      SCORM.interaction(key + '_intento' + (attempts + 1), 'matching', right + '/' + chips.length, score === 100 ? 'correct' : 'wrong');
      showScore();
      var perfect = right === chips.length;
      fb.className = 'feedback ' + (perfect ? 'ok' : 'bad');
      fb.textContent = (perfect ? root.dataset.ok : right + ' de ' + chips.length + ' correctas. ' + root.dataset.bad);
      if (!perfect && state.t[key] < MAX_ATTEMPTS) { checked = true; verifyBtn.textContent = 'Intentar de nuevo'; }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Actividad 2: detective de datos                                      */
  /* ------------------------------------------------------------------ */
  function initDetective(root) {
    var ANSWERS = { e1: 'unicidad', e2: 'validez', e3: 'consistencia', e4: 'completitud', e5: 'exactitud' };
    var LABELS = { e1: 'ID duplicado', e2: 'Edad −5', e3: 'País COL / colombia', e4: 'Correo vacío', e5: 'Compra en 2031' };
    var picks = {};
    var selectedCell = null;
    var fb = $('[data-fb]', root);
    var status = $('[data-status]', root);
    var dimBtns = $$('.classify button', root);
    var lastScore = null;
    // Filas de la tabla y botones de clasificación en orden aleatorio
    shuffleChildren($('tbody', root), 'tr');
    shuffleChildren($('.classify', root), 'button');
    var heads = $$('thead th', root).map(function (th) { return th.textContent; });
    $$('tbody tr', root).forEach(function (tr) {
      $$('td', tr).forEach(function (td, c) { td.setAttribute('data-label', heads[c] || ''); });
    });

    function refresh() {
      var n = Object.keys(picks).length;
      status.textContent = 'Errores encontrados: ' + n + ' de 5 · Puntos: ' + (lastScore == null ? (state.s.a2 || 0) : lastScore);
    }
    refresh();
    if ((state.t.a2 || 0) >= MAX_ATTEMPTS) { // al volver al curso: avisar desde el inicio
      fb.className = 'feedback info';
      fb.textContent = 'Ya usaste tus ' + MAX_ATTEMPTS + ' intentos. Tu mejor puntaje quedó registrado.';
    }

    $$('td', root).forEach(function (td) {
      $('button', td).addEventListener('click', function () {
        $$('td.sel', root).forEach(function (x) { x.classList.remove('sel'); });
        if (!td.dataset.err) {
          selectedCell = null;
          dimBtns.forEach(function (b) { b.disabled = true; });
          fb.className = 'feedback info';
          fb.textContent = 'Ese dato parece correcto. Sigue buscando.';
          return;
        }
        selectedCell = td;
        td.classList.add('sel');
        dimBtns.forEach(function (b) { b.disabled = false; });
        fb.className = 'feedback info';
        fb.textContent = '¡Celda sospechosa! ¿A qué característica de calidad pertenece el error?';
      });
    });

    dimBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (!selectedCell) return;
        var err = selectedCell.dataset.err;
        picks[err] = b.dataset.dim;
        $$('td[data-err="' + err + '"]', root).forEach(function (td) { td.classList.remove('found'); var old = $('.badge', td); if (old) old.remove(); });
        selectedCell.classList.add('found');
        selectedCell.classList.remove('sel');
        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = err.slice(1);
        selectedCell.appendChild(badge);
        selectedCell = null;
        dimBtns.forEach(function (x) { x.disabled = true; });
        fb.className = 'feedback info';
        fb.textContent = 'Clasificado como «' + b.textContent + '». Busca el siguiente.';
        refresh();
      });
    });

    $('[data-verify]', root).addEventListener('click', function () {
      var attempts = state.t.a2 || 0;
      if (attempts >= MAX_ATTEMPTS) {
        fb.className = 'feedback info';
        fb.textContent = 'Ya usaste tus ' + MAX_ATTEMPTS + ' intentos. Tu mejor puntaje quedó registrado.';
        return;
      }
      if (!Object.keys(picks).length) {
        fb.className = 'feedback info';
        fb.textContent = 'Primero pulsa una celda sospechosa y clasifica el error.';
        return;
      }
      var ok = 0, misses = [];
      Object.keys(ANSWERS).forEach(function (k) {
        if (picks[k] === ANSWERS[k]) ok++;
        else misses.push(LABELS[k] + (picks[k] ? ' (revisa la clasificación)' : ' (no encontrado)'));
      });
      lastScore = ok * 20;
      state.t.a2 = attempts + 1;
      setScore('a2', lastScore);
      SCORM.interaction('a2_intento' + (attempts + 1), 'performance', ok + '/5', ok === 5 ? 'correct' : 'wrong');
      refresh();
      fb.className = 'feedback ' + (ok === 5 ? 'ok' : 'bad');
      fb.textContent = ok === 5
        ? '¡Excelente! Encontraste y clasificaste los 5 errores.'
        : 'Encontraste ' + ok + ' de 5 errores bien clasificados. Pendientes: ' + misses.join('; ') + '.' +
          (state.t.a2 < MAX_ATTEMPTS ? ' Puedes corregir y verificar de nuevo.' : '');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Cuestionarios                                                        */
  /* ------------------------------------------------------------------ */
  var QUIZZES = {
    a4: {
      tries: 1,
      questions: [
        { q: '¿Cuál es la primera fase del proceso de toma de decisiones?', o: ['Implementación', 'Diseño', 'Inteligencia', 'Evaluación'], a: 2,
          e: 'La fase de inteligencia identifica el problema o la oportunidad a partir de los datos.' },
        { q: '¿Qué se hace en la fase de diseño?', o: ['Se ejecuta la decisión elegida.', 'Se plantean y analizan posibles soluciones.', 'Se revisan los resultados finales.', 'Se identifica el problema por primera vez.'], a: 1,
          e: 'En el diseño se generan alternativas y se analizan sus posibles resultados con modelos y escenarios.' },
        { q: '¿En qué fase se selecciona la alternativa más conveniente?', o: ['Inteligencia', 'Implementación', 'Revisión', 'Elección o selección'], a: 3,
          e: 'En la elección se comparan las alternativas (costos, tiempo, criterios) y se escoge la mejor.' },
        { q: '¿Qué ocurre durante la fase de implementación?', o: ['Se pone en práctica la solución elegida.', 'Se identifican nuevas oportunidades.', 'Se comparan diferentes alternativas.', 'Se revisan los resultados obtenidos.'], a: 0,
          e: 'Implementar es ejecutar la decisión con un plan de acción.' },
        { q: '¿Cuál es el objetivo de la fase de revisión o evaluación?', o: ['Identificar el problema inicial.', 'Crear alternativas de solución.', 'Comprobar los resultados y detectar posibles mejoras.', 'Elegir una alternativa antes de analizarla.'], a: 2,
          e: 'La revisión mide los resultados con KPI y genera aprendizaje para mejorar.' }
      ]
    },
    final1: {
      tries: 2, offset: 0, total: 10,
      note: 'Cada pregunta vale 10 puntos; se muestra realimentación inmediata y se permiten 2 intentos.',
      questions: [
        { q: 'Una aseguradora combina reclamos en PDF, audios de llamadas y fotos de siniestros. ¿Qué V representa el mayor reto para integrarlos?', o: ['Volumen', 'Velocidad', 'Variedad', 'Valor'], a: 2,
          e: 'Se trata de formatos y estructuras distintos (texto, audio, imagen), que es la variedad.' },
        { q: 'Un reporte de ventas por país muestra dos filas separadas: COL y Colombia. ¿Qué dimensión de calidad se está incumpliendo?', o: ['Exactitud', 'Unicidad', 'Consistencia', 'Oportunidad'], a: 2,
          e: 'El mismo valor se registra con formatos distintos entre sistemas: es un problema de consistencia.' },
        { q: 'Una empresa quiere usar la base de clientes, recolectada para facturación, en una campaña de marketing sin pedir nueva autorización. ¿Qué debería hacer según la Ley 1581 de 2012 y el Decreto 1377 de 2013?', o: ['Informar la nueva finalidad y obtener la autorización del titular', 'Usarla, porque ya es de la empresa', 'Usarla si los datos son exactos', 'Eliminar todos los datos'], a: 0,
          e: 'Toda nueva finalidad del tratamiento debe informarse y contar con la autorización del titular.' },
        { q: 'Una cadena ya cuenta con el pronóstico de demanda por tienda y ahora debe decidir cuántas unidades enviar a cada una para minimizar costos. ¿Qué tipo de analítica necesita?', o: ['Descriptiva', 'Diagnóstica', 'Predictiva', 'Prescriptiva'], a: 3,
          e: 'Ya tiene la predicción; ahora necesita recomendar la mejor acción (optimizar): analítica prescriptiva.' },
        { q: 'El comité compara tres alternativas según su costo y tiempo, y escoge una. ¿En qué fase del proceso está?', o: ['Inteligencia', 'Elección', 'Diseño', 'Revisión'], a: 1,
          e: 'Comparar alternativas y escoger una corresponde a la fase de elección.' }
      ]
    },
    final2: {
      tries: 2, offset: 5, total: 10,
      note: 'Aprobación: 70 puntos o más.',
      questions: [
        { q: 'Un tablero muestra 4.820 pedidos (sobre la meta), conversión de 3,1 % y cancelación de 14 %. ¿Cuál es la lectura más acertada?', o: ['Todo va bien, porque se superó la meta', 'Hay que bajar precios', 'La conversión es el único indicador importante', 'El problema no es vender sino retener; hay que investigar las causas de la cancelación'], a: 3,
          e: 'Superar la meta de pedidos no compensa una cancelación del 14 %: el foco es retener.' },
        { q: 'Un gráfico de barras con el eje vertical iniciando en 96 muestra que el producto B (100) vende el doble que A (98). ¿Cómo se corrige?', o: ['Iniciar el eje en cero y mostrar todo el periodo', 'Usar un gráfico 3D', 'Cambiar a pastel', 'Quitar los títulos'], a: 0,
          e: 'El eje truncado exagera la diferencia; con el eje en cero se ve que es solo del 2 %.' },
        { q: 'Un asistente de IA resume las causas de la caída en el Norte e incluye una cifra (18 % por la campaña) que no aparece en tu tabla. ¿Qué haces?', o: ['Usarla, porque la IA es precisa', 'Pedirle que la repita con más seguridad', 'Verificarla contra los datos originales y pedir las fuentes antes de usarla', 'Subir más datos confidenciales para mejorar la respuesta'], a: 2,
          e: 'Una cifra sin respaldo puede ser una «alucinación»: verifica contra los datos y pide fuentes.' },
        { q: 'Un modelo de crédito rechaza más solicitudes de un grupo de clientes y nadie puede explicar por qué. ¿Qué medida es la más adecuada?', o: ['Mantenerlo, porque es rápido', 'Auditar el sesgo, usar herramientas de explicabilidad (SHAP/LIME) y agregar revisión humana', 'Guardar más datos del grupo', 'Cambiar solo el gráfico del reporte'], a: 1,
          e: 'Equidad, explicabilidad y supervisión humana son obligatorias en decisiones de alto impacto.' },
        { q: 'Con demanda = 1.000 − 10P y costo unitario de 20 usd., ¿cuál es el precio óptimo y la utilidad máxima?', o: ['50 usd. y 15.000', '60 usd. y 24.000', '70 usd. y 15.000', '60 usd. y 16.000'], a: 3,
          e: 'P* = (100 + 20) / 2 = 60; demanda = 400; utilidad = (60 − 20) × 400 = 16.000. Los 24.000 son los ingresos, no la utilidad.' }
      ]
    }
  };

  function initQuiz(root) {
    var id = root.dataset.quiz;
    var cfg = QUIZZES[id];
    var isFinal = id !== 'a4';
    var qs = cfg.questions;
    var results = []; // a4: resultados de la ronda actual
    var idx = 0, tries = 0, choice = null, phase = 'ask';
    // Orden aleatorio de las preguntas en cada ronda. idx sigue siendo el índice original,
    // así el progreso guardado, el puntaje y SCORM no cambian.
    var order = [];
    function shuffled(n) {
      var a = [];
      for (var i = 0; i < n; i++) a.push(i);
      for (var j = n - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; }
      return a;
    }
    // Las ya respondidas (al volver al curso) van primero para que la numeración siga coherente
    function reshuffle() {
      var done = [], pending = [];
      shuffled(qs.length).forEach(function (i) { (stored(i) == null ? pending : done).push(i); });
      done.sort(function (a, b) { return a - b; });
      order = done.concat(pending);
    }

    function stored(i) { return isFinal ? state.q[cfg.offset + i] : results[i]; }
    reshuffle();

    function firstPending() {
      for (var p = 0; p < order.length; p++) if (stored(order[p]) == null) return order[p];
      return -1;
    }

    function dots() {
      var html = '<div class="qdots">';
      for (var p = 0; p < order.length; p++) {
        var i = order[p];
        var r = stored(i);
        var cls = r == null ? (i === idx ? 'cur' : '') : (r > 0 ? 'r' : 'w');
        html += '<i class="' + cls + '"></i>';
      }
      return html + '</div>';
    }

    function render() {
      var q = qs[idx];
      var pos = order.indexOf(idx);
      var n = isFinal ? cfg.offset + pos + 1 : pos + 1;
      var total = isFinal ? cfg.total : qs.length;
      var letters = 'ABCD';
      var html = '<aside class="quiz-side">' + spot(isFinal ? 'trophy' : 'file-question-mark') +
        '<p class="quiz-count"><b>Pregunta ' + n + '</b> de ' + total + '</p>' + dots() +
        (cfg.note ? '<p class="quiz-note">' + icon('info') + cfg.note + '</p>' : '') + '</aside>' +
        '<div class="quiz-main"><div class="qbox"><span class="qnum">' + n + '</span><span>' + escapeHTML(q.q) + '</span></div><div class="options">';
      // Opciones en orden aleatorio: data-o conserva el índice original (para calificar);
      // la letra corresponde a la posición en pantalla
      shuffled(q.o.length).forEach(function (i, p) {
        html += '<button class="opt" data-o="' + i + '"><span class="opt-key">' + letters[p] + '</span><span>' + escapeHTML(q.o[i]) + '</span></button>';
      });
      html += '</div><div class="qfoot"><div class="feedback info" data-fb>Elige una opción y comprueba tu respuesta.</div>' +
        '<button class="btn" data-act-btn disabled>Comprobar' + icon('arrow-right') + '</button></div></div>';
      root.innerHTML = html;
      tries = 0; choice = null; phase = 'ask';
      $$('.opt', root).forEach(function (b) {
        b.addEventListener('click', function () {
          if (phase !== 'ask') return;
          $$('.opt', root).forEach(function (x) { x.classList.remove('chosen'); });
          b.classList.add('chosen');
          choice = parseInt(b.dataset.o, 10);
          $('[data-act-btn]', root).disabled = false;
        });
      });
      $('[data-act-btn]', root).addEventListener('click', onAction);
    }

    function record(points) {
      var q = qs[idx];
      if (isFinal) {
        state.q[cfg.offset + idx] = points;
        SCORM.interaction('final_p' + (cfg.offset + idx + 1), 'choice', 'ABCD'.charAt(choice), points > 0 ? 'correct' : 'wrong');
        updateGrade();
        saveState(true);
      } else {
        results[idx] = points;
      }
      return q;
    }

    function onAction() {
      var btn = $('[data-act-btn]', root);
      var fb = $('[data-fb]', root);
      var q = qs[idx];
      if (phase === 'next') {
        var nxt = firstPending();
        if (nxt === -1) summary(); else { idx = nxt; render(); }
        return;
      }
      if (choice == null) return;
      tries++;
      var opt = $('.opt[data-o="' + choice + '"]', root);
      if (choice === q.a) {
        opt.classList.remove('chosen');
        opt.classList.add('right');
        record(isFinal ? 10 : 20);
        fb.className = 'feedback ok';
        fb.textContent = 'Correcto. ' + q.e;
        endQuestion(btn);
      } else if (tries < cfg.tries) {
        opt.classList.remove('chosen');
        opt.classList.add('wrong');
        opt.disabled = true;
        choice = null;
        btn.disabled = true;
        fb.className = 'feedback bad';
        fb.textContent = 'Aún no. Te queda 1 intento: vuelve a leer la pregunta.';
      } else {
        opt.classList.remove('chosen');
        opt.classList.add('wrong');
        $('.opt[data-o="' + q.a + '"]', root).classList.add('right');
        record(0);
        fb.className = 'feedback bad';
        fb.textContent = 'Aún no. ' + q.e;
        endQuestion(btn);
      }
    }

    function endQuestion(btn) {
      phase = 'next';
      $$('.opt', root).forEach(function (b) { b.disabled = true; });
      btn.disabled = false;
      btn.innerHTML = (firstPending() === -1 ? 'Finalizar' : 'Siguiente') + icon('arrow-right');
      var d = $('.qdots', root);
      if (d) d.outerHTML = dots();
    }

    function summary() {
      var html;
      if (isFinal) {
        var g = grade();
        var part = 0;
        for (var i = 0; i < qs.length; i++) part += stored(i) || 0;
        html = '<p class="label">Evaluación final · ' + (cfg.offset === 0 ? 'parte 1' : 'parte 2') + '</p>' +
          '<div class="qbox">Obtuviste ' + part + ' de ' + (qs.length * 10) + ' puntos en esta parte.</div>';
        if (cfg.offset === 0) {
          html += '<div class="feedback ok">Continúa con las preguntas 6 a 10.</div><div class="row-end"><button class="btn" data-goto="final2">Ir a la parte 2' + icon('arrow-right') + '</button></div>';
        } else if (g.done) {
          html += '<div class="feedback ' + (g.fin >= PASS_SCORE ? 'ok' : 'bad') + '">Evaluación final: ' + g.fin + ' / 100. ' +
            (g.fin >= PASS_SCORE ? '¡Aprobaste la evaluación!' : 'Repasa los módulos y vuelve a intentarlo.') + '</div><div class="row-end">' +
            (g.fin < PASS_SCORE ? '<button class="btn ghost" data-reset-final>Reiniciar evaluación</button>' : '') +
            '<button class="btn" data-next>Ver resultados' + icon('arrow-right') + '</button></div>';
        } else {
          html += '<div class="feedback info">Te faltan preguntas de la parte 1.</div><div class="row-end"><button class="btn" data-goto="final1">Ir a la parte 1' + icon('arrow-right') + '</button></div>';
        }
      } else {
        var sc = results.reduce(function (a, b) { return a + (b || 0); }, 0);
        state.t.a4 = (state.t.a4 || 0) + 1;
        setScore('a4', sc);
        SCORM.interaction('a4_intento' + state.t.a4, 'choice', (sc / 20) + '/5', sc >= 60 ? 'correct' : 'wrong');
        var pass = sc >= 60;
        html = '<p class="label">Resultado del cuestionario</p><div class="qbox score-box">Puntos: ' + sc + ' / 100 ' + stars(sc) + '</div>' +
          '<div class="feedback ' + (pass ? 'ok' : 'bad') + '">' + (pass ? 'Buen trabajo. Has pasado el cuestionario.' : 'Vuelve a revisar las fases de la toma de decisiones e inténtalo de nuevo.') + '</div>' +
          '<div class="row-end">' + (sc < 100 && state.t.a4 < MAX_ATTEMPTS ? '<button class="btn ghost" data-retry-quiz>' + icon('rotate-ccw') + 'Intentar de nuevo (' + (MAX_ATTEMPTS - state.t.a4) + ')</button>' : '') +
          '<button class="btn" data-next>Continuar' + icon('arrow-right') + '</button></div>';
      }
      root.innerHTML = '<aside class="quiz-side">' + spot('award') + '<p class="quiz-count"><b>Resultado</b></p>' + dots() +
        '</aside><div class="quiz-main">' + html + '</div>';
      var retry = $('[data-retry-quiz]', root);
      if (retry) retry.addEventListener('click', function () { results = []; reshuffle(); idx = order[0]; render(); });
      var reset = $('[data-reset-final]', root);
      if (reset) reset.addEventListener('click', function () {
        state.q = [];
        updateGrade();
        saveState(true);
        go(indexOfId('final1'));
        quizInits.final1.restart();
        quizInits.final2.restart();
      });
    }

    // Cuestionario sin intentos (al volver al curso): se muestra el mejor puntaje en lugar de otra ronda
    function locked() {
      var sc = state.s.a4 || 0;
      root.innerHTML = '<aside class="quiz-side">' + spot('award') + '<p class="quiz-count"><b>Resultado</b></p></aside>' +
        '<div class="quiz-main"><p class="label">Resultado del cuestionario</p><div class="qbox score-box">Puntos: ' + sc + ' / 100 ' + stars(sc) + '</div>' +
        '<div class="feedback info">Ya usaste tus ' + MAX_ATTEMPTS + ' intentos. Tu mejor puntaje quedó registrado.</div>' +
        '<div class="row-end"><button class="btn" data-next>Continuar' + icon('arrow-right') + '</button></div></div>';
    }

    function restart() {
      if (!isFinal && (state.t.a4 || 0) >= MAX_ATTEMPTS) return locked();
      reshuffle();
      var p = firstPending();
      if (p === -1) summary(); else { idx = p; render(); }
    }
    restart();
    return { restart: restart };
  }
  var quizInits = {};

  /* ------------------------------------------------------------------ */
  /* Gráficos SVG                                                         */
  /* ------------------------------------------------------------------ */
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  function axisY(x0, y0, h, min, max, step, w, digits) {
    var s = '';
    for (var v = min; v <= max + 1e-9; v += step) {
      var y = y0 - (v - min) / (max - min) * h;
      s += '<line x1="' + x0 + '" x2="' + (x0 + w) + '" y1="' + y + '" y2="' + y + '" style="stroke:var(--grid)"/>' +
        '<text x="' + (x0 - 6) + '" y="' + (y + 3.5) + '" text-anchor="end" font-size="10" style="fill:var(--muted)">' + (digits ? v.toFixed(digits).replace('.', ',') : fmt(v)) + '</text>';
    }
    return s;
  }

  function chartOrders() {
    var vals = [4100, 4300, 4250, 4600, 4900, 4820], meta = 4500;
    var x0 = 44, y0 = 150, w = 250, h = 130, min = 3600, max = 5000;
    var px = function (i) { return x0 + 16 + i * (w - 32) / 5; };
    var py = function (v) { return y0 - (v - min) / (max - min) * h; };
    var s = '<svg viewBox="0 0 300 190" role="img" aria-label="Pedidos semanales frente a la meta">' + axisY(x0, y0, h, min, max, 200, w);
    s += '<polyline fill="none" style="stroke:var(--muted)" stroke-width="2" points="' + vals.map(function (v, i) { return px(i) + ',' + py(meta); }).join(' ') + '"/>';
    vals.forEach(function (v, i) { s += '<rect x="' + (px(i) - 4) + '" y="' + (py(meta) - 4) + '" width="8" height="8" style="fill:var(--muted)"/>'; });
    s += '<polyline fill="none" style="stroke:var(--teal-fg)" stroke-width="2.5" points="' + vals.map(function (v, i) { return px(i) + ',' + py(v); }).join(' ') + '"/>';
    vals.forEach(function (v, i) {
      s += '<circle cx="' + px(i) + '" cy="' + py(v) + '" r="4" style="fill:var(--teal-fg)"><title>S' + (i + 1) + ': ' + fmt(v) + ' pedidos</title></circle>' +
        '<text x="' + px(i) + '" y="' + (y0 + 14) + '" text-anchor="middle" font-size="10" style="fill:var(--muted)">S' + (i + 1) + '</text>';
    });
    s += '<g font-size="10" style="fill:var(--ink)"><circle cx="100" cy="180" r="4" style="fill:var(--teal-fg)"/><text x="108" y="183">Pedidos</text>' +
      '<rect x="160" y="176" width="8" height="8" style="fill:var(--muted)"/><text x="172" y="183">Meta (4.500)</text></g></svg>';
    return s;
  }

  function chartChannels() {
    var data = [['Tienda', 3], ['App', 4.1], ['Web', 2.4]];
    var x0 = 48, w = 240, max = 4.5;
    var s = '<svg viewBox="0 0 300 190" role="img" aria-label="Conversión por canal">';
    for (var v = 0; v <= max + 1e-9; v += 0.5) {
      var x = x0 + v / max * w;
      s += '<line x1="' + x + '" x2="' + x + '" y1="10" y2="160" style="stroke:var(--grid)"/><text x="' + x + '" y="174" text-anchor="middle" font-size="10" style="fill:var(--muted)">' + String(v).replace('.', ',') + '</text>';
    }
    data.forEach(function (d, i) {
      var y = 22 + i * 48;
      s += '<text x="' + (x0 - 6) + '" y="' + (y + 15) + '" text-anchor="end" font-size="11" style="fill:var(--ink)">' + d[0] + '</text>' +
        '<rect x="' + x0 + '" y="' + y + '" width="' + (d[1] / max * w) + '" height="24" rx="4" style="fill:var(--blue-fg)"><title>' + d[0] + ': ' + String(d[1]).replace('.', ',') + ' %</title></rect>' +
        '<text x="' + (x0 + d[1] / max * w + 5) + '" y="' + (y + 16) + '" font-size="11" style="fill:var(--ink)">' + String(d[1]).replace('.', ',') + '</text>';
    });
    return s + '</svg>';
  }

  function chartBars(min, max, step, color) {
    var x0 = 44, y0 = 160, w = 240, h = 145;
    var s = '<svg viewBox="0 0 300 190" role="img" aria-label="Ventas del producto A y B">' + axisY(x0, y0, h, min, max, step, w);
    // Eje truncado: el inicio del eje se resalta para que se lea claramente
    if (min > 0) {
      s += '<line x1="' + x0 + '" x2="' + (x0 + w) + '" y1="' + y0 + '" y2="' + y0 + '" style="stroke:' + color + '" stroke-width="2" stroke-dasharray="5 4"/>' +
        '<rect x="' + (x0 - 32) + '" y="' + (y0 - 9) + '" width="28" height="17" rx="8.5" style="fill:' + color + '"/>' +
        '<text x="' + (x0 - 18) + '" y="' + (y0 + 3.5) + '" text-anchor="middle" font-size="11" font-weight="800" style="fill:#fff">' + min + '</text>' +
        '<path d="M' + (x0 + 6) + ' ' + (y0 - 6) + ' l5 -4 l-6 -4 l5 -4" fill="none" style="stroke:' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    [['Producto A', 98], ['Producto B', 100]].forEach(function (d, i) {
      var bx = x0 + 30 + i * 120, top = y0 - (d[1] - min) / (max - min) * h;
      s += '<rect x="' + bx + '" y="' + top + '" width="70" height="' + (y0 - top) + '" rx="4" style="fill:' + color + '"/>' +
        '<text x="' + (bx + 35) + '" y="' + (top - 4) + '" text-anchor="middle" font-size="10" style="fill:var(--ink)">' + d[1] + '</text>' +
        '<text x="' + (bx + 35) + '" y="' + (y0 + 15) + '" text-anchor="middle" font-size="10" style="fill:var(--muted)">' + d[0] + '</text>';
    });
    return s + '</svg>';
  }

  var profit = function (p) { return (p - 20) * (1000 - 10 * p); };

  function chartProfit(price) {
    var x0 = 50, y0 = 170, w = 330, h = 150, maxY = 18000;
    var px = function (p) { return x0 + (p - 20) / 80 * w; };
    var py = function (u) { return y0 - Math.max(0, u) / maxY * h; };
    var s = '<svg viewBox="0 0 400 195" role="img" aria-label="Curva de utilidad según precio">' + axisY(x0, y0, h, 0, maxY, 2000, w);
    var pts = [];
    for (var p = 20; p <= 100; p += 2) pts.push(px(p) + ',' + py(profit(p)));
    s += '<polyline fill="none" style="stroke:var(--teal-fg)" stroke-width="2.5" points="' + pts.join(' ') + '"/>';
    for (var q = 20; q <= 100; q += 10) {
      s += '<path d="M' + px(q) + ' ' + (py(profit(q)) - 4) + ' l4 4 l-4 4 l-4 -4z" style="fill:var(--teal-fg)"/>' +
        '<text x="' + px(q) + '" y="' + (y0 + 14) + '" text-anchor="middle" font-size="10" style="fill:var(--muted)">' + q + '</text>';
    }
    var u = profit(price);
    s += '<line x1="' + px(price) + '" x2="' + px(price) + '" y1="' + y0 + '" y2="' + py(u) + '" style="stroke:var(--heading)" stroke-dasharray="3 3"/>' +
      '<circle cx="' + px(price) + '" cy="' + py(u) + '" r="6" style="fill:var(--cta);stroke:var(--heading)" stroke-width="1.5"/>' +
      '<text x="' + Math.min(px(price) + 8, 340) + '" y="' + Math.max(py(u) - 8, 14) + '" font-size="11" font-weight="700" style="fill:var(--heading)">' + price + ' usd · ' + fmt(u) + '</text>';
    return s + '</svg>';
  }

  function renderCharts() {
    var c;
    if ((c = $('[data-chart="orders"]'))) c.innerHTML = chartOrders();
    if ((c = $('[data-chart="channels"]'))) c.innerHTML = chartChannels();
    if ((c = $('[data-chart="bad"]'))) c.innerHTML = chartBars(96, 101, 1, 'var(--red-fg)');
    if ((c = $('[data-chart="good"]'))) c.innerHTML = chartBars(0, 120, 20, 'var(--green-fg)');
  }

  /* ------------------------------------------------------------------ */
  /* Pantallas interactivas                                               */
  /* ------------------------------------------------------------------ */
  function initReveal() {
    $$('[data-reveal]').forEach(function (grid) {
      var box = grid.parentNode.querySelector('[data-detail-box]');
      $$('[data-detail]', grid).forEach(function (card) {
        card.addEventListener('click', function () {
          var parts = card.dataset.detail.split('|');
          box.style.borderLeftColor = getComputedStyle(card).getPropertyValue('--c').trim();
          box.innerHTML = '<b>' + escapeHTML($('h3', card).textContent) + ':</b> ' + escapeHTML(parts[0]) +
            '<br><b>Pregunta clave:</b> ' + escapeHTML(parts[1]);
          box.hidden = false;
        });
      });
    });
  }

  function initChat() {
    var root = $('[data-chat]');
    if (!root) return;
    var ANSWERS = [
      'Las ventas del Norte cayeron 12 % frente al mes anterior.\nLa caída se concentra en el canal web.\nLas demás regiones se mantienen estables.',
      "SELECT region, SUM(valor) AS ventas\nFROM ventas\nWHERE fecha >= '2026-09-01'\nGROUP BY region\nORDER BY ventas DESC;",
      'El MAPE (error porcentual absoluto medio) indica cuánto se equivoca, en promedio, un pronóstico en términos porcentuales.\nUn MAPE de 8 % significa que el pronóstico se desvía, en promedio, un 8 % del valor real.'
    ];
    var CODE = [false, true, false]; // la respuesta 2 es una consulta SQL: se muestra como código
    var log = $('[data-log]', root);
    var checks = $$('[data-checklist-box] li', root).map(function (li) { return li.textContent; });
    var prompts = $$('[data-prompt]', root);
    var busy = false;

    function still() { return document.documentElement.classList.contains('no-motion'); }
    function scrollDown() { log.scrollTop = log.scrollHeight; }

    // Debajo de cada respuesta: lista de verificación para marcar antes de confiar en ella
    function addVerify(bubble) {
      var box = document.createElement('div');
      box.className = 'verify';
      box.innerHTML = '<button class="verify-btn" aria-expanded="false">' + icon('list-checks') + '<span>Verificar esta respuesta</span></button>' +
        '<div class="verify-list" hidden><p>Lista de verificación</p>' +
        checks.map(function (c) { return '<label><input type="checkbox"> ' + escapeHTML(c) + '</label>'; }).join('') + '</div>';
      bubble.insertAdjacentElement('afterend', box);
      var btn = $('.verify-btn', box), list = $('.verify-list', box), boxes = $$('input', box);
      btn.addEventListener('click', function () {
        list.hidden = !list.hidden;
        btn.setAttribute('aria-expanded', String(!list.hidden));
        if (!list.hidden) scrollDown();
      });
      boxes.forEach(function (cb) {
        cb.addEventListener('change', function () {
          var done = boxes.every(function (x) { return x.checked; });
          bubble.classList.toggle('verified', done);
          box.classList.toggle('done', done);
          $('span', btn).textContent = done ? 'Verificada' : 'Verificar esta respuesta';
          if (done) { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
        });
      });
    }

    // Respuesta que se escribe palabra por palabra (de una vez si las animaciones están en pausa)
    function typeAnswer(i, done) {
      var bubble = document.createElement('div');
      bubble.className = 'bubble bot';
      var target = bubble;
      if (CODE[i]) { bubble.classList.add('code'); target = document.createElement('code'); bubble.appendChild(target); }
      var words = ANSWERS[i].split(/(\s+)/), k = 0;
      if (still()) {
        target.textContent = ANSWERS[i];
        log.appendChild(bubble);
        return done(bubble);
      }
      log.appendChild(bubble);
      (function next() {
        target.textContent += words.slice(k, k + 2).join('');
        k += 2;
        scrollDown();
        if (k < words.length) setTimeout(next, 45); else done(bubble);
      })();
    }

    prompts.forEach(function (b) {
      b.addEventListener('click', function () {
        if (busy) return;
        busy = true;
        log.setAttribute('aria-busy', 'true');
        prompts.forEach(function (p) { p.disabled = true; });
        var i = parseInt(b.dataset.prompt, 10);
        var q = document.createElement('div');
        q.className = 'bubble user';
        q.textContent = b.textContent;
        log.appendChild(q);
        var dots = document.createElement('div');
        dots.className = 'bubble bot typing';
        dots.setAttribute('aria-label', 'El asistente está escribiendo');
        dots.innerHTML = '<i></i><i></i><i></i>';
        log.appendChild(dots);
        scrollDown();
        setTimeout(function () {
          dots.remove();
          typeAnswer(i, function (bubble) {
            addVerify(bubble);
            b.classList.add('used');
            if (!$('.used-ico', b)) b.insertAdjacentHTML('beforeend', '<span class="used-ico">' + icon('check') + '</span>');
            prompts.forEach(function (p) { p.disabled = false; });
            log.setAttribute('aria-busy', 'false');
            busy = false;
            scrollDown();
          });
        }, still() ? 0 : 900);
      });
    });
    addVerify($('[data-a]', root));
  }

  function initDashboard() {
    var root = $('[data-dashboard]');
    if (!root) return;
    var TIPS = [
      '<b>1 · ¿Qué cambió?</b> Los pedidos llegaron a 4.820 y superan la meta desde la semana 4.',
      '<b>2 · ¿Respecto a qué?</b> Compara siempre contra una referencia: aquí, la meta (línea gris). Sin referencia, un número no dice si es bueno o malo.',
      '<b>3 · ¿Es relevante o ruido?</b> La app convierte 4,1 % y la web solo 2,4 %: una diferencia grande y sostenida merece análisis.'
    ];
    var seen = {};
    var box = $('[data-detail-box]', root);
    $$('[data-hot]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = b.dataset.hot;
        seen[i] = true;
        b.classList.add('done');
        var html = TIPS[i];
        if (Object.keys(seen).length === 3) {
          html += '<br><br><b>¿Qué decisión implica?</b> Los pedidos están sobre la meta, pero la cancelación es del 14 %: el problema no es vender, sino retener.';
        }
        box.innerHTML = html;
        box.hidden = false;
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Actividad 7: ficha de análisis de caso                               */
  /* ------------------------------------------------------------------ */
  // La ficha vale 80 puntos (6 campos calificados) y el caso nuevo, 20 (2 preguntas de 10).
  var FICHA_FIELDS = [
    { label: 'Problema de negocio', icon: 'target', q: '¿Cuál era el problema de negocio?' },
    { label: 'Datos usados', icon: 'database', q: '¿Qué datos usó la empresa? Marca todos los que correspondan.', multi: true },
    { label: 'Tipo de analítica', icon: 'chart-line', q: '¿Qué tipo de analítica aplicó?' },
    { label: 'Decisión tomada', icon: 'mouse-pointer-click', q: '¿Qué decisión tomó la empresa?' },
    { label: 'Resultado y evidencia', icon: 'trending-up', q: '¿Qué resultado obtuvo y con qué evidencia?' },
    { label: 'Riesgos y ética', icon: 'shield', q: '¿Qué riesgos debe vigilar? Marca todos los que correspondan.', multi: true }
  ];
  // Paso final: aplicar lo aprendido a un negocio nuevo y parecido (2 preguntas calificadas)
  var TRANSFER_FIELDS = [
    { label: 'Caso nuevo · Datos', icon: 'database', q: '¿Qué datos usarías? Marca todos los que correspondan.', multi: true },
    { label: 'Caso nuevo · Analítica y decisión', icon: 'route', q: '¿Qué tipo de analítica aplicarías y qué decisión tomarías?' }
  ];
  var STEPS = FICHA_FIELDS.concat(TRANSFER_FIELDS);
  var FICHA_POINTS = 80, TRANSFER_POINTS = 20;
  // Respuestas tomadas de las pantallas de cada caso (Módulo 7); a = índices de las opciones correctas.
  var CASES = [
    { id: 'netflix', name: 'Netflix', sub: 'Personalización', icon: 'tv', color: 'red', screen: 'case-netflix', fields: [
      { o: ['El catálogo tenía muy pocos títulos para elegir.',
            'Con miles de títulos, el usuario abandona si no encuentra rápido qué ver, y eso termina en cancelaciones.',
            'Los servidores no soportaban el volumen de reproducciones.'], a: [1],
        e: 'El reto era retener: si no encuentras qué ver, abandonas y terminas cancelando la suscripción.' },
      { o: ['Historial de reproducciones', 'Tráfico y mapas de la ciudad', 'Búsquedas dentro de la plataforma',
            'Valoraciones de los títulos', 'Ventas de tiendas físicas', 'Comportamiento en pantalla (qué ves y cuándo abandonas)'], a: [0, 2, 3, 5],
        e: 'Netflix analiza lo que ves, lo que buscas, cómo valoras y cuándo abandonas. Tráfico y ventas en tienda no tienen relación con el caso.' },
      { o: ['Descriptiva: un reporte mensual con los títulos más vistos.',
            'Prescriptiva: un modelo de optimización de rutas de entrega.',
            'Predictiva: modelos de aprendizaje automático que estiman qué títulos te van a interesar.'], a: [2],
        e: 'El sistema de recomendación aprende de tu historial para estimar qué te gustará ver: es analítica predictiva con aprendizaje automático.' },
      { o: ['Personalizar la página de inicio de cada usuario.',
            'Mostrar el mismo catálogo destacado a todos los usuarios.',
            'Bajar el precio de la suscripción para todos.'], a: [0],
        e: 'Netflix no muestra el mismo catálogo a todos: cada usuario ve una página de inicio armada para él.' },
      { o: ['No hay evidencia: es una suposición de la empresa.',
            'Netflix duplicó sus suscriptores en un mes.',
            'Las recomendaciones influyen en cerca del 80 % de las horas reproducidas, y se estima que ahorran más de US$ 1.000 millones al año por menor cancelación.'], a: [2],
        e: 'Gomez-Uribe y Hunt (2015) reportan que las recomendaciones influyen en cerca del 80 % de lo que se reproduce y estiman un ahorro de más de US$ 1.000 millones al año.' },
      { o: ['La IA reemplaza a todos los empleados de Netflix.',
            'Usar datos personales más allá de lo que el usuario espera (privacidad).',
            'Recomendar sin que el usuario pueda saber por qué (falta de explicabilidad).',
            'El sistema deja de funcionar con más de mil títulos.'], a: [1, 2],
        e: 'Los riesgos están en el uso de los datos personales y en la transparencia: el usuario debería saber qué datos se usan y por qué ve cada recomendación.' }
    ], transfer: { name: 'Librería en línea', icon: 'book-open',
      text: 'Una librería en línea tiene 40.000 títulos. Muchos visitantes entran, no encuentran qué leer y se van sin comprar.',
      qs: [
        { o: ['Historial de compras de cada cliente', 'Precio del dólar del día', 'Búsquedas dentro de la tienda',
              'Reseñas y calificaciones de los libros', 'Número de empleados de la bodega'], a: [0, 2, 3],
          e: 'Igual que en Netflix: lo que cada cliente compra, busca y califica muestra sus gustos. El dólar y la bodega no dicen qué quiere leer.' },
        { o: ['Descriptiva: un informe mensual con los 10 libros más vendidos, igual para todos los visitantes.',
              'Predictiva: un sistema de recomendación que estime qué libros le interesan a cada visitante y personalice su página de inicio.',
              'Prescriptiva: optimizar las rutas de los repartidores de libros.'], a: [1],
          e: 'Es el mismo problema de Netflix: demasiadas opciones y clientes que se van. Recomendar según el historial ataca la causa; la ruta del reparto no la toca.' }
      ] } },
    { id: 'ups', name: 'UPS', sub: 'Optimización de rutas (ORION)', icon: 'truck', color: 'orange', screen: 'case-ups', fields: [
      { o: ['UPS no sabía cuántos clientes tenía.',
            'Los clientes se quejaban del precio de los envíos.',
            'Cada conductor entrega a más de 160 clientes al día y el orden de las paradas cambia mucho las millas y el combustible.'], a: [2],
        e: 'Con más de 160 paradas por conductor al día, el orden de la ruta define cuántas millas y cuánto combustible se gastan.' },
      { o: ['Direcciones de entrega', 'Publicaciones de los conductores en redes sociales', 'Ventanas de entrega',
            'Tráfico', 'Encuestas de clima laboral', 'Mapas'], a: [0, 2, 3, 5],
        e: 'ORION combina direcciones, ventanas de entrega, tráfico y mapas. Las redes sociales y el clima laboral no intervienen en la ruta.' },
      { o: ['Prescriptiva: optimización (ORION) que recomienda la mejor secuencia de paradas.',
            'Descriptiva: un tablero con las entregas del mes anterior.',
            'Predictiva: un modelo que solo pronostica cuántos paquetes habrá mañana.'], a: [0],
        e: 'ORION no solo predice: recomienda el mejor orden de las paradas. Es analítica prescriptiva.' },
      { o: ['Contratar más conductores para cubrir las rutas.',
            'Cada mañana, el sistema entrega a cada conductor una secuencia optimizada de paradas.',
            'Dejar que cada conductor improvise su ruta sin datos.'], a: [1],
        e: 'La decisión se toma todos los días: cada conductor recibe en la mañana su secuencia optimizada.' },
      { o: ['Ahorros de más de US$ 320 millones hasta 2015 y una estimación de 300 a 400 millones al año, con 100 millones de millas y 10 millones de galones de combustible menos.',
            'Las entregas pasaron a hacerse con drones.',
            'Los costos subieron, pero mejoró la imagen de la marca.'], a: [0],
        e: 'UPS reportó más de US$ 320 millones ahorrados hasta 2015 y estimó 300 a 400 millones al año con el despliegue completo; ORION ganó el Premio Franz Edelman 2016.' },
      { o: ['Que el sistema decida los salarios de los conductores.',
            'Seguir la ruta del sistema aunque el conductor sepa algo que el modelo no sabe (una calle cerrada, un cliente ausente).',
            'Datos de tráfico o direcciones desactualizados que llevan a malas rutas.',
            'Que ORION viole derechos de autor de los mapas.'], a: [1, 2],
        e: 'El modelo es tan bueno como sus datos, y el conductor conoce cosas que el sistema no ve: hace falta calidad de datos y criterio humano.' }
    ], transfer: { name: 'Empresa de domicilios', icon: 'bike',
      text: 'Una empresa de domicilios tiene 25 repartidores en moto; cada uno hace unas 40 entregas al día y decide por su cuenta el orden. El gasto de gasolina y los retrasos van en aumento.',
      qs: [
        { o: ['Direcciones de los pedidos', 'Seguidores de la empresa en redes sociales', 'Horarios en que cada cliente puede recibir',
              'Tráfico en tiempo real', 'Edad de los clientes'], a: [0, 2, 3],
          e: 'Igual que ORION: direcciones, ventanas de entrega y tráfico definen la mejor ruta. Los seguidores y la edad de los clientes no cambian el orden de las paradas.' },
        { o: ['Descriptiva: un tablero con las entregas atrasadas de la semana pasada.',
              'Contratar más repartidores sin cambiar cómo se ordenan las rutas.',
              'Prescriptiva: un optimizador que proponga cada mañana el mejor orden de entregas, y que el repartidor pueda ajustarlo si encuentra una vía cerrada.'], a: [2],
          e: 'El problema es el orden de las paradas, como en UPS: recomendar la mejor secuencia es analítica prescriptiva, y el criterio del repartidor sigue contando. El tablero solo muestra el pasado.' }
      ] } },
    { id: 'walmart', name: 'Walmart', sub: 'Pronosticar con datos históricos', icon: 'store', color: 'blue', screen: 'case-walmart', fields: [
      { o: ['Walmart quería abrir tiendas nuevas en Florida.',
            'Antes de un huracán, las tiendas deben tener el inventario de lo que la gente realmente va a comprar.',
            'Los clientes no encontraban las cajas de pago.'], a: [1],
        e: 'El reto era abastecer bien las tiendas antes de la tormenta, con los productos que de verdad se iban a vender.' },
      { o: ['Ventas históricas durante el huracán Charley', 'Encuestas sobre los sabores favoritos de los clientes',
            'Ventas por producto en cada tienda', 'Historial de navegación en redes sociales', 'Trayectoria prevista del huracán Frances'], a: [0, 2, 4],
        e: 'Walmart revisó qué se vendió, producto por producto, durante el huracán anterior y lo cruzó con la ruta de Frances para decidir a qué tiendas enviar.' },
      { o: ['Descriptiva: un informe de ventas que no se usa para anticipar nada.',
            'Predictiva: patrones de compra de un huracán anterior para anticipar la demanda del siguiente.',
            'Prescriptiva: un optimizador de precios en tiempo real.'], a: [1],
        e: 'Usó el pasado para pronosticar la demanda: es analítica predictiva basada en patrones históricos.' },
      { o: ['Cerrar las tiendas hasta que pasara el huracán.',
            'Subir los precios de los productos más buscados.',
            'Enviar los productos con más demanda a las tiendas en la trayectoria de Frances.'], a: [2],
        e: 'Con el pronóstico en la mano, abasteció las tiendas que estaban en la ruta de la tormenta.' },
      { o: ['Las Pop-Tarts de fresa se vendían cerca de siete veces su ritmo normal antes de un huracán, y la mayoría de los productos enviados se vendió rápido.',
            'Las ventas se mantuvieron iguales que cualquier otra semana.',
            'Walmart redujo sus tiendas a la mitad.'], a: [0],
        e: 'Según The New York Times (Hays, 2004), las Pop-Tarts de fresa se vendían unas siete veces más y la mayoría de lo enviado se vendió rápido.' },
      { o: ['Suponer que el patrón del pasado se repetirá igual (otra ruta, otra temporada, otros clientes).',
            'Que usar datos de ventas sea ilegal.',
            'Confundir correlación con causalidad.',
            'Creer que el pronóstico garantiza las ventas futuras.'], a: [0, 2, 3],
        e: 'El pasado informa, pero no garantiza el futuro: un patrón puede cambiar y una coincidencia no siempre es una causa.' }
    ], transfer: { name: 'Cadena de droguerías', icon: 'pill',
      text: 'Cada temporada de lluvias, una cadena de droguerías se queda sin antigripales, suero oral e impermeables en algunas tiendas, mientras otras tienen la bodega llena.',
      qs: [
        { o: ['Ventas por producto y por tienda en las temporadas de lluvia anteriores', 'Precio de las acciones de la empresa en la bolsa',
              'Pronóstico del clima por región', 'Inventario actual de cada tienda', 'Cantidad de seguidores en redes sociales'], a: [0, 2, 3],
          e: 'Igual que Walmart con los huracanes: las ventas de temporadas anteriores, el pronóstico del clima y el inventario de cada tienda dicen qué enviar y a dónde.' },
        { o: ['Predictiva: pronosticar la demanda de cada tienda con las lluvias anteriores y el pronóstico del clima, y enviar el inventario antes de que empiecen.',
              'Subir los precios de los antigripales cuando empiecen las lluvias.',
              'Descriptiva: esperar al final de la temporada y revisar qué se agotó.'], a: [0],
          e: 'Como Walmart: el pasado y el pronóstico permiten anticipar la demanda. Aun así, cada temporada es distinta: hay que comparar el pronóstico con las ventas reales.' }
      ] } }
  ];

  function initCaseLab() {
    var root = $('[data-act="a7"]');
    if (!root) return;
    var LETTERS = 'ABCDEF';
    var NF = FICHA_FIELDS.length;
    var lab = state.k;
    var support = $('[data-support]');
    var idx = 0, tries = 0, phase = 'ask', picked = [];

    function attempts() { return state.t.a7 || 0; }
    function sameSet(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) !== -1; }); }
    function firstPending() {
      for (var i = 0; i < STEPS.length; i++) if (lab.r[i] == null) return i;
      return -1;
    }
    // Datos de un paso: los 6 campos de la ficha y luego las 2 preguntas del caso nuevo
    function stepData(i) { var c = CASES[lab.c]; return i < NF ? c.fields[i] : c.transfer.qs[i - NF]; }
    function dots(cur) {
      var html = '<div class="qdots">';
      STEPS.forEach(function (f, i) {
        var r = lab.r[i];
        html += '<i class="' + (r == null ? (i === cur ? 'cur' : '') : (r ? 'r' : 'w')) + (i === NF ? ' gap' : '') + '"></i>';
      });
      return html + '</div>';
    }
    function side(spotIcon, title, sub) {
      var c = CASES[lab.c];
      return '<aside class="quiz-side">' + spot(spotIcon) + '<p class="quiz-count"><b>' + title + '</b>' + sub + '</p>' +
        (lab.c >= 0 && phase !== 'pick' ? '<p class="lab-tag c-' + c.color + '">' + icon(c.icon) + 'Caso ' + c.name + '</p>' : '') +
        (lab.c >= 0 ? dots(idx) : '') +
        '<p class="quiz-note">' + icon('info') + 'La ficha vale ' + FICHA_POINTS + ' puntos y el caso nuevo, ' + TRANSFER_POINTS + '. Tienes 2 intentos por pregunta.</p></aside>';
    }
    function score() {
      var ok = lab.r.slice(0, NF).filter(function (r) { return r; }).length;
      var okT = lab.r.slice(NF).filter(function (r) { return r; }).length;
      return { ok: ok, okT: okT, total: Math.round(ok / NF * FICHA_POINTS + okT / TRANSFER_FIELDS.length * TRANSFER_POINTS) };
    }

    function renderPick() {
      phase = 'pick';
      root.dataset.step = phase;
      support.hidden = true;
      var left = MAX_ATTEMPTS - attempts();
      var html = side('clipboard-list', 'Elige un caso', attempts() ? 'Te quedan ' + left + ' de ' + MAX_ATTEMPTS + ' intentos' : MAX_ATTEMPTS + ' intentos') +
        '<div class="quiz-main"><div class="qbox"><span class="qnum">' + icon('briefcase') + '</span><span>¿Qué caso vas a analizar como gerente?</span></div>' +
        '<div class="grid g3 lab-cases">';
      shuffleIndexes(CASES.length).forEach(function (i) {
        var c = CASES[i];
        html += '<button class="card c-' + c.color + '" data-case="' + i + '"><span class="ico">' + icon(c.icon) + icon(c.icon, 'wm') + '</span>' +
          '<div class="card-body"><h3>' + c.name + '</h3><p class="ex">' + c.sub + '</p></div></button>';
      });
      html += '</div>' + (state.s.a7 ? '<p class="small">Tu mejor puntaje hasta ahora: ' + state.s.a7 + ' / 100. Se guarda el mejor de tus intentos.</p>' : '') + '</div>';
      root.innerHTML = html;
      $$('[data-case]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          lab.c = parseInt(b.dataset.case, 10);
          lab.r = []; lab.d = false;
          saveState(true);
          renderField(0);
        });
      });
    }

    function renderField(i) {
      idx = i; tries = 0; phase = 'ask'; picked = [];
      root.dataset.step = i < NF ? phase : 'transfer';
      support.hidden = true;
      var f = STEPS[i], data = stepData(i), t = CASES[lab.c].transfer;
      var html = (i < NF ? side(f.icon, 'Campo ' + (i + 1) + ' de ' + NF, f.label)
                         : side(t.icon, 'Caso nuevo · ' + (i - NF + 1) + ' de ' + TRANSFER_FIELDS.length, 'Aplícalo a otro negocio')) +
        '<div class="quiz-main">' +
        (i < NF ? '' : '<div class="lab-scenario"><span class="field-ico">' + icon(t.icon) + '</span><div><b>' + escapeHTML(t.name) + '</b><p>' + escapeHTML(t.text) + '</p></div></div>') +
        '<div class="qbox"><span class="qnum">' + (i < NF ? i + 1 : i - NF + 1) + '</span><span>' + escapeHTML(f.q) + '</span></div>' +
        '<div class="options' + (f.multi ? ' multi' : '') + '">';
      // Opciones en orden aleatorio: data-o conserva el índice original (para calificar y SCORM)
      shuffleIndexes(data.o.length).forEach(function (k, p) {
        html += '<button class="opt" data-o="' + k + '" aria-pressed="false"><span class="opt-key">' + LETTERS[p] + '</span><span>' + escapeHTML(data.o[k]) + '</span></button>';
      });
      html += '</div><div class="qfoot"><div class="feedback info" data-fb>' + (f.multi ? 'Puede haber varias respuestas correctas.' : 'Elige una opción y comprueba tu respuesta.') + '</div>' +
        '<button class="btn" data-act-btn disabled>Comprobar' + icon('arrow-right') + '</button></div></div>';
      root.innerHTML = html;
      $$('.opt', root).forEach(function (b) {
        b.addEventListener('click', function () {
          if (phase !== 'ask') return;
          var k = parseInt(b.dataset.o, 10);
          if (!f.multi) {
            $$('.opt', root).forEach(function (x) { x.classList.remove('chosen'); x.setAttribute('aria-pressed', 'false'); });
            picked = [];
          }
          var at = picked.indexOf(k);
          if (at === -1) picked.push(k); else picked.splice(at, 1);
          b.classList.toggle('chosen', picked.indexOf(k) !== -1);
          b.setAttribute('aria-pressed', String(picked.indexOf(k) !== -1));
          $('[data-act-btn]', root).disabled = !picked.length;
        });
      });
      $('[data-act-btn]', root).addEventListener('click', onCheck);
    }

    function onCheck() {
      var btn = $('[data-act-btn]', root), fb = $('[data-fb]', root);
      if (phase === 'next') {
        var nxt = firstPending();
        if (nxt === -1) finish(); else renderField(nxt);
        return;
      }
      if (!picked.length) return;
      var f = STEPS[idx], data = stepData(idx);
      var ok = sameSet(picked, data.a);
      tries++;
      if (!ok && tries < 2) {
        if (f.multi) {
          var hits = picked.filter(function (k) { return data.a.indexOf(k) !== -1; }).length;
          fb.textContent = 'Aún no: marcaste ' + hits + ' de ' + data.a.length + ' correctas' +
            (picked.length > hits ? ' y ' + (picked.length - hits) + ' que no corresponde(n)' : '') + '. Ajusta tu selección; te queda 1 intento.';
        } else {
          var wrong = $('.opt[data-o="' + picked[0] + '"]', root);
          wrong.classList.remove('chosen');
          wrong.classList.add('wrong');
          wrong.disabled = true;
          picked = [];
          btn.disabled = true;
          fb.textContent = idx < NF ? 'Aún no. Vuelve a pensar en lo que viste en el caso; te queda 1 intento.'
                                    : 'Aún no. Piensa qué hizo ' + CASES[lab.c].name + ' en una situación parecida; te queda 1 intento.';
        }
        fb.className = 'feedback bad';
        return;
      }
      $$('.opt', root).forEach(function (b) {
        var k = parseInt(b.dataset.o, 10);
        b.classList.remove('chosen');
        if (data.a.indexOf(k) !== -1) b.classList.add('right');
        else if (picked.indexOf(k) !== -1) b.classList.add('wrong');
        b.disabled = true;
      });
      lab.r[idx] = ok ? 1 : 0;
      saveState(true);
      SCORM.interaction('a7_' + CASES[lab.c].id + (idx < NF ? '_campo' + (idx + 1) : '_nuevo' + (idx - NF + 1)), 'choice',
        picked.slice().sort().map(function (k) { return LETTERS[k]; }).join(','), ok ? 'correct' : 'wrong');
      fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
      fb.textContent = (ok ? 'Correcto. ' : 'Aún no. ') + data.e;
      phase = 'next';
      btn.disabled = false;
      var nxt = firstPending();
      btn.innerHTML = (nxt === -1 ? 'Ver mi resultado' : nxt === NF ? 'Aplícalo a otro negocio' : idx < NF ? 'Siguiente campo' : 'Siguiente pregunta') + icon('arrow-right');
      var d = $('.qdots', root);
      if (d) d.outerHTML = dots(idx);
    }

    function finish() {
      var sc = score();
      lab.d = true;
      state.t.a7 = attempts() + 1;
      SCORM.interaction('a7_intento' + state.t.a7, 'performance',
        CASES[lab.c].id + ' ficha ' + sc.ok + '/' + NF + ' nuevo ' + sc.okT + '/' + TRANSFER_FIELDS.length, sc.total >= 60 ? 'correct' : 'wrong');
      setScore('a7', sc.total);
      renderSummary();
    }

    function renderSummary() {
      phase = 'done'; idx = -1;
      root.dataset.step = phase;
      support.hidden = false; // otros casos de referencia: solo en la retroalimentación final
      var c = CASES[lab.c], sc = score();
      var left = MAX_ATTEMPTS - attempts();
      var row = function (ico, label, data, ok) {
        return '<div class="lab-row"><span class="field-ico">' + icon(ico) + '</span><div><b>' + label + '</b><p>' +
          escapeHTML(data.a.map(function (k) { return data.o[k]; }).join(' · ')) + '</p></div>' +
          '<span class="lab-status ' + (ok ? 'ok' : 'no') + '">' + icon(ok ? 'check' : 'x') + (ok ? 'Acertaste' : 'Revisa') + '</span></div>';
      };
      var html = side('award', 'Resultado', sc.total + ' / 100') +
        '<div class="quiz-main"><div class="qbox score-box">Ficha: ' + sc.ok + ' de ' + NF + ' campos · Caso nuevo: ' + sc.okT + ' de ' + TRANSFER_FIELDS.length +
        ' · Puntos: ' + sc.total + ' / 100 ' + stars(sc.total) + '</div>' +
        '<p class="label">Tu ficha frente a la ficha experta · Caso ' + c.name + '</p><div class="lab-summary">';
      FICHA_FIELDS.forEach(function (f, i) { html += row(f.icon, f.label, c.fields[i], lab.r[i] === 1); });
      html += '</div><p class="label">Caso nuevo · ' + escapeHTML(c.transfer.name) + '</p><div class="lab-summary">';
      TRANSFER_FIELDS.forEach(function (f, i) { html += row(f.icon, f.label.replace('Caso nuevo · ', ''), c.transfer.qs[i], lab.r[NF + i] === 1); });
      html += '</div>' +
        '<div class="row-end"><button class="btn ghost" data-goto="' + c.screen + '">' + icon('book-open') + 'Repasar el caso</button>' +
        (left > 0 ? '<button class="btn ghost" data-another>' + icon('rotate-ccw') + 'Analizar otro caso (' + left + ')</button>' : '') +
        '<button class="btn" data-next>Continuar' + icon('arrow-right') + '</button></div>' +
        (state.s.a7 > sc.total ? '<p class="small">Se conserva tu mejor puntaje: ' + state.s.a7 + ' / 100.</p>' : '') + '</div>';
      root.innerHTML = html;
      var another = $('[data-another]', root);
      if (another) another.addEventListener('click', function () {
        lab.c = -1; lab.r = []; lab.d = false;
        saveState(true);
        renderPick();
      });
    }

    // Retoma donde quedó: ficha terminada, campo o pregunta pendiente, o elección del caso
    delete lab.x; // la versión anterior guardaba aquí una reflexión escrita
    if (lab.c >= 0 && CASES[lab.c]) {
      if (lab.d) renderSummary();
      else if (firstPending() !== -1) renderField(firstPending());
      else finish();
    } else {
      renderPick();
    }
  }

  function initSim1() {
    var root = $('[data-sim1]');
    if (!root) return;
    var range = $('#price');
    var chart = $('[data-chart="profit"]', root);
    var fb = $('[data-fb]', root);
    function update() {
      var p = parseInt(range.value, 10);
      var d = 1000 - 10 * p;
      $('[data-price]', root).textContent = p + ' usd';
      $('[data-k="d"]', root).textContent = fmt(d) + ' unds.';
      $('[data-k="i"]', root).textContent = fmt(p * d);
      $('[data-k="u"]', root).textContent = fmt(profit(p));
      chart.innerHTML = chartProfit(p);
    }
    range.addEventListener('input', update);
    update();
    var confirmBtn = $('[data-confirm]', root);
    function attempts() { return state.t.sim1 || 0; }
    function lock() { // sin intentos: el control sigue sirviendo para explorar, pero ya no se confirma
      confirmBtn.disabled = true;
      fb.className = 'feedback info';
      fb.textContent = 'Ya usaste tus ' + MAX_ATTEMPTS + ' intentos. Tu mejor puntaje quedó registrado: ' + (state.s.sim1 || 0) + ' / 100.';
    }
    if (attempts() >= MAX_ATTEMPTS) lock();
    confirmBtn.addEventListener('click', function () {
      if (attempts() >= MAX_ATTEMPTS) return lock();
      var p = parseInt(range.value, 10);
      var u = profit(p);
      var score = Math.max(0, u) / 16000 * 100;
      state.t.sim1 = attempts() + 1;
      setScore('sim1', score);
      SCORM.interaction('sim1_intento' + state.t.sim1, 'numeric', p, p === 60 ? 'correct' : 'wrong');
      var supuestos = ' Supuestos del modelo: la demanda es lineal, el costo unitario es constante y la competencia no reacciona.';
      var left = MAX_ATTEMPTS - state.t.sim1;
      if (p === 60) {
        fb.className = 'feedback ok';
        fb.textContent = '¡Precio óptimo! Con 60 usd la demanda es 400 y la utilidad máxima, 16.000.' + supuestos;
        confirmBtn.disabled = true;
      } else {
        fb.className = 'feedback bad';
        fb.textContent = 'Tu utilidad: ' + fmt(u) + ' (' + Math.round(score) + ' % del máximo). El óptimo es P* = (100 + 20) / 2 = 60 usd, con utilidad de 16.000.' + supuestos +
          (left > 0 ? ' Te quedan ' + left + ' intento(s); se guarda tu mejor puntaje.' : ' Ya usaste tus ' + MAX_ATTEMPTS + ' intentos; se guarda tu mejor puntaje: ' + (state.s.sim1 || 0) + ' / 100.');
        if (left <= 0) confirmBtn.disabled = true;
      }
    });
  }

  function initSim2() {
    var root = $('[data-sim2]');
    if (!root) return;
    var fb = $('[data-fb]', root);
    var step2 = $('[data-step="2"]', root);
    var retry = $('[data-retry]', root);
    var FEED = {
      A: ['bad', 20, 'Bajar precios no corrige la causa y reduce el margen. Antes de actuar, pregunta y verifica los datos.'],
      C: ['bad', 40, 'Gastaste mucho con inventario insuficiente: el problema era el stock, no la demanda.'],
      B1: ['ok', 100, 'Excelente: preguntaste antes de actuar y validaste los datos. Siguiente paso: reabastecer y usar el modelo prescriptivo para reasignar presupuesto. En entornos inciertos, la analítica ayuda a decidir de forma más racional (Cao & Duan, 2024).'],
      B2: ['bad', 60, 'Validar los datos estuvo bien, pero esperar al cierre de mes te hizo perder ventas. Con evidencia suficiente, decide.']
    };
    function reveal(btn) {
      var row = btn.closest('.route-row');
      $$('.masked', row).forEach(function (m) { m.classList.remove('masked'); });
      row.classList.add('revealed'); // el color de la ruta solo aparece al elegirla
      btn.classList.add('picked');
      $$('button', btn.closest('.routes')).forEach(function (b) { b.disabled = true; });
    }
    function finish(key) {
      var f = FEED[key];
      state.t.sim2 = (state.t.sim2 || 0) + 1;
      setScore('sim2', f[1]);
      SCORM.interaction('sim2_ruta', 'choice', key, f[1] === 100 ? 'correct' : 'wrong');
      fb.className = 'feedback ' + f[0];
      fb.textContent = 'Puntaje: ' + f[1] + ' / 100. ' + f[2] + ' Lección: los datos de buena calidad y la experiencia no compiten, se combinan según el tipo de decisión (Yu et al., 2022).';
      retry.hidden = f[1] === 100 || state.t.sim2 >= MAX_ATTEMPTS;
    }
    $$('[data-route]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = btn.dataset.route;
        reveal(btn);
        if (r === 'B') {
          step2.hidden = false;
          fb.className = 'feedback ok';
          fb.textContent = 'Buena decisión: descubriste quiebres de inventario en el canal web y pedidos duplicados (90 pts). Ahora, ¿qué haces?';
        } else {
          finish(r);
        }
      });
    });
    // Al volver al curso sin intentos: las rutas quedan bloqueadas y se muestra el mejor puntaje
    if ((state.t.sim2 || 0) >= MAX_ATTEMPTS) {
      $$('[data-route]', root).forEach(function (b) { b.disabled = true; });
      fb.className = 'feedback info';
      fb.textContent = 'Ya usaste tus ' + MAX_ATTEMPTS + ' intentos. Tu mejor puntaje quedó registrado: ' + (state.s.sim2 || 0) + ' / 100.';
    }
    retry.addEventListener('click', function () {
      $$('.route-row', root).forEach(function (row) {
        $$('.conseq, .pts', row).forEach(function (m) { m.classList.add('masked'); });
        var b = $('button', row);
        b.disabled = false;
        b.classList.remove('picked');
        row.classList.remove('revealed');
      });
      step2.hidden = true;
      retry.hidden = true;
      fb.className = 'feedback info';
      fb.textContent = 'Cada decisión te mostrará sus consecuencias.';
    });
  }

  function initPlan() {
    var boxes = $$('[data-plan] input[type=checkbox]');
    boxes.forEach(function (b, i) {
      b.checked = state.p.charAt(i) === '1';
      b.addEventListener('change', function () {
        state.p = boxes.map(function (x) { return x.checked ? '1' : '0'; }).join('');
        saveState();
      });
    });
  }

  function renderResults() {
    var box = $('[data-results]');
    if (!box) return;
    var g = grade();
    var status = g.done ? (g.total >= PASS_SCORE ? '<span class="badge-pass ok">Aprobado</span>' : '<span class="badge-pass no">No aprobado</span>')
      : '<span class="badge-pass no">Evaluación final pendiente</span>';
    box.innerHTML = '<h3>Tus resultados</h3><table>' +
      '<tr><td>Actividades de módulo (40 %)</td><td>' + g.act + '</td></tr>' +
      '<tr><td>Simuladores (35 %)</td><td>' + g.sim + '</td></tr>' +
      '<tr><td>Evaluación final (25 %)</td><td>' + g.fin + '</td></tr>' +
      '<tr class="total"><td><b>Nota del recorrido</b></td><td>' + g.total + ' / 100</td></tr></table>' +
      '<p style="margin:8px 0 0">' + status + ' <span class="small">Se aprueba con ' + PASS_SCORE + ' o más.</span></p>';
  }

  /* ------------------------------------------------------------------ */
  /* Fondo animado: red de datos con pulsos que viajan entre nodos        */
  /* ------------------------------------------------------------------ */
  var root = document.documentElement;

  var background = (function () {
    var canvas = $('#bgNet');
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return { refresh: function () {}, update: function () {} };

    var COLORS = ['#14B8A6', '#3B82F6', '#F59E0B', '#8B5CF6'];
    var LINK = 130, REACH = 150;
    var nodes = [], pulses = [], W = 0, H = 0, raf = 0, last = 0, frames = 0;
    var running = false, pointer = null;
    var lineColor = 'rgb(11,37,69)', lineAlpha = 0.16, nodeAlpha = 0.55, accent = COLORS[0];

    function readTheme() {
      var cs = getComputedStyle(root);
      lineColor = 'rgb(' + cs.getPropertyValue('--net-line').trim() + ')';
      lineAlpha = parseFloat(cs.getPropertyValue('--net-alpha')) || lineAlpha;
      nodeAlpha = parseFloat(cs.getPropertyValue('--node-alpha')) || nodeAlpha;
      accent = getComputedStyle($('#app')).getPropertyValue('--accent').trim() || accent;
    }

    function makeNode() {
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: 1.4 + Math.random() * 2.2, c: COLORS[Math.random() * COLORS.length | 0], ph: Math.random() * 6.28
      };
    }

    function resize() {
      var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var target = Math.max(18, Math.min(70, Math.round(W * H / 15000)));
      while (nodes.length < target) nodes.push(makeNode());
      nodes.length = target;
      draw(0);
    }

    function line(a, b, color, alpha) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a = nodes[i], b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
          if (d >= LINK * LINK) continue;
          line(a, b, lineColor, lineAlpha * (1 - Math.sqrt(d) / LINK));
          if (running && pulses.length < 6 && Math.random() < 0.0005) pulses.push({ a: a, b: b, t: 0 });
        }
      }
      // Constelación alrededor del puntero, con el color del módulo
      if (pointer) {
        nodes.forEach(function (n) {
          var d = Math.hypot(n.x - pointer.x, n.y - pointer.y);
          if (d < REACH) line(n, pointer, accent, 0.35 * (1 - d / REACH));
        });
      }
      nodes.forEach(function (n) {
        ctx.globalAlpha = nodeAlpha * (0.7 + 0.3 * Math.sin(t / 900 + n.ph));
        ctx.fillStyle = n.c;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.283); ctx.fill();
      });
      // Pulsos de datos que recorren los enlaces
      pulses.forEach(function (p) {
        var x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        var g = ctx.createRadialGradient(x, y, 0, x, y, 8);
        g.addColorStop(0, p.a.c);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = Math.min(1, nodeAlpha + 0.3) * Math.sin(p.t * Math.PI);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.283); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    function step(dt) {
      nodes.forEach(function (n) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < -10) n.x = W + 10; else if (n.x > W + 10) n.x = -10;
        if (n.y < -10) n.y = H + 10; else if (n.y > H + 10) n.y = -10;
        if (pointer) { // los nodos se apartan suavemente del puntero
          var dx = n.x - pointer.x, dy = n.y - pointer.y, d = Math.hypot(dx, dy);
          if (d > 1 && d < 110) { var f = (1 - d / 110) * 0.8 * dt; n.x += dx / d * f; n.y += dy / d * f; }
        }
      });
      pulses = pulses.filter(function (p) {
        p.t += 0.012 * dt;
        return p.t < 1 && Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) < LINK;
      });
    }

    function frame(t) {
      var dt = last ? Math.min(t - last, 50) / 16.7 : 1;
      last = t;
      if (++frames % 30 === 0) accent = getComputedStyle($('#app')).getPropertyValue('--accent').trim() || accent;
      step(dt);
      draw(t);
      raf = requestAnimationFrame(frame);
    }

    // Se detiene si las animaciones están desactivadas o la pestaña no está visible
    function update() {
      var should = !root.classList.contains('no-motion') && !document.hidden;
      if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
      if (!should && running) { running = false; cancelAnimationFrame(raf); pulses = []; draw(0); }
    }

    readTheme();
    resize();
    update();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', update);
    $('#app').addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    $('#app').addEventListener('pointerleave', function () { pointer = null; if (!running) draw(0); });

    return { refresh: function () { readTheme(); if (!running) draw(0); }, update: update };
  })();

  /* ------------------------------------------------------------------ */
  /* Accesibilidad: modo oscuro/claro y pausa de animaciones              */
  /* ------------------------------------------------------------------ */
  var ICONS = { moon: icon('moon'), sun: icon('sun'), pause: icon('pause'), play: icon('play') };
  var themeTimer = null;

  function savePref(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* almacenamiento bloqueado: solo dura esta sesión */ }
  }

  function renderPrefs() {
    var dark = root.getAttribute('data-theme') === 'dark';
    var still = root.classList.contains('no-motion');
    var tb = $('#themeBtn'), mb = $('#motionBtn');
    tb.innerHTML = dark ? ICONS.sun : ICONS.moon;
    tb.setAttribute('aria-label', 'Modo oscuro');
    tb.setAttribute('aria-pressed', String(dark));
    tb.title = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    mb.innerHTML = still ? ICONS.play : ICONS.pause;
    mb.setAttribute('aria-label', 'Pausar animaciones');
    mb.setAttribute('aria-pressed', String(still));
    mb.title = still ? 'Reanudar animaciones' : 'Pausar animaciones';
  }

  function setTheme(theme, remember) {
    root.classList.add('theme-anim');
    root.setAttribute('data-theme', theme);
    if (remember) savePref('odc-ddm-tema', theme);
    renderPrefs();
    background.refresh();
    clearTimeout(themeTimer);
    themeTimer = setTimeout(function () { root.classList.remove('theme-anim'); }, 450);
  }

  $('#themeBtn').addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next, true);
    toast(next === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado');
  });

  $('#motionBtn').addEventListener('click', function () {
    var still = root.classList.toggle('no-motion');
    savePref('odc-ddm-animaciones', still ? 'off' : 'on');
    renderPrefs();
    background.update();
    toast(still ? 'Animaciones en pausa' : 'Animaciones activadas');
  });

  // Si la persona no ha elegido tema, se sigue el del sistema cuando cambia
  if (window.matchMedia) {
    var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemTheme = function (e) {
      var saved = null;
      try { saved = localStorage.getItem('odc-ddm-tema'); } catch (err) { /* sin almacenamiento */ }
      if (!saved) setTheme(e.matches ? 'dark' : 'light', false);
    };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSystemTheme);
    else if (darkQuery.addListener) darkQuery.addListener(onSystemTheme);
  }

  /* ------------------------------------------------------------------ */
  /* Arranque                                                             */
  /* ------------------------------------------------------------------ */
  renderPrefs();
  SCORM.init();
  loadState();
  buildMenu();
  renderCharts();
  $$('.dnd[data-act]').forEach(initDnD);
  $$('.detective[data-act]').forEach(initDetective);
  $$('[data-quiz]').forEach(function (q) { quizInits[q.dataset.quiz] = initQuiz(q); });
  initReveal();
  initChat();
  initDashboard();
  initCaseLab();
  initSim1();
  initSim2();
  initPlan();
  updateGrade();

  var resume = parseInt(SCORM.get('cmi.core.lesson_location'), 10);
  go(resume > 0 && resume < screens.length ? resume : 0);
  if (resume > 0) toast('Continuamos donde lo dejaste');

  var closed = false;
  function onExit() {
    if (closed) return;
    closed = true;
    saveState(true);
    SCORM.finish();
  }
  window.addEventListener('beforeunload', onExit);
  window.addEventListener('pagehide', onExit);
})();
