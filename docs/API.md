# Referencia de API

Base URL local:

```text
http://localhost:3000/api
```

Salvo login, los endpoints requieren:

```http
Authorization: Bearer <token>
```

## Respuestas

Respuesta exitosa tipica:

```json
{
  "ok": true,
  "data": {}
}
```

Respuesta de error tipica:

```json
{
  "ok": false,
  "message": "Descripcion del error"
}
```

## Auth

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `POST` | `/auth/bootstrap-admin` | Publico inicial | Crea el primer administrador solo si no existe ningun usuario. |
| `POST` | `/auth/login` | Publico | Inicia sesion y devuelve JWT. |

Payload para bootstrap:

```json
{
  "name": "Administrador",
  "email": "admin@example.com",
  "password": "password123"
}
```

Reglas:

- Requiere `JWT_SECRET` configurado.
- `name`, `email` y `password` son obligatorios.
- `email` debe ser valido.
- `password` debe tener al menos 8 caracteres.
- Si ya existe cualquier usuario, responde `409`.
- Crea o reutiliza el rol `admin`.
- Devuelve el usuario creado y un JWT.

Payload para login:

```json
{
  "email": "usuario@example.com",
  "password": "password123"
}
```

## Clientes

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/clients` | `admin`, `client_operator`, `warehouse_operator` | Lista clientes. |
| `GET` | `/clients/:id` | `admin`, `client_operator`, `warehouse_operator` | Obtiene un cliente. |
| `POST` | `/clients` | `admin` | Crea un cliente. |
| `PUT` | `/clients/:id` | `admin` | Actualiza un cliente. |

Crear/actualizar:

```json
{
  "name": "Clinica Central",
  "rut": "76123456-7",
  "address": "Av. Principal 123",
  "contact_name": "Maria Perez",
  "contact_email": "maria@example.com",
  "contact_phone": "+56912345678",
  "active": true
}
```

Validaciones relevantes:

- `name`, `rut`, `contact_name`, `contact_email` y `contact_phone` son obligatorios al crear.
- Los mismos campos son obligatorios al actualizar.
- RUT, email y telefono chileno son validados.
- `rut` debe ser unico.
- El RUT se normaliza antes de guardar y comparar duplicados.

## Usuarios

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/users` | `admin` | Lista usuarios sin `password_hash`. |
| `POST` | `/users` | `admin` | Crea usuario. |
| `PUT` | `/users/:id` | `admin` | Actualiza usuario. |
| `PATCH` | `/users/:id/deactivate` | `admin` | Desactiva usuario. |

Crear:

```json
{
  "name": "Operador Cliente",
  "email": "operador@example.com",
  "password": "password123",
  "role_id": "<uuid-role>",
  "client_id": "<uuid-client>"
}
```

Notas:

- `password` debe tener al menos 8 caracteres.
- `email` debe ser unico.
- `name`, `email`, `password` y `role_id` deben ser strings no vacios al crear.
- `name`, `email` y `role_id` deben ser strings no vacios al actualizar.
- Los usuarios con rol `client_operator` deben tener `client_id`.
- Los usuarios con rol `admin` o `warehouse_operator` quedan sin `client_id`.

## Roles

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/roles` | `admin` | Lista roles. |

## Tipos de prenda

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/garment-types` | `admin`, `warehouse_operator`, `client_operator` | Lista tipos. |
| `GET` | `/garment-types/:id` | `admin`, `warehouse_operator`, `client_operator` | Obtiene tipo. |
| `POST` | `/garment-types` | `admin` | Crea tipo. |
| `PUT` | `/garment-types/:id` | `admin` | Actualiza tipo. |
| `DELETE` | `/garment-types/:id` | `admin` | Elimina tipo. |
| `PATCH` | `/garment-types/:id/deactivate` | `admin` | Desactiva tipo. |

Payload:

```json
{
  "name": "Sabana",
  "description": "Ropa de cama",
  "active": true
}
```

