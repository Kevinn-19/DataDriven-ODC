/* ODC Data Driven Manager · lógica del recorrido */
(function () {
  'use strict';

  /*
   * Audio de Insight: si grabas locuciones, guárdalas como audio/pantalla-01.mp3,
   * audio/pantalla-02.mp3, … (número de pantalla con dos dígitos) y cambia esto a true.
   * Mientras sea false, Insight lee el guion con la voz del navegador.
   */
  var USE_AUDIO_FILES = false;

  // Ponderación de la nota (storyboard): actividades 40 %, simuladores 35 %, evaluación final 25 %.
  var WEIGHTS = { act: 0.40, sim: 0.35, fin: 0.25 };
  var PASS_SCORE = 70;
  var ACTIVITIES = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
  var MAX_ATTEMPTS = 3;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var screens = $$('.screen');
  var current = 0;


  /* ------------------------------------------------------------------ */
  /* Estado persistente (cmi.suspend_data)                               */
  /* ------------------------------------------------------------------ */
  var state = { v: '', s: {}, t: {}, f: ['', '', '', '', '', ''], p: '', q: [] };

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
      if (json.length > 4000) { // límite de SCORM 1.2: 4096 caracteres
        state.f = state.f.map(function (t) { return t.slice(0, 250); });
        json = JSON.stringify(state);
      }
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
    return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
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
    pill.textContent = s.dataset.pill || '';
    pill.style.background = 'var(--' + (s.dataset.color || 'navy') + ')';
    // El fondo animado y la línea de la barra toman el color del módulo
    var accent = s.dataset.color && s.dataset.color !== 'navy' ? s.dataset.color : (s.dataset.color ? 'blue' : 'teal');
    $('#app').style.setProperty('--accent', 'var(--' + accent + ')');

    $('#counter').textContent = (i + 1) + ' / ' + screens.length;
    $('#progressBar').style.width = ((i + 1) / screens.length * 100) + '%';
    $('#prevBtn').disabled = i === 0;
    $('#nextBtn').disabled = i === screens.length - 1;
    $('#audioBtn').hidden = !$('.audio', s);

    markVisited(i);
    $$('[data-seen]').forEach(function (el) { el.hidden = !isVisited(indexOfId(el.dataset.seen)); });
    SCORM.set('cmi.core.lesson_location', String(i));
    saveState();
    if (s.querySelector('[data-results]')) renderResults();
  }

  $('#prevBtn').addEventListener('click', function () { go(current - 1); });
  $('#nextBtn').addEventListener('click', function () { go(current + 1); });
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') return;
    if (!$('#drawer').hidden || !$('#menu').hidden) {
      if (e.key === 'Escape') { closeDrawer(); closeMenu(); }
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

  /* Índice */
  function buildMenu() {
    var list = $('#menuList');
    var lastMod = '';
    var html = '';
    screens.forEach(function (s, i) {
      if (s.dataset.mod !== lastMod) {
        lastMod = s.dataset.mod;
        html += '<li class="mod">' + escapeHTML(lastMod.toUpperCase()) + '</li>';
      }
      html += '<li><button data-i="' + i + '"><span class="n">' + (i + 1) + '</span><span>' + escapeHTML(s.dataset.title) +
        '</span><span class="v" data-v="' + i + '"></span></button></li>';
    });
    list.innerHTML = html;
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (b) { closeMenu(); go(parseInt(b.dataset.i, 10)); }
    });
  }
  function openMenu() {
    $$('#menuList button[data-i]').forEach(function (b) {
      var i = parseInt(b.dataset.i, 10);
      b.classList.toggle('cur', i === current);
      $('[data-v="' + i + '"]').textContent = isVisited(i) ? '✓' : '';
    });
    $('#menu').hidden = false;
    $('#menuBackdrop').hidden = false;
  }
  function closeMenu() { $('#menu').hidden = true; $('#menuBackdrop').hidden = true; }
  $('#menuBtn').addEventListener('click', openMenu);
  $('#menuClose').addEventListener('click', closeMenu);
  $('#menuBackdrop').addEventListener('click', closeMenu);

  /* ------------------------------------------------------------------ */
  /* Insight: guion, lectura y voz                                        */
  /* ------------------------------------------------------------------ */
  var audioEl = null;
  var speaking = false;

  function openDrawer(autoplay) {
    var s = screens[current];
    var audio = $('.audio', s);
    $('#drawerScript').innerHTML = audio ? audio.innerHTML : '<p>Esta pantalla no tiene audio.</p>';
    $('#drawer').hidden = false;
    $('#drawerBackdrop').hidden = false;
    if (autoplay && audio) play();
  }
  function closeDrawer() {
    stopSpeech();
    $('#drawer').hidden = true;
    $('#drawerBackdrop').hidden = true;
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

  function play() {
    stopSpeech();
    if (USE_AUDIO_FILES) {
      var n = current + 1;
      audioEl = new Audio('audio/pantalla-' + (n < 10 ? '0' : '') + n + '.mp3');
      audioEl.addEventListener('error', speak);
      audioEl.play().catch(speak);
      $('#playBtn').textContent = '▶ Reproduciendo…';
      return;
    }
    speak();
  }

  function speak() {
    if (!('speechSynthesis' in window)) { toast('Tu navegador no permite leer en voz alta; lee el guion en el panel.'); return; }
    var paras = $$('#drawerScript p');
    var voice = pickVoice();
    speaking = true;
    $('#playBtn').textContent = '▶ Reproduciendo…';
    var i = 0;
    var next = function () {
      paras.forEach(function (p) { p.classList.remove('speaking'); });
      if (!speaking || i >= paras.length) { stopSpeech(); return; }
      var p = paras[i++];
      p.classList.add('speaking');
      var u = new SpeechSynthesisUtterance(p.textContent.replace(/\([^)]*\d{4}[^)]*\)/g, ''));
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
    $$('#drawerScript p').forEach(function (p) { p.classList.remove('speaking'); });
    $('#playBtn').textContent = '▶ Escuchar';
  }

  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = function () {};
  $('#audioBtn').addEventListener('click', function () { openDrawer(true); });
  $('#playBtn').addEventListener('click', play);
  $('#stopBtn').addEventListener('click', stopSpeech);
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#drawerBackdrop').addEventListener('click', closeDrawer);

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

    function showScore() {
      var sc = state.s[key] || 0;
      scoreBox.textContent = 'Puntos: ' + sc + ' / 100   ' + stars(sc);
    }
    showScore();

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
      fb.textContent = (perfect ? '✓ ' + root.dataset.ok : '✗ ' + right + ' de ' + chips.length + ' correctas. ' + root.dataset.bad);
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

    function refresh() {
      var n = Object.keys(picks).length;
      status.textContent = 'Errores encontrados: ' + n + ' de 5 · Puntos: ' + (lastScore == null ? (state.s.a2 || 0) : lastScore);
    }
    refresh();

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
        ? '✓ ¡Excelente! Encontraste y clasificaste los 5 errores.'
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
        { q: '¿Cuál es la primera fase del proceso de toma de decisiones?', o: ['Implementación', 'Inteligencia', 'Diseño', 'Evaluación'], a: 1,
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
      note: 'Cada pregunta vale 10 puntos; realimentación inmediata y 2 intentos',
      questions: [
        { q: 'Una aseguradora combina reclamos en PDF, audios de llamadas y fotos de siniestros. ¿Qué V representa el mayor reto para integrarlos?', o: ['Volumen', 'Velocidad', 'Variedad', 'Veracidad'], a: 2,
          e: 'Se trata de formatos y estructuras distintos (texto, audio, imagen), que es la variedad.' },
        { q: 'Un reporte de ventas por país muestra dos filas separadas: «COL» y «Colombia». ¿Qué dimensión de calidad se está incumpliendo?', o: ['Exactitud', 'Unicidad', 'Consistencia', 'Oportunidad'], a: 2,
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
      note: 'Cada pregunta vale 10 puntos; 2 intentos · Aprobación: 70 puntos o más',
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

    function stored(i) { return isFinal ? state.q[cfg.offset + i] : results[i]; }

    function firstPending() {
      for (var i = 0; i < qs.length; i++) if (stored(i) == null) return i;
      return -1;
    }

    function dots() {
      var html = '<div class="qdots">';
      for (var i = 0; i < qs.length; i++) {
        var r = stored(i);
        var cls = r == null ? (i === idx ? 'cur' : '') : (r > 0 ? 'r' : 'w');
        html += '<i class="' + cls + '"></i>';
      }
      return html + '</div>';
    }

    function render() {
      var q = qs[idx];
      var n = isFinal ? cfg.offset + idx + 1 : idx + 1;
      var total = isFinal ? cfg.total : qs.length;
      var letters = 'ABCD';
      var html = '<p class="label">Pregunta ' + n + ' de ' + total + (cfg.note ? ' · ' + cfg.note : '') + '</p>' + dots() +
        '<div class="qbox">' + n + '. ' + escapeHTML(q.q) + '</div><div class="options">';
      q.o.forEach(function (o, i) {
        html += '<button class="opt" data-o="' + i + '">' + letters[i] + ')&nbsp; ' + escapeHTML(o) + '</button>';
      });
      html += '</div><div class="qfoot"><div class="feedback info" data-fb>Elige una opción y comprueba tu respuesta.</div>' +
        '<button class="btn" data-act-btn disabled>Comprobar →</button></div>';
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
        fb.textContent = '✓ Correcto. ' + q.e;
        endQuestion(btn);
      } else if (tries < cfg.tries) {
        opt.classList.remove('chosen');
        opt.classList.add('wrong');
        opt.disabled = true;
        choice = null;
        btn.disabled = true;
        fb.className = 'feedback bad';
        fb.textContent = '✗ Aún no. Te queda 1 intento: vuelve a leer la pregunta.';
      } else {
        opt.classList.remove('chosen');
        opt.classList.add('wrong');
        $('.opt[data-o="' + q.a + '"]', root).classList.add('right');
        record(0);
        fb.className = 'feedback bad';
        fb.textContent = '✗ Aún no. ' + q.e;
        endQuestion(btn);
      }
    }

    function endQuestion(btn) {
      phase = 'next';
      $$('.opt', root).forEach(function (b) { b.disabled = true; });
      btn.disabled = false;
      btn.textContent = firstPending() === -1 ? 'Finalizar →' : 'Siguiente →';
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
          html += '<div class="feedback ok">Continúa con las preguntas 6 a 10.</div><div class="row-end"><button class="btn" data-goto="final2">Ir a la parte 2 →</button></div>';
        } else if (g.done) {
          html += '<div class="feedback ' + (g.fin >= PASS_SCORE ? 'ok' : 'bad') + '">Evaluación final: ' + g.fin + ' / 100. ' +
            (g.fin >= PASS_SCORE ? '¡Aprobaste la evaluación!' : 'Repasa los módulos y vuelve a intentarlo.') + '</div><div class="row-end">' +
            (g.fin < PASS_SCORE ? '<button class="btn ghost" data-reset-final>Reiniciar evaluación</button>' : '') +
            '<button class="btn" data-next>Ver resultados →</button></div>';
        } else {
          html += '<div class="feedback info">Te faltan preguntas de la parte 1.</div><div class="row-end"><button class="btn" data-goto="final1">Ir a la parte 1 →</button></div>';
        }
      } else {
        var sc = results.reduce(function (a, b) { return a + (b || 0); }, 0);
        state.t.a4 = (state.t.a4 || 0) + 1;
        setScore('a4', sc);
        SCORM.interaction('a4_intento' + state.t.a4, 'choice', (sc / 20) + '/5', sc >= 60 ? 'correct' : 'wrong');
        var pass = sc >= 60;
        html = '<p class="label">Resultado del cuestionario</p><div class="qbox">Puntos: ' + sc + ' / 100 &nbsp; ' + stars(sc) + '</div>' +
          '<div class="feedback ' + (pass ? 'ok' : 'bad') + '">' + (pass ? 'Buen trabajo. Has pasado el cuestionario.' : 'Vuelve a revisar las fases de la toma de decisiones e inténtalo de nuevo.') + '</div>' +
          '<div class="row-end">' + (sc < 100 && state.t.a4 < MAX_ATTEMPTS ? '<button class="btn ghost" data-retry-quiz>Intentar de nuevo (' + (MAX_ATTEMPTS - state.t.a4) + ')</button>' : '') +
          '<button class="btn" data-next>Continuar →</button></div>';
      }
      root.innerHTML = html;
      var retry = $('[data-retry-quiz]', root);
      if (retry) retry.addEventListener('click', function () { results = []; idx = 0; render(); });
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

    function restart() {
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
    s += '<polyline fill="none" stroke="#13A89E" stroke-width="2.5" points="' + vals.map(function (v, i) { return px(i) + ',' + py(v); }).join(' ') + '"/>';
    vals.forEach(function (v, i) {
      s += '<circle cx="' + px(i) + '" cy="' + py(v) + '" r="4" fill="#13A89E"><title>S' + (i + 1) + ': ' + fmt(v) + ' pedidos</title></circle>' +
        '<text x="' + px(i) + '" y="' + (y0 + 14) + '" text-anchor="middle" font-size="10" style="fill:var(--muted)">S' + (i + 1) + '</text>';
    });
    s += '<g font-size="10" style="fill:var(--ink)"><circle cx="100" cy="180" r="4" fill="#13A89E"/><text x="108" y="183">Pedidos</text>' +
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
        '<rect x="' + x0 + '" y="' + y + '" width="' + (d[1] / max * w) + '" height="24" fill="#2F6FDE"><title>' + d[0] + ': ' + String(d[1]).replace('.', ',') + ' %</title></rect>' +
        '<text x="' + (x0 + d[1] / max * w + 5) + '" y="' + (y + 16) + '" font-size="11" style="fill:var(--ink)">' + String(d[1]).replace('.', ',') + '</text>';
    });
    return s + '</svg>';
  }

  function chartBars(min, max, step, color) {
    var x0 = 44, y0 = 160, w = 240, h = 145;
    var s = '<svg viewBox="0 0 300 190" role="img" aria-label="Ventas del producto A y B">' + axisY(x0, y0, h, min, max, step, w);
    [['Producto A', 98], ['Producto B', 100]].forEach(function (d, i) {
      var bx = x0 + 30 + i * 120, top = y0 - (d[1] - min) / (max - min) * h;
      s += '<rect x="' + bx + '" y="' + top + '" width="70" height="' + (y0 - top) + '" fill="' + color + '" style="stroke:var(--ink)" stroke-width=".5"/>' +
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
    s += '<polyline fill="none" stroke="#13A89E" stroke-width="2.5" points="' + pts.join(' ') + '"/>';
    for (var q = 20; q <= 100; q += 10) {
      s += '<path d="M' + px(q) + ' ' + (py(profit(q)) - 4) + ' l4 4 l-4 4 l-4 -4z" fill="#13A89E"/>' +
        '<text x="' + px(q) + '" y="' + (y0 + 14) + '" text-anchor="middle" font-size="10" style="fill:var(--muted)">' + q + '</text>';
    }
    var u = profit(price);
    s += '<line x1="' + px(price) + '" x2="' + px(price) + '" y1="' + y0 + '" y2="' + py(u) + '" style="stroke:var(--heading)" stroke-dasharray="3 3"/>' +
      '<circle cx="' + px(price) + '" cy="' + py(u) + '" r="6" fill="#F2A541" style="stroke:var(--heading)" stroke-width="1.5"/>' +
      '<text x="' + Math.min(px(price) + 8, 340) + '" y="' + Math.max(py(u) - 8, 14) + '" font-size="11" font-weight="700" style="fill:var(--heading)">' + price + ' usd · ' + fmt(u) + '</text>';
    return s + '</svg>';
  }

  function renderCharts() {
    var c;
    if ((c = $('[data-chart="orders"]'))) c.innerHTML = chartOrders();
    if ((c = $('[data-chart="channels"]'))) c.innerHTML = chartChannels();
    if ((c = $('[data-chart="bad"]'))) c.innerHTML = chartBars(96, 101, 1, '#C00000');
    if ((c = $('[data-chart="good"]'))) c.innerHTML = chartBars(0, 120, 20, '#2E9E5B');
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
          box.style.borderLeftColor = getComputedStyle(card).borderLeftColor;
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
    $$('[data-prompt]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        $('[data-q]', root).textContent = b.textContent;
        $('[data-a]', root).textContent = ANSWERS[parseInt(b.dataset.prompt, 10)];
      });
    });
    $('[data-checklist]', root).addEventListener('click', function () {
      var box = $('[data-checklist-box]', root);
      box.hidden = !box.hidden;
    });
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

  function initFicha() {
    var root = $('[data-act="a7"]');
    if (!root) return;
    var fields = $$('textarea', root);
    var fb = $('[data-fb]', root);
    fields.forEach(function (t, i) {
      t.value = state.f[i] || '';
      t.addEventListener('input', function () { state.f[i] = t.value; saveState(); });
    });
    $('[data-save]', root).addEventListener('click', function () {
      saveState(true);
      fb.textContent = 'Guardado ✓';
      toast('Ficha guardada');
    });
    $('[data-send]', root).addEventListener('click', function () {
      var filled = fields.filter(function (t) { return t.value.trim().length >= 10; }).length;
      var missing = [];
      fields.forEach(function (t) { if (t.value.trim().length < 10) missing.push(t.labels[0].textContent); });
      setScore('a7', filled / 6 * 100);
      fields.forEach(function (t, i) { SCORM.interaction('a7_campo' + (i + 1), 'fill-in', t.value.trim(), 'neutral'); });
      if (missing.length) {
        fb.textContent = 'Completaste ' + filled + ' de 6 campos. Falta desarrollar: ' + missing.join(', ') + '.';
      } else {
        fb.textContent = '✓ Ficha enviada: los seis campos están completos. Tu docente podrá revisarla.';
      }
      SCORM.commit();
    });
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
    $('[data-confirm]', root).addEventListener('click', function () {
      var p = parseInt(range.value, 10);
      var u = profit(p);
      var score = Math.max(0, u) / 16000 * 100;
      setScore('sim1', score);
      SCORM.interaction('sim1_precio', 'numeric', p, p === 60 ? 'correct' : 'wrong');
      var supuestos = ' Supuestos del modelo: la demanda es lineal, el costo unitario es constante y la competencia no reacciona.';
      if (p === 60) {
        fb.className = 'feedback ok';
        fb.textContent = '✓ ¡Precio óptimo! Con 60 usd la demanda es 400 y la utilidad máxima, 16.000.' + supuestos;
      } else {
        fb.className = 'feedback bad';
        fb.textContent = 'Tu utilidad: ' + fmt(u) + ' (' + Math.round(score) + ' % del máximo). El óptimo es P* = (100 + 20) / 2 = 60 usd, con utilidad de 16.000.' + supuestos;
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
      B1: ['ok', 100, '✓ Excelente: preguntaste antes de actuar y validaste los datos. Reabasteciste y usaste el modelo prescriptivo para reasignar presupuesto. En entornos inciertos, la analítica ayuda a decidir de forma más racional (Cao & Duan, 2024).'],
      B2: ['bad', 60, 'Validar los datos estuvo bien, pero esperar al cierre de mes te hizo perder ventas. Con evidencia suficiente, decide.']
    };
    function reveal(btn) {
      var row = btn.closest('.route-row');
      $$('.masked', row).forEach(function (m) { m.classList.remove('masked'); });
      btn.classList.add('picked');
      $$('button', btn.closest('.routes')).forEach(function (b) { b.disabled = true; });
    }
    function finish(key) {
      var f = FEED[key];
      state.t.sim2 = (state.t.sim2 || 0) + 1;
      setScore('sim2', f[1]);
      SCORM.interaction('sim2_ruta', 'choice', key, f[1] === 100 ? 'correct' : 'wrong');
      fb.className = 'feedback ' + f[0];
      fb.textContent = 'Puntaje: ' + f[1] + ' / 100. ' + f[2] + ' Lección: los datos de buena calidad y la experiencia no compiten; se combinan según el tipo de decisión.';
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
    retry.addEventListener('click', function () {
      $$('.route-row', root).forEach(function (row) {
        $$('.conseq, .pts', row).forEach(function (m) { m.classList.add('masked'); });
        var b = $('button', row);
        b.disabled = false;
        b.classList.remove('picked');
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

    var COLORS = ['#13A89E', '#2F6FDE', '#F2A541', '#6C4AB6'];
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
  var ICONS = {
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5v13M15 5.5v13"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
  };
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
  initFicha();
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
