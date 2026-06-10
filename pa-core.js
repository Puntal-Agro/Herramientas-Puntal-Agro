/* ============================================================================
   pa-core.js — Capa de acceso Puntal Agro (Parte A del contrato)
   ----------------------------------------------------------------------------
   MODO DEMO / FALLBACK: todo se persiste en localStorage. Sin backend.
   Cuando exista backend, se reemplaza el cuerpo de estas funciones por
   llamadas reales al servidor SIN cambiar las pantallas que las usan.

   Restricciones del proyecto: ES5 estricto (var/function), sin promesas,
   sin arrow functions. Funciones asíncronas con callback function(err, data).
   ============================================================================ */
(function (global) {
  'use strict';

  var LS_USUARIOS = 'pa_usuarios';      // catálogo de usuarios demo
  var LS_PERMISOS = 'pa_permisos';      // lista de permisos (uno por usuario+empresa)
  var LS_EMPRESAS = 'pa_empresas';      // empresas demo
  var LS_SESION   = 'pa_sesion';        // sesión activa { usuarioId, empresaActivaId }

  // IDs de herramientas PROPIAS (asignable=true). Deben coincidir con los
  // data-tool del index y con §5.2 del modelo de datos.
  var HERRAMIENTAS_PROPIAS = [
    'tablero_agro', 'tablero_evolucion', 'tablero_insumos_ot', 'tablero_uso_suelo',
    'ProgramaSiembra', 'tablero_hacienda', 'tablero_labores', 'Fitosanitarios'
  ];

  /* ---------- helpers de localStorage ---------- */
  function lsGet(key, def) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    } catch (e) { return def; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
  function uid(p) {
    return (p || 'id') + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }

  /* ---------- siembra de datos demo (solo si no hay nada) ---------- */
  function seedDemo() {
    if (lsGet(LS_EMPRESAS, null)) return; // ya sembrado

    var empresas = [
      { id: 'emp_albor_sa', razonSocial: 'Albor Agropecuaria S.A.' },
      { id: 'emp_lospinos', razonSocial: 'Los Pinos S.R.L.' }
    ];
    var usuarios = [
      { id: 'usr_admin', nombre: 'Admin Puntal', email: 'admin@puntal.com', rol: 'admin_general', clienteId: null },
      { id: 'usr_maria', nombre: 'María Pereyra', email: 'maria@albor.com', rol: 'admin_cliente', clienteId: 'cli_albor' }
    ];
    // admin_general: acceso a todo (se resuelve en loadContext sin permisos explícitos)
    // maria: permisos explícitos en las dos empresas
    var permisos = [
      { usuarioId: 'usr_maria', empresaId: 'emp_albor_sa', campoIds: [],
        herramientas: ['tablero_agro', 'tablero_insumos_ot', 'tablero_uso_suelo', 'Fitosanitarios'], nivel: 'administrar' },
      { usuarioId: 'usr_maria', empresaId: 'emp_lospinos', campoIds: [],
        herramientas: ['tablero_insumos_ot', 'tablero_uso_suelo'], nivel: 'cargar' }
    ];
    lsSet(LS_EMPRESAS, empresas);
    lsSet(LS_USUARIOS, usuarios);
    lsSet(LS_PERMISOS, permisos);
  }

  /* ---------- estado en memoria del contexto activo ---------- */
  var _ctx = null;

  var PA = {};

  /* PA.init(opts, cb) — en demo solo siembra datos y queda listo */
  PA.init = function (opts, cb) {
    seedDemo();
    if (cb) cb(null);
  };

  /* PA.login(email, cb) — valida usuario (demo: sin contraseña real) */
  PA.login = function (email, cb) {
    seedDemo();
    var usuarios = lsGet(LS_USUARIOS, []);
    var u = null;
    for (var i = 0; i < usuarios.length; i++) {
      if (usuarios[i].email.toLowerCase() === String(email || '').toLowerCase()) { u = usuarios[i]; break; }
    }
    if (!u) { cb('Usuario no encontrado'); return; }

    // empresa activa por defecto: la primera a la que tiene acceso
    var disp = empresasDisponibles(u);
    if (!disp.length) { cb('El usuario no tiene empresas asignadas'); return; }

    lsSet(LS_SESION, { usuarioId: u.id, empresaActivaId: disp[0].id });
    cb(null, u);
  };

  /* PA.logout() */
  PA.logout = function () {
    try { localStorage.removeItem(LS_SESION); } catch (e) {}
    _ctx = null;
  };

  /* PA.haySesion() -> bool */
  PA.haySesion = function () {
    return !!lsGet(LS_SESION, null);
  };

  /* empresas a las que un usuario tiene acceso */
  function empresasDisponibles(usuario) {
    var empresas = lsGet(LS_EMPRESAS, []);
    if (usuario.rol === 'admin_general') return empresas.slice(); // todas
    var permisos = lsGet(LS_PERMISOS, []);
    var idsConPermiso = {};
    for (var i = 0; i < permisos.length; i++) {
      if (permisos[i].usuarioId === usuario.id) idsConPermiso[permisos[i].empresaId] = true;
    }
    var out = [];
    for (var j = 0; j < empresas.length; j++) {
      if (idsConPermiso[empresas[j].id]) out.push(empresas[j]);
    }
    return out;
  }

  /* arma el permiso del usuario para una empresa */
  function permisoPara(usuario, empresaId) {
    if (usuario.rol === 'admin_general') {
      // acceso total: todas las herramientas propias, todos los campos, administrar
      return { empresaId: empresaId, campoIds: [], herramientas: HERRAMIENTAS_PROPIAS.slice(), nivel: 'administrar' };
    }
    var permisos = lsGet(LS_PERMISOS, []);
    for (var i = 0; i < permisos.length; i++) {
      if (permisos[i].usuarioId === usuario.id && permisos[i].empresaId === empresaId) return permisos[i];
    }
    return null;
  }

  /* PA.loadContext(empresaId, cb) — devuelve el CTX (Parte A del contrato) */
  PA.loadContext = function (empresaId, cb) {
    var ses = lsGet(LS_SESION, null);
    if (!ses) { cb('Sin sesión'); return; }
    var usuarios = lsGet(LS_USUARIOS, []);
    var u = null;
    for (var i = 0; i < usuarios.length; i++) { if (usuarios[i].id === ses.usuarioId) { u = usuarios[i]; break; } }
    if (!u) { cb('Sesión inválida'); return; }

    var empAct = empresaId || ses.empresaActivaId;
    var disp = empresasDisponibles(u);
    // si la empresa pedida no está disponible, cae a la primera
    var ok = false;
    for (var k = 0; k < disp.length; k++) { if (disp[k].id === empAct) { ok = true; break; } }
    if (!ok && disp.length) empAct = disp[0].id;

    // persistir empresa activa
    ses.empresaActivaId = empAct;
    lsSet(LS_SESION, ses);

    _ctx = {
      usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol },
      clienteId: u.clienteId,
      empresaActivaId: empAct,
      empresasDisponibles: disp,
      permiso: permisoPara(u, empAct)
    };
    cb(null, _ctx);
  };

  /* PA.ctx() — acceso síncrono al contexto ya cargado */
  PA.ctx = function () { return _ctx; };

  /* PA.setEmpresaActiva(empresaId, cb) — cambia de empresa y recarga ctx */
  PA.setEmpresaActiva = function (empresaId, cb) {
    PA.loadContext(empresaId, cb);
  };

  /* PA.can(accion, opts) — chequeo síncrono de permiso (Parte A) */
  var ORDEN = { ver: 1, cargar: 2, administrar: 3 };
  PA.can = function (accion, opts) {
    if (!_ctx || !_ctx.permiso) return false;
    var p = _ctx.permiso;
    // nivel
    if ((ORDEN[p.nivel] || 0) < (ORDEN[accion] || 99)) return false;
    opts = opts || {};
    // herramienta
    if (opts.herramienta) {
      var hok = false;
      for (var i = 0; i < p.herramientas.length; i++) { if (p.herramientas[i] === opts.herramienta) { hok = true; break; } }
      if (!hok) return false;
    }
    // campo (campoIds vacío = todos)
    if (opts.campoId && p.campoIds && p.campoIds.length) {
      var cok = false;
      for (var j = 0; j < p.campoIds.length; j++) { if (p.campoIds[j] === opts.campoId) { cok = true; break; } }
      if (!cok) return false;
    }
    return true;
  };

  /* ---------- ABM de usuarios/permisos en demo (para la pantalla usuarios.html) ---------- */
  PA.demo = {
    listarUsuarios: function () { return lsGet(LS_USUARIOS, []); },
    listarEmpresas: function () { return lsGet(LS_EMPRESAS, []); },
    listarPermisos: function () { return lsGet(LS_PERMISOS, []); },
    herramientasPropias: function () { return HERRAMIENTAS_PROPIAS.slice(); },

    guardarUsuario: function (u) {
      var us = lsGet(LS_USUARIOS, []);
      if (!u.id) { u.id = uid('usr'); us.push(u); }
      else {
        var found = false;
        for (var i = 0; i < us.length; i++) { if (us[i].id === u.id) { us[i] = u; found = true; break; } }
        if (!found) us.push(u);
      }
      lsSet(LS_USUARIOS, us);
      return u;
    },
    borrarUsuario: function (id) {
      var us = lsGet(LS_USUARIOS, []), out = [];
      for (var i = 0; i < us.length; i++) { if (us[i].id !== id) out.push(us[i]); }
      lsSet(LS_USUARIOS, out);
      // borrar sus permisos
      var ps = lsGet(LS_PERMISOS, []), outp = [];
      for (var j = 0; j < ps.length; j++) { if (ps[j].usuarioId !== id) outp.push(ps[j]); }
      lsSet(LS_PERMISOS, outp);
    },
    guardarPermiso: function (perm) {
      // perm: {usuarioId, empresaId, campoIds, herramientas, nivel}
      var ps = lsGet(LS_PERMISOS, []);
      var found = false;
      for (var i = 0; i < ps.length; i++) {
        if (ps[i].usuarioId === perm.usuarioId && ps[i].empresaId === perm.empresaId) { ps[i] = perm; found = true; break; }
      }
      if (!found) ps.push(perm);
      lsSet(LS_PERMISOS, ps);
      return perm;
    },
    borrarPermiso: function (usuarioId, empresaId) {
      var ps = lsGet(LS_PERMISOS, []), out = [];
      for (var i = 0; i < ps.length; i++) {
        if (!(ps[i].usuarioId === usuarioId && ps[i].empresaId === empresaId)) out.push(ps[i]);
      }
      lsSet(LS_PERMISOS, out);
    },
    resetDemo: function () {
      try {
        localStorage.removeItem(LS_EMPRESAS);
        localStorage.removeItem(LS_USUARIOS);
        localStorage.removeItem(LS_PERMISOS);
        localStorage.removeItem(LS_SESION);
      } catch (e) {}
      seedDemo();
    }
  };

  global.PA = PA;
})(window);
