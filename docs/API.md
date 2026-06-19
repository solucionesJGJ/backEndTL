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
| `POST` | `/auth/login` | Publico | Inicia sesion y devuelve JWT. |

Payload:

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
- RUT, email y telefono chileno son validados.
- `rut` debe ser unico.

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
- El codigo actualmente valida cliente obligatorio solo cuando `role.name === "client"`, aunque el seed usa `client_operator`.

## Roles

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/roles` | `admin` | Lista roles. |

## Tipos de prenda

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/garment-types` | `admin`, `operator` | Lista tipos. |
| `GET` | `/garment-types/:id` | `admin`, `operator` | Obtiene tipo. |
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
- `code` es unico.
- `barcode` es unico si se informa.
- `value` no puede ser negativo.

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
- `client_operator` solo modifica lotes de su cliente.
- No se puede repetir la misma `garment_id` dentro del mismo lote.
- `quantity_sent` debe ser mayor que 0 al crear.

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

El servicio de movimientos actualiza el stock agregado por cliente, prenda y estado.

## Stock

| Metodo | Ruta | Roles | Descripcion |
| --- | --- | --- | --- |
| `GET` | `/stock` | `admin`, `warehouse_operator` | Lista stock agregado. |

Filtros opcionales:

```http
GET /api/stock?client_id=<uuid-client>&status_id=<uuid-status>&garment_id=<uuid-garment>
```

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