## Prendas

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/garments` | `admin`, `warehouse_operator`, `client_operator` | Lista prendas. |
| `GET` | `/garments/:id` | `admin`, `warehouse_operator`, `client_operator` | Obtiene prenda. |
| `POST` | `/garments` | `admin` | Crea prenda. |
| `PUT` | `/garments/:id` | `admin` | Actualiza prenda. |
| `PATCH` | `/garments/:id/deactivate` | `admin` | Desactiva prenda. |

Payload:

```json
{
  "garment_type_id": "<uuid-garment-type>",
  "code": "SAB-001",
  "description": "Sabana blanca",
  "size": "1 plaza",
  "color": "Blanco",
  "barcode": "780000000001",
  "value": 1200
}
```

Validaciones:

- `garment_type_id` y `code` son obligatorios.
- `garment_type_id` debe existir.
- `code` es unico.
- `barcode` es unico si se informa.
- `value` es opcional; si se informa, debe ser numerico y no puede ser negativo.

## Procesos de prenda

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/garment-processes` | `admin`, `warehouse_operator`, `client_operator` | Lista procesos. |
| `POST` | `/garment-processes` | `admin` | Crea proceso. |
| `PUT` | `/garment-processes/:id` | `admin` | Actualiza proceso. |
| `PATCH` | `/garment-processes/:id/deactivate` | `admin` | Desactiva proceso. |

Payload:

```json
{
  "name": "Manchado",
  "code": "MANCHADO",
  "percentage": 30,
  "active": true
}
```

Validaciones:

- `name` y `code` son obligatorios.
- `percentage` es opcional; si se informa, debe ser numerico y no puede ser negativo.
- `code` se normaliza en mayusculas con guion bajo.

## Estados de movimiento

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/movement-statuses` | `admin`, `warehouse_operator`, `client_operator` | Lista estados. |

Estados iniciales del seed:

`BORRADOR_CLIENTE`, `PENDIENTE_RECEPCION`, `RECEPCIONADO`, `EN_EVALUACION`, `EN_PROCESO`, `REPROCESO`, `DERIVADO_EXTERNO`, `PREPARADO_DESPACHO`, `EN_TRASLADO`, `RETORNADO_CLIENTE`, `CERRADO`.

## Lotes de operador

Todas estas rutas estan bajo `/operator`.

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/operator/batches` | `admin`, `client_operator`, `warehouse_operator` | Lista lotes. `client_operator` ve solo su cliente. |
| `GET` | `/operator/batches/preview-number` | `admin`, `client_operator` | Previsualiza numero de lote. |
| `GET` | `/operator/batches/:id` | `admin`, `client_operator`, `warehouse_operator` | Obtiene lote. |
| `POST` | `/operator/batches` | `admin`, `client_operator` | Crea lote en borrador. |
| `PATCH` | `/operator/batches/:id/dispatch` | `admin`, `client_operator` | Despacha lote desde cliente. |
| `PATCH` | `/operator/batches/:id/receive` | `admin`, `warehouse_operator` | Recepciona lote en planta. |
| `PATCH` | `/operator/batches/:id/evaluate` | `admin`, `warehouse_operator` | Evalua si se procesa interno o externo. |
| `PATCH` | `/operator/batches/:id/change-status` | `admin`, `warehouse_operator`, `client_operator` | Cambia estado segun transiciones permitidas. |

Crear lote como admin:

```json
{
  "client_id": "<uuid-client>",
  "notes": "Retiro programado"
}
```

Crear lote como `client_operator`:

```json
{
  "notes": "Retiro programado"
}
```

Preview como admin:

```http
GET /api/operator/batches/preview-number?client_id=<uuid-client>
```

Evaluar lote:

```json
{
  "can_process": true,
  "notes": "Apto para proceso interno"
}
```

Cambiar estado:

```json
{
  "next_status_code": "PREPARADO_DESPACHO",
  "notes": "Proceso terminado"
}
```

Reglas de estado:

- `dispatch` requiere lote en `BORRADOR_CLIENTE` y cambia a `PENDIENTE_RECEPCION`.
- `receive` requiere `PENDIENTE_RECEPCION` y cambia a `RECEPCIONADO`.
- `evaluate` requiere `RECEPCIONADO` y cambia a `EN_PROCESO` o `DERIVADO_EXTERNO`.
- `client_operator` solo puede cerrar desde `RETORNADO_CLIENTE` a `CERRADO` y solo para su cliente.
- `warehouse_operator` no puede cerrar lotes retornados al cliente.

