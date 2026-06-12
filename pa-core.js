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
  var LS_CLIENTES = 'pa_clientes';      // clientes (tenants) demo
  var LS_EMPRESAS = 'pa_empresas';      // empresas demo
  var LS_CAMPOS   = 'pa_campos';        // campos/establecimientos demo
  var LS_SESION   = 'pa_sesion';        // sesión activa { usuarioId, empresaActivaId }

  // Herramientas PROPIAS (asignable=true): id + nombre legible.
  // Deben coincidir con los data-tool del index y con §5.2 del modelo.
  var HERRAMIENTAS_PROPIAS = [
    { id: 'tablero_agro',       nombre: 'Tablero Comercial Agropecuario' },
    { id: 'tablero_evolucion',  nombre: 'Evolución de Variables' },
    { id: 'tablero_insumos_ot', nombre: 'Registro de Labores e Insumos' },
    { id: 'tablero_uso_suelo',  nombre: 'Plan de Uso del Suelo' },
    { id: 'ProgramaSiembra',    nombre: 'Programa de Siembra' },
    { id: 'tablero_hacienda',   nombre: 'Tablero de Relaciones Ganaderas' },
    { id: 'tablero_labores',    nombre: 'Tarifa de Labores y Fletes' },
    { id: 'Fitosanitarios',     nombre: 'Requerimiento de Fitosanitarios' }
  ];
  function idsHerramientasPropias() {
    var out = [];
    for (var i = 0; i < HERRAMIENTAS_PROPIAS.length; i++) out.push(HERRAMIENTAS_PROPIAS[i].id);
    return out;
  }

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
    if (lsGet(LS_CLIENTES, null)) return; // ya sembrado

    var clientes = [
      { id: 'cli_albor', nombre: 'Grupo Albor', email: 'contacto@albor.com', telefono: '358-400-0000',
        nombreContacto: 'María Pereyra', activo: true, fechaAlta: '2025-01-15',
        cuit: '30-71000000-1', razonSocial: 'Grupo Albor S.A.', direccion: 'Río Cuarto, Córdoba', facturaCentralizada: true }
    ];
    var empresas = [
      { id: 'emp_albor_sa', clienteId: 'cli_albor', razonSocial: 'Albor Agropecuaria S.A.', cuit: '30-71000000-1', direccion: 'Río Cuarto, Córdoba', condicionIVA: 'RI', activo: true },
      { id: 'emp_lospinos', clienteId: 'cli_albor', razonSocial: 'Los Pinos S.R.L.', cuit: '30-71000111-2', direccion: 'General Cabrera, Córdoba', condicionIVA: 'RI', activo: true }
    ];
    var campos = [
      { id: 'campo_elpuntal', empresaId: 'emp_albor_sa', nombre: 'El Puntal', localidad: 'Río Cuarto', partido: 'Río Cuarto', provincia: 'Córdoba', haTotales: 850 },
      { id: 'campo_laloma',  empresaId: 'emp_albor_sa', nombre: 'La Loma', localidad: 'Las Higueras', partido: 'Río Cuarto', provincia: 'Córdoba', haTotales: 420 },
      { id: 'campo_sanjose', empresaId: 'emp_lospinos', nombre: 'San José', localidad: 'General Cabrera', partido: 'Juárez Celman', provincia: 'Córdoba', haTotales: 610 }
    ];
    var usuarios = [
      { id: 'usr_admin', nombre: 'Admin Puntal', email: 'admin@puntal.com', rol: 'admin_general', clienteId: null },
      { id: 'usr_maria', nombre: 'María Pereyra', email: 'maria@albor.com', rol: 'admin_cliente', clienteId: 'cli_albor' }
    ];
    var permisos = [
      { usuarioId: 'usr_maria', empresaId: 'emp_albor_sa', campoIds: [],
        herramientas: ['tablero_agro', 'tablero_insumos_ot', 'tablero_uso_suelo', 'Fitosanitarios'], nivel: 'administrar' },
      { usuarioId: 'usr_maria', empresaId: 'emp_lospinos', campoIds: [],
        herramientas: ['tablero_insumos_ot', 'tablero_uso_suelo'], nivel: 'cargar' }
    ];
    lsSet(LS_CLIENTES, clientes);
    lsSet(LS_EMPRESAS, empresas);
    lsSet(LS_CAMPOS, campos);
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
      return { empresaId: empresaId, campoIds: [], herramientas: idsHerramientasPropias(), nivel: 'administrar' };
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

    buscarPermiso: function (usuarioId, empresaId) {
      var ps = lsGet(LS_PERMISOS, []);
      for (var i = 0; i < ps.length; i++) {
        if (ps[i].usuarioId === usuarioId && ps[i].empresaId === empresaId) return ps[i];
      }
      return null;
    },

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

    /* ---- ABM estructura: Cliente / Empresa / Campo ---- */
    listarClientes: function () { return lsGet(LS_CLIENTES, []); },
    listarCampos: function () { return lsGet(LS_CAMPOS, []); },
    empresasDeCliente: function (clienteId) {
      var es = lsGet(LS_EMPRESAS, []), out = [];
      for (var i = 0; i < es.length; i++) { if (es[i].clienteId === clienteId) out.push(es[i]); }
      return out;
    },
    camposDeEmpresa: function (empresaId) {
      var cs = lsGet(LS_CAMPOS, []), out = [];
      for (var i = 0; i < cs.length; i++) { if (cs[i].empresaId === empresaId) out.push(cs[i]); }
      return out;
    },
    guardarCliente: function (c) {
      var cs = lsGet(LS_CLIENTES, []);
      if (!c.id) { c.id = uid('cli'); cs.push(c); }
      else { var f=false; for (var i=0;i<cs.length;i++){ if(cs[i].id===c.id){cs[i]=c;f=true;break;} } if(!f) cs.push(c); }
      lsSet(LS_CLIENTES, cs); return c;
    },
    guardarEmpresa: function (e) {
      var es = lsGet(LS_EMPRESAS, []);
      if (!e.id) { e.id = uid('emp'); es.push(e); }
      else { var f=false; for (var i=0;i<es.length;i++){ if(es[i].id===e.id){es[i]=e;f=true;break;} } if(!f) es.push(e); }
      lsSet(LS_EMPRESAS, es); return e;
    },
    guardarCampo: function (k) {
      var ks = lsGet(LS_CAMPOS, []);
      if (!k.id) { k.id = uid('campo'); ks.push(k); }
      else { var f=false; for (var i=0;i<ks.length;i++){ if(ks[i].id===k.id){ks[i]=k;f=true;break;} } if(!f) ks.push(k); }
      lsSet(LS_CAMPOS, ks); return k;
    },
    borrarCliente: function (id) {
      // borra cliente + sus empresas + campos de esas empresas (cascada demo)
      var cs = lsGet(LS_CLIENTES, []), outc = [];
      for (var i=0;i<cs.length;i++){ if(cs[i].id!==id) outc.push(cs[i]); }
      lsSet(LS_CLIENTES, outc);
      var es = lsGet(LS_EMPRESAS, []), empIds = {}, oute = [];
      for (var j=0;j<es.length;j++){ if(es[j].clienteId===id) empIds[es[j].id]=true; else oute.push(es[j]); }
      lsSet(LS_EMPRESAS, oute);
      var ks = lsGet(LS_CAMPOS, []), outk = [];
      for (var m=0;m<ks.length;m++){ if(!empIds[ks[m].empresaId]) outk.push(ks[m]); }
      lsSet(LS_CAMPOS, outk);
    },
    borrarEmpresa: function (id) {
      var es = lsGet(LS_EMPRESAS, []), oute = [];
      for (var i=0;i<es.length;i++){ if(es[i].id!==id) oute.push(es[i]); }
      lsSet(LS_EMPRESAS, oute);
      var ks = lsGet(LS_CAMPOS, []), outk = [];
      for (var j=0;j<ks.length;j++){ if(ks[j].empresaId!==id) outk.push(ks[j]); }
      lsSet(LS_CAMPOS, outk);
    },
    borrarCampo: function (id) {
      var ks = lsGet(LS_CAMPOS, []), out = [];
      for (var i=0;i<ks.length;i++){ if(ks[i].id!==id) out.push(ks[i]); }
      lsSet(LS_CAMPOS, out);
    },

    resetDemo: function () {
      try {
        localStorage.removeItem(LS_CLIENTES);
        localStorage.removeItem(LS_EMPRESAS);
        localStorage.removeItem(LS_CAMPOS);
        localStorage.removeItem(LS_USUARIOS);
        localStorage.removeItem(LS_PERMISOS);
        localStorage.removeItem(LS_SESION);
      } catch (e) {}
      seedDemo();
    }
  };

  global.PA = PA;
})(window);
