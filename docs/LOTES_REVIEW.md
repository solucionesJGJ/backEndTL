# Revision del modulo de lotes

Fecha de revision: 2026-07-09

## Resumen

El flujo de lotes ya tiene varias protecciones importantes:

- `dispatchClientBatch` usa transaccion y mueve stock desde `BORRADOR_CLIENTE` a `PENDIENTE_RECEPCION`.
- `dispatchClientBatch` registra `GarmentMovement` automatico por prenda.
- `createGarmentMovement` valida stock disponible antes de descontar.
- `createGarmentMovement` suma stock destino y guarda `garment_id`.
- `GarmentBatchItem` evita duplicidad por indice unico `batch_id + garment_id`.
- `GarmentStock` evita duplicidad por indice unico `client_id + garment_id + status_id`.
- El `client_operator` solo puede editar items mientras el lote esta en `BORRADOR_CLIENTE`.

## Estado de implementacion

Implementado el 2026-07-09:

- `addBatchItem` ahora es atomico: crea item, ajusta stock `BORRADOR_CLIENTE` y registra movimiento `alta_borrador_cliente` en una transaccion.
- `client_operator` no puede informar `quantity_received > 0` al crear items; se fuerza `quantity_received = 0`.
- `updateBatchItem` ajusta stock borrador por delta de `quantity_sent` y registra movimiento de alta/baja de ajuste.
- `removeBatchItem` descuenta stock borrador, registra movimiento `anulacion_item_borrador_cliente` y elimina el item en transaccion.
- `createGarmentMovement` valida que exista el item y actualiza cantidades acumuladas segun `toStatus.code`.
- `receiveOperatorBatch`, `evaluateOperatorBatch` y `changeOperatorBatchStatus` usan transacciones.
- `changeOperatorBatchStatus` acepta `client_accepted` y `client_observation` y los concatena en `notes` sin requerir migracion.
- `createOperatorBatch` deja `received_at` en `null` cuando el lote nace en `BORRADOR_CLIENTE`.
- `GarmentMovement.to_status_id` permite `null` para movimientos de anulacion/reversa.

Pendiente o sujeto a definicion de negocio:

- Definir si `quantity_processed` puede superar `quantity_received + quantity_reprocessed` en algun flujo excepcional.
- Agregar pruebas automaticas especificas de lotes con mocks de Sequelize o base de datos de prueba.
- Normalizar todos los mensajes antiguos con encoding roto fuera del flujo modificado.

## Problemas Encontrados

### Critico

1. Stock inicial creado sin movimiento automatico

- Archivo: `src/controllers/operator-batch-item.controller.ts`
- Funcion: `addBatchItem`
- Referencias: crea item en `GarmentBatchItem.create` y luego stock en `GarmentStock.findOrCreate`.
- Problema: al agregar una prenda, se crea o actualiza stock en `BORRADOR_CLIENTE`, pero no se registra un `GarmentMovement`.
- Consecuencia: el stock puede existir sin trazabilidad historica.
- Correccion propuesta: envolver creacion de item, stock y movimiento inicial en una transaccion. Crear movimiento con `from_status_id: null`, `to_status_id: BORRADOR_CLIENTE`, `movement_type: "alta_borrador_cliente"`.

2. Edicion/eliminacion de items no sincroniza stock inicial

- Archivo: `src/controllers/operator-batch-item.controller.ts`
- Funciones: `updateBatchItem`, `removeBatchItem`
- Problema: si el lote sigue en `BORRADOR_CLIENTE`, se puede cambiar `quantity_sent` o eliminar el item, pero el stock en `BORRADOR_CLIENTE` no se ajusta.
- Consecuencia: `dispatchClientBatch` puede despachar cantidades incorrectas o fallar por stock insuficiente que fue dejado desfasado.
- Correccion propuesta: en `updateBatchItem`, calcular delta entre cantidad anterior y nueva, ajustar stock en `BORRADOR_CLIENTE` y registrar movimiento de ajuste. En `removeBatchItem`, descontar la cantidad del stock borrador y registrar movimiento de reversa o anulacion.

