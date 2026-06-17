# Rediseño de Movimientos — cabecera + líneas (modelo "comprobante")

Documento de diseño. **No se escribe código hasta aprobar esto.**

## Objetivo

Pasar el modelo de movimientos de "una fila = un movimiento (un insumo)" a
"un comprobante (cabecera) con N líneas de insumo", e incorporar de paso:

- **(C)** Cabecera con fecha, tipo de movimiento, tipo y N° de comprobante, **proveedor**, campaña.
- **(A)** El **stock inicial** deja de ser un campo del insumo y pasa a ser un comprobante
  de tipo "Stock inicial" con N líneas. Una sola fuente de verdad: el stock = suma de líneas.
- **(B)** Las líneas referencian el depósito **por id** (`origenId`/`destinoId`), no por nombre.
  Así renombrar un depósito en pa-core no rompe el historial de stock.

## Modelo de datos (Opción 2 — cabecera separada)

Dos colecciones en `state`:

### Comprobante (cabecera) — `state.comprobantes[]`
```
{
  id,                // uid
  fecha,             // 'YYYY-MM-DD'  (la fecha del evento)
  tipo,              // nombre del tipo de movimiento (Compra, Stock inicial, Traslado…)
  comp_tipo,         // 'Factura' | 'Remito' | 'OT' | 'Cierre' | …
  comp_nro,          // string
  proveedorId,       // ref a tercero (rol proveedor) de pa-core; '' si no aplica
  campaniaId,        // etiqueta de gestión (default = campaña por defecto)
  obs,               // observación de cabecera
  refOt,             // si fue generado por una OT (id de la OT); '' si manual
  refOtNum           // nro de OT para mostrar
}
```

### Línea (movimiento) — `state.movtos[]`  (se conserva el nombre)
```
{
  id,                // uid
  comprobanteId,     // ref a la cabecera  ← NUEVO vínculo
  insumoId,
  cant,
  origenId,          // ref a depósito (id) — '' si el tipo no requiere origen
  destinoId,         // ref a depósito (id) — '' si el tipo no requiere destino
  refDest            // (se conserva) id del destino de OT, para deshacer aplicaciones
}
```

**Clave del diseño:** cada línea sigue siendo "un movimiento" como hoy, así el cálculo de
stock sigue iterando `state.movtos` línea por línea. Lo único que cambia en las líneas:
- `fecha`, `tipo`, `comp_*`, `campaniaId`, `obs` ya **no viven en la línea**: se leen de su comprobante.
- `origen`/`destino` (nombre) → `origenId`/`destinoId` (id).

Helper de acceso: `compDe(mov)` devuelve la cabecera de una línea. Para campos que el cálculo
de stock necesita poco (fecha, tipo) se accede vía `compDe(mov).fecha` / `.tipo`.

## Tipos de movimiento

Se conserva la tabla actual (`tiposMov` con `signo`, `requiereOrigen`, `requiereDestino`).
**Se agrega** un tipo: `{nombre:'Stock inicial', signo:1, requiereDestino:true, requiereOrigen:false}`.
La grilla de líneas muestra columna Origen y/o Destino según `requiereOrigen/requiereDestino`
del tipo elegido en la cabecera (lo que mostraba el mockup).

## Proveedor

- Nueva función en pa-core: `PA.demo.listarTerceros(empresaId, 'proveedor')` (ya existe `listarTerceros` con rol).
- Se inyecta `state.proveedores` igual que se inyectan contratistas.
- En la cabecera, selector de proveedor (solo visible/relevante para tipos de entrada por compra).
- Solo lectura (viene de pa-core / Maestros).

## Migración automática (datos viejos → nuevo modelo)

En `migrarOTsADestinos` (o una nueva `migrarMovimientosAComprobantes`), una sola vez:

1. Por cada movimiento viejo `m` (que hoy tiene fecha/tipo/comp en la propia fila):
   - Crear un comprobante con su fecha, tipo, comp_tipo, comp_nro, campaniaId, obs, refOt.
   - Convertir `m` en línea: set `comprobanteId`, resolver `origen`(nombre)→`origenId`,
     `destino`(nombre)→`destinoId` buscando en `state.depositos` por nombre.
   - Si el nombre no matchea ningún depósito → `origenId/destinoId=''` (queda registrado, sin romper).
   - Borrar de la línea los campos viejos (fecha/tipo/comp_*/origen/destino).
