/*
 * Envoltorio mínimo de SCORM 1.2.
 * Busca la API del LMS (Moodle la expone como window.API en un marco padre).
 * Si no la encuentra (vista local), guarda el progreso en localStorage.
 */
(function () {
  var LOCAL_KEY = 'odc-ddm-scorm12';
  var api = null;
  var local = {};
  var startedAt = Date.now();
  var finished = false;

  function findAPI(win) {
    var tries = 0;
    while (win && !win.API && win.parent && win.parent !== win && tries < 10) {
      win = win.parent;
      tries++;
    }
    return win && win.API ? win.API : null;
  }

  function locate() {
    var found = null;
    try { found = findAPI(window); } catch (e) { found = null; }
    if (!found) {
      try { if (window.opener) found = findAPI(window.opener); } catch (e) { found = null; }
    }
    return found;
  }

  function readLocal() {
    try { local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch (e) { local = {}; }
  }
  function writeLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(local)); } catch (e) { /* almacenamiento no disponible */ }
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function sessionTime() {
    var s = Math.floor((Date.now() - startedAt) / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return pad(h) + ':' + pad(m) + ':' + pad(s % 60);
  }

  var SCORM = {
    connected: false,

    init: function () {
      api = locate();
      if (api) {
        var ok = String(api.LMSInitialize('')) === 'true';
        this.connected = ok;
        if (ok) {
          var st = this.get('cmi.core.lesson_status');
          if (st === 'not attempted' || st === '') this.set('cmi.core.lesson_status', 'incomplete');
          this.set('cmi.core.score.min', '0');
          this.set('cmi.core.score.max', '100');
          this.commit();
        }
      } else {
        readLocal();
      }
      return this.connected;
    },

    get: function (key) {
      if (this.connected) return String(api.LMSGetValue(key) || '');
      return local[key] != null ? String(local[key]) : '';
    },

    set: function (key, value) {
      if (this.connected) return String(api.LMSSetValue(key, String(value))) === 'true';
      local[key] = String(value);
      writeLocal();
      return true;
    },

    commit: function () {
      if (this.connected) return String(api.LMSCommit('')) === 'true';
      writeLocal();
      return true;
    },

    /* Registra una interacción (visible en los informes de Moodle). */
    interaction: function (id, type, response, result) {
      if (!this.connected) return;
      var n = parseInt(this.get('cmi.interactions._count'), 10) || 0;
      var p = 'cmi.interactions.' + n + '.';
      this.set(p + 'id', id);
      this.set(p + 'type', type);
      this.set(p + 'student_response', String(response).slice(0, 255));
      if (result) this.set(p + 'result', result);
    },

    finish: function () {
      if (finished) return;
      finished = true;
      this.set('cmi.core.session_time', sessionTime());
      if (this.connected) {
        this.set('cmi.core.exit', this.get('cmi.core.lesson_status') === 'passed' ? '' : 'suspend');
        api.LMSCommit('');
        api.LMSFinish('');
      } else {
        writeLocal();
      }
    }
  };

  window.SCORM = SCORM;
})();