3. Movimientos manuales no actualizan cantidades del item

- Archivo: `src/service/garment-movement.service.ts`
- Funcion: `createGarmentMovement`
- Problema: el servicio actualiza stock origen/destino y crea movimiento, pero no sincroniza `GarmentBatchItem.quantity_received`, `quantity_processed`, `quantity_reprocessed` o `quantity_returned`.
- Consecuencia: dashboard, facturacion o resumen del lote pueden mostrar cantidades inconsistentes respecto al inventario real.
- Correccion propuesta: dentro de la misma transaccion, buscar el item por `batch_id + garment_id` y actualizar el campo correspondiente segun `toStatus.code`.

### Alto

4. Acciones de cambio de estado sin transaccion

- Archivo: `src/controllers/operator-batch.controller.ts`
- Funciones: `receiveOperatorBatch`, `evaluateOperatorBatch`, `changeOperatorBatchStatus`
- Problema: las acciones actualizan estado y notas del lote sin transaccion.
- Consecuencia: si luego se agregan movimientos/stock asociados, puede quedar `current_status_id` desincronizado.
- Correccion propuesta: migrar estas acciones a transacciones antes de sumar mas efectos laterales.

5. Cierre por cliente no registra conformidad estructurada

- Archivo: `src/controllers/operator-batch.controller.ts`
- Funcion: `changeOperatorBatchStatus`
- Problema: el cierre `RETORNADO_CLIENTE -> CERRADO` solo acepta `notes`; no hay campos de conformidad o recepcion cliente.
- Consecuencia: no queda una evidencia estructurada de cierre por cliente.
- Correccion propuesta: mantener compatibilidad con `notes`, pero permitir campos opcionales como `client_accepted` y `client_observation` si el frontend los necesita.
- Impacto frontend: solo si se agregan campos nuevos visibles; no rompe payload actual.

6. Idempotencia parcial en despacho

- Archivo: `src/controllers/operator-batch.controller.ts`
- Funcion: `dispatchClientBatch`
- Problema: valida estado `BORRADOR_CLIENTE`, lo que evita doble despacho normal. Sin embargo, si hay reintentos concurrentes, depende del bloqueo de fila del lote y del aislamiento de BD.
- Consecuencia: bajo concurrencia alta, podria haber conflictos o errores por stock.
- Correccion propuesta: mantener `lock` del lote y agregar tests de doble despacho. Si aparece carrera, usar aislamiento transaccional mas estricto o constraint operativo.

### Medio

7. Calculo de reproceso gratis no es consistente al actualizar item

- Archivo: `src/controllers/operator-batch-item.controller.ts`
- Funcion: `updateBatchItem`
- Problema: al crear item con proceso `REPROCESO`, el valor unitario calculado queda en `0`; al actualizar, se calcula con porcentaje y no aplica la misma regla especial.
- Consecuencia: un item actualizado a `REPROCESO` puede quedar cobrado cuando deberia ser gratis.
- Correccion propuesta: reutilizar una funcion comun de calculo que aplique la regla `process.code === "REPROCESO" => 0` tanto en create como update.

8. `quantity_received` puede ser informado por cliente al crear item

- Archivo: `src/controllers/operator-batch-item.controller.ts`
- Funcion: `addBatchItem`
- Problema: el payload acepta `quantity_received` en creacion por `client_operator`.
- Consecuencia: el cliente podria cargar cantidad recibida, que funcionalmente corresponde a bodega.
- Correccion propuesta: si `req.user.role.name === "client_operator"`, forzar `quantity_received = 0` o rechazarlo si viene distinto de `0`.
- Impacto frontend: el frontend cliente no deberia enviar `quantity_received` al crear item.

9. `received_at` se define al crear lote

- Archivo: `src/controllers/operator-batch.controller.ts`
- Funcion: `createOperatorBatch`
- Problema: el lote en `BORRADOR_CLIENTE` se crea con `received_at: new Date()`.
- Consecuencia: parece recepcionado antes de llegar a planta.
- Correccion propuesta: crear con `received_at: null` y setear fecha real en `receiveOperatorBatch`.