2. Por cada insumo con `stockInicialPorDep`:
   - Crear (si hay cantidades ≠ 0) **un** comprobante "Stock inicial" por insumo
     (o uno global con N líneas — ver decisión abierta), con líneas {insumoId, cant, destinoId}.
   - Limpiar `ins.stockInicialPorDep` y `ins.stockInicial`.

Como el estado operativo arranca vacío por empresa (v4) y son datos de prueba, el riesgo es bajo;
igual la migración deja todo consistente si hubiera datos.

## Puntos de impacto (lo que hay que tocar) — 27 usos de `movtos`

| Zona | Función | Cambio |
|---|---|---|
| Stock | `calcStockDep` | comparar `origenId/destinoId` (no nombre); leer tipo vía `compDe(m).tipo` |
| Stock | `listDepositosConStock` | usar ids; depósitos reales por id |
| Stock | `calcStockInsumo` | sin cambios (usa las anteriores) |
| Stock | `stockInicialDep` | **se elimina** (ya no hay stock inicial separado) |
| Cierre | `calcCierrePorFecha` | sin rama de stock inicial; `compDe(mv).fecha` para el corte; ids |
| Registro | form + `guardarMov` | nuevo form cabecera+líneas; crea 1 comprobante + N líneas |
| Edición | `editMov`/`viewMov` | editar a nivel comprobante (todas sus líneas) |
| Borrado | `delMov` | borrar comprobante = borrar sus N líneas |
| Grilla | `renderMovtos` | agrupar por comprobante; fila cabecera + sublíneas (o una fila por línea con cabecera repetida — ver decisión) |
| OT | generación `Consumo OT` / `Baja` | crear comprobante tipo OT + líneas |
| OT | `deshacerAplicLote` / cancelar OT | borrar comprobante(s) por `refOt`/`refDest` |
| Cierre stock | ajustes | crear comprobante "Cierre" + líneas |
| Stock inicial | modal `openStockInicialModal` | pasa a crear/editar comprobante "Stock inicial" |
| Insumos | `renderMInsumos` col "Stock inicial" | mostrar suma de líneas "Stock inicial" (no `stockInicialPorDep`) |
| Export | hoja Movimientos | una fila por línea, con datos de cabecera resueltos |
| Filtros | campaña/tipo/fecha | leer de comprobante |
| Migración | `migrar…` | nueva migración descrita arriba |

## Plan por etapas (cada una validada antes de seguir)

- **Etapa C1 — Modelo + migración (sin tocar UI).** Crear `state.comprobantes`, agregar
  `comprobanteId/origenId/destinoId` a líneas, escribir la migración, adaptar las funciones de
  **cálculo de stock** para leer del nuevo modelo. Validar con batería de equivalencia: el stock
  da los mismos números que antes. (No se ve nada nuevo en pantalla todavía.)
- **Etapa C2 — Lectura: grilla y export.** `renderMovtos` agrupado por comprobante; export.
- **Etapa C3 — Alta: nuevo form cabecera+líneas** (el del mockup). Registrar 1 comprobante + N líneas.
- **Etapa C4 — Edición/borrado** a nivel comprobante.
- **Etapa C5 — Generación automática desde OT y Cierre** al nuevo modelo.
- **Etapa C6 — Stock inicial como comprobante** (modal reconvertido) + quitar `stockInicialPorDep`.
- **Etapa C7 — Proveedor** (pa-core + inyección + cabecera).

Orden pensado para que el stock nunca quede roto entre etapas: primero el motor (C1), luego se
construye la UI encima. Entre C1 y C3 conviven el modelo nuevo y un alta provisoria mínima.

## Decisiones abiertas (a confirmar)

1. **Destino por línea vs. por cabecera.** Mockup lo puso por línea (permite repartir una compra
   en varios depósitos). ¿Se mantiene por línea?
2. **Stock inicial: ¿un comprobante por insumo o uno solo con todas las líneas?** En la carga real
   conviene uno solo ("Inventario inicial") con N líneas. Pero el modal hoy es por insumo.
3. **Grilla de movimientos: ¿fila por comprobante expandible, o una fila por línea** repitiendo la
   cabecera? La segunda es más simple y parecida a hoy.
4. **Fecha del stock inicial:** el usuario la elige (ya decidido). Un campo de fecha en el modal.