## Items de lote

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/operator/batches/:batchId/items` | `admin`, `client_operator`, `warehouse_operator` | Lista prendas del lote. |
| `POST` | `/operator/batches/:batchId/items` | `admin`, `client_operator` | Agrega prenda al lote. |
| `PUT` | `/operator/batches/:batchId/items/:itemId` | `admin`, `client_operator` | Actualiza prenda del lote. |
| `DELETE` | `/operator/batches/:batchId/items/:itemId` | `admin`, `client_operator` | Elimina prenda del lote. |

Payload de creacion:

```json
{
  "garment_id": "<uuid-garment>",
  "garment_process_id": "<uuid-process>",
  "quantity_sent": 10,
  "quantity_received": 0,
  "notes": "Sin observaciones"
}
```

Payload de actualizacion:

```json
{
  "garment_process_id": "<uuid-process>",
  "quantity_sent": 10,
  "quantity_received": 9,
  "quantity_processed": 9,
  "quantity_reprocessed": 0,
  "quantity_returned": 9,
  "notes": "Una unidad faltante"
}
```

Reglas:

- Solo se pueden modificar items si el lote esta en `BORRADOR_CLIENTE`.
- Una vez que el `client_operator` despacha el lote y este pasa a `PENDIENTE_RECEPCION`, ya no puede agregar, editar ni eliminar items.
- `client_operator` solo modifica lotes de su cliente.
- No se puede repetir la misma `garment_id` dentro del mismo lote.
- `quantity_sent` debe ser un entero mayor que 0 al crear.
- Las cantidades recibidas, procesadas, reprocesadas y retornadas deben ser enteros mayores o iguales a 0.

## Movimientos de lote

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/operator/batches/:batchId/movements` | `admin`, `warehouse_operator`, `client_operator` | Lista movimientos del lote. |
| `POST` | `/operator/batches/:batchId/movements` | `admin`, `warehouse_operator` | Registra movimiento de inventario. |

Payload:

```json
{
  "garment_id": "<uuid-garment>",
  "from_status_id": "<uuid-status-or-null>",
  "to_status_id": "<uuid-status>",
  "quantity": 5,
  "movement_type": "TRANSFER",
  "notes": "Movimiento interno"
}
```

Campos obligatorios:

- `garment_id`
- `to_status_id`
- `quantity`
- `movement_type`

Validaciones:

- `quantity` debe ser un entero mayor que 0.
- `movement_type` debe ser un string no vacio.
- `from_status_id`, si se informa, debe ser un identificador valido.

El servicio de movimientos actualiza el stock agregado por cliente, prenda y estado.

## Stock

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/stock` | `admin`, `warehouse_operator` | Lista stock agregado. |

Filtros opcionales:

```http
GET /api/stock?client_id=<uuid-client>&status_id=<uuid-status>&garment_id=<uuid-garment>
```

Si se informa un filtro, debe ser un identificador en formato string; arrays u otros tipos responden `400`.

## Dashboard

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/dashboard/plant` | `admin`, `warehouse_operator` | Resumen de planta. |
| `GET` | `/dashboard/client` | `admin`, `client_operator` | Resumen de cliente. |

Dashboard planta devuelve:

- `totalBatches`
- `estimatedRevenue`
- `statusSummary`
- `recentBatches`

Dashboard cliente:

```http
GET /api/dashboard/client?client_id=<uuid-client>
```

Para `client_operator`, el `client_id` se toma desde el usuario autenticado.

Para `admin`, `client_id` es obligatorio y debe ser un identificador en formato string.

Devuelve:

- `client`
- `totalBatches`
- `openBatches`
- `closedBatches`
- `estimatedTotal`
- `statusSummary`
- `batches`

## Codigos HTTP frecuentes

| Codigo | Uso |
| --- | --- |
| `200` | Operacion exitosa. |
| `201` | Recurso creado. |
| `400` | Payload invalido o regla de negocio incumplida. |
| `401` | Token ausente, invalido o expirado. |
| `403` | Usuario autenticado sin permisos suficientes. |
| `404` | Recurso no encontrado. |
| `409` | Conflicto por duplicidad. |
| `500` | Error interno. |

## Tests Relacionados

La suite automatizada se ejecuta con:

```bash
npm test
```

Los tests actuales cubren validadores compartidos y el flujo de `POST /auth/bootstrap-admin`, incluyendo validaciones de payload, bloqueo cuando ya existe un usuario y respuesta exitosa con token.