### Bajo

10. Mensajes con codificacion rota en algunas respuestas

- Archivos: varios controladores antiguos.
- Problema: aparecen textos como `RecepciÃ³n` o `transiciÃ³n`.
- Consecuencia: respuestas API menos prolijas.
- Correccion propuesta: normalizar encoding de archivos a UTF-8 o usar texto ASCII consistente.

## Propuesta Incremental

1. Paso 1: hacer atomico `addBatchItem`

- Envolver en transaccion.
- Crear item.
- Crear/actualizar stock `BORRADOR_CLIENTE`.
- Crear movimiento inicial.
- Agregar test automatico para confirmar item + stock + movimiento.

2. Paso 2: sincronizar update/delete de items

- `updateBatchItem`: calcular delta de `quantity_sent`.
- Ajustar stock borrador segun delta.
- Registrar movimiento de ajuste.
- `removeBatchItem`: descontar cantidad del stock borrador.
- Registrar movimiento de anulacion.
- Agregar tests para incremento, decremento y eliminacion.

3. Paso 3: sincronizar movimientos con cantidades del item

- En `createGarmentMovement`, actualizar `GarmentBatchItem`.
- Mapear estados:
  - `RECEPCIONADO` -> `quantity_received`
  - `EN_PROCESO` o `PREPARADO_DESPACHO` -> `quantity_processed`
  - `REPROCESO` -> `quantity_reprocessed`
  - `RETORNADO_CLIENTE` o `CERRADO` -> `quantity_returned`
- Definir si los campos son acumulados o snapshots antes de implementar.

4. Paso 4: endurecer transiciones criticas

- Transacciones para recepcion, evaluacion y cierre.
- Cierre con observacion/conformidad.
- Tests de transiciones invalidas.

5. Paso 5: limpiar campos y mensajes

- `received_at: null` al crear lote.
- Normalizar mensajes de respuesta.
- Documentar payloads finales del frontend.

## Checklist Manual

- Crear admin inicial.
- Crear cliente y usuario `client_operator`.
- Crear lote como cliente y verificar estado `BORRADOR_CLIENTE`.
- Agregar prenda y verificar:
  - item creado.
  - stock en `BORRADOR_CLIENTE`.
  - movimiento inicial registrado.
- Editar cantidad antes de despacho y verificar delta de stock.
- Eliminar item antes de despacho y verificar descuento de stock.
- Despachar lote y verificar:
  - estado `PENDIENTE_RECEPCION`.
  - stock descontado de `BORRADOR_CLIENTE`.
  - stock sumado a `PENDIENTE_RECEPCION`.
  - movimiento automatico por cada prenda.
- Intentar editar items despues del despacho y confirmar error `400`.
- Intentar despachar dos veces y confirmar error.
- Recepcionar como bodega.
- Registrar movimiento con stock insuficiente y confirmar error.
- Registrar movimiento valido y verificar stock destino.
- Cambiar hasta `RETORNADO_CLIENTE`.
- Cerrar como `client_operator` del mismo cliente.
- Intentar cerrar como otro cliente y confirmar error.
- Intentar modificar lote cerrado y confirmar error.

## Tests Automaticos Sugeridos

- `addBatchItem` crea item, stock inicial y movimiento en una transaccion.
- `addBatchItem` no deja stock si falla la creacion del item.
- `updateBatchItem` incrementa y decrementa stock borrador segun delta.
- `removeBatchItem` revierte stock borrador.
- `dispatchClientBatch` mueve stock por cada item y crea movimientos automaticos.
- `dispatchClientBatch` rechaza lote sin items.
- `dispatchClientBatch` rechaza stock insuficiente.
- `dispatchClientBatch` es idempotente ante segundo intento.
- `createBatchMovement` rechaza cantidad mayor al stock disponible.
- `createBatchMovement` actualiza stock origen/destino.
- `createBatchMovement` actualiza cantidades del item segun estado destino.
- `changeOperatorBatchStatus` solo permite `RETORNADO_CLIENTE -> CERRADO` al cliente correcto o admin.
- `client_operator` no puede editar items luego de despacho.
