# Backend TL

API REST para gestionar clientes, usuarios, prendas, lotes operativos, movimientos de inventario, stock y dashboards de una operacion textil/lavanderia.

El backend esta construido con Node.js, Express 5, TypeScript, Sequelize y PostgreSQL.

## Requisitos

- Node.js compatible con `tsx`.
- PostgreSQL disponible.
- Archivo `.env.dev` en la raiz del proyecto.

## Configuracion

Crea un archivo `.env.dev` con las variables usadas por la aplicacion:

```env
PORT=3000
DB_NAME=backendtl
DB_USER=postgres
DB_PASS=postgres
DB_HOST=localhost
JWT_SECRET=change-me
JWT_EXPIRES_IN=8h
```

`JWT_EXPIRES_IN` es opcional; si no se define, el token expira en `8h`.

## Instalacion

```bash
npm install
```

## Base de datos

Sincronizar el esquema:

```bash
npm run db:sync
```

Cargar datos iniciales:

```bash
npm run db:seed
```

El seed crea:

- Roles: `admin`, `client_operator`, `warehouse_operator`, `transportista`.
- Estados de movimiento: desde `BORRADOR_CLIENTE` hasta `CERRADO`.

## Ejecucion

Modo desarrollo con recarga:

```bash
npm run dev
```

Modo normal:

```bash
npm start
```

Por defecto la API queda disponible en:

```text
http://localhost:3000
```

Las rutas de negocio cuelgan de:

```text
http://localhost:3000/api
```

## Autenticacion

La mayoria de endpoints requieren JWT enviado por header:

```http
Authorization: Bearer <token>
```

Crear el primer administrador:

```http
POST /api/auth/bootstrap-admin
Content-Type: application/json
```

```json
{
  "name": "Administrador",
  "email": "admin@example.com",
  "password": "password123"
}
```

Este endpoint es publico solo para inicializar el sistema. Si ya existe cualquier usuario en la tabla `users`, responde `409` y no crea nada.

Login:

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

Respuesta exitosa:

```json
{
  "ok": true,
  "message": "Login correcto",
  "token": "<jwt>",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": {
      "id": "...",
      "name": "admin"
    },
    "client": null
  }
}
```

## Roles

- `admin`: administra clientes, usuarios, catalogos y puede operar todos los lotes.
- `client_operator`: crea y despacha lotes de su cliente; puede cerrar lotes retornados.
- `warehouse_operator`: opera recepcion, evaluacion, movimientos, stock y transiciones internas.
- `transportista`: consulta vehiculos activos e inicia/finaliza jornadas con checklist y comprobante PDF.

## Flujo principal de lotes

1. Cliente o admin crea un lote en `BORRADOR_CLIENTE`.
2. Cliente o admin agrega prendas al lote.
3. Cliente o admin despacha el lote a planta, cambiando a `PENDIENTE_RECEPCION`.
4. Planta recepciona el lote, cambiando a `RECEPCIONADO`.
5. Planta evalua el lote:
   - `can_process: true` lleva a `EN_PROCESO`.
   - `can_process: false` lleva a `DERIVADO_EXTERNO`.
6. Planta/admin registra transiciones operativas.
7. Cliente cierra el lote cuando queda en `RETORNADO_CLIENTE`.

Punto importante: el `client_operator` solo puede modificar prendas del lote mientras el lote esta en `BORRADOR_CLIENTE`. Una vez enviado a despacho y cambiado a `PENDIENTE_RECEPCION`, ya no puede agregar, editar ni eliminar items del lote.

Transiciones generales permitidas:

| Desde | Hacia |
| --- | --- |
| `EN_PROCESO` | `REPROCESO`, `PREPARADO_DESPACHO` |
| `REPROCESO` | `EN_PROCESO`, `PREPARADO_DESPACHO` |
| `DERIVADO_EXTERNO` | `EN_TRASLADO` |
| `PREPARADO_DESPACHO` | `EN_TRASLADO` |
| `EN_TRASLADO` | `RETORNADO_CLIENTE` |
| `RETORNADO_CLIENTE` | `CERRADO` |

## Entidades principales

- `Client`: cliente con RUT, contacto, correo, telefono y estado activo.
- `code_prefix`: prefijo unico del cliente usado para generar codigos de prenda.
- `User`: usuario con rol y cliente asociado opcional.
- `Role`: rol de autorizacion.
- `Garment`: prenda catalogada por cliente, codigo compuesto por prefijo, talla, color, barcode y valor.
- `GarmentPriceHistory`: historial de cambios de valor de una prenda.
- `MovementStatus`: estado operativo del lote/inventario.
- `GarmentBatch`: lote de prendas por cliente.
- `GarmentBatchItem`: prenda dentro de un lote, cantidades y calculos monetarios.
- `GarmentMovement`: movimiento de inventario por prenda, lote y estado.
- `GarmentStock`: stock agregado por cliente, prenda y estado.
- `Vehicle`: vehiculo usado por transportistas.
- `DriverShift`: jornada de transportista con kilometraje, checklist y comprobante PDF.

## Calculo de valores de items

Al agregar o actualizar una prenda en un lote:

- `unit_value` se copia desde `garments.value` al crear el item.
- Ese precio queda congelado en el lote y no cambia si luego se modifica el valor de la prenda.
- `calculated_total = unit_value * quantity_sent`.
- Al actualizar cantidades, el total se recalcula usando el `unit_value` historico del item.

## Modulo transportista

- Los administradores gestionan vehiculos con `/api/vehicles`.
- Transportistas y administradores consultan vehiculos activos con `/api/vehicles/active`.
- La jornada se inicia con `/api/driver-shifts/start`, indicando vehiculo, kilometraje inicial y checklist completo.
- Solo puede existir una jornada activa por transportista.
- La jornada se finaliza con `/api/driver-shifts/finish`; el kilometraje final no puede ser menor al inicial.
- Cada jornada genera o regenera un comprobante PDF descargable desde `/api/driver-shifts/:id/ticket`.

## Documentacion de API

La referencia de endpoints esta en [docs/API.md](docs/API.md).

## Postman

La collection dinamica esta en [docs/postman/Terminal_Logistico.postman_collection.json](docs/postman/Terminal_Logistico.postman_collection.json).

Importala en Postman y ajusta la variable `baseUrl` si tu API no corre en `http://localhost:3000/api`. La collection incluye 48 requests agrupados por Auth, catalogos base, clientes, usuarios, prendas, lotes, stock/dashboard, vehiculos y jornadas de transportista. Ejecuta `Auth / Login` para guardar `token`; luego ejecuta los listados base para poblar variables como `roleId`, `clientId`, `garmentId`, `batchId`, `itemId`, `statusPendingId` y `vehicleId`.

## Scripts disponibles

| Script | Descripcion |
| --- | --- |
| `npm run dev` | Ejecuta la API con `tsx --watch` y `.env.dev`. |
| `npm start` | Ejecuta la API con `.env.dev`. |
| `npm run db:sync` | Sincroniza modelos Sequelize contra PostgreSQL usando `alter: true`. |
| `npm run db:seed` | Carga roles, estados y procesos iniciales. |
| `npm test` | Ejecuta la suite automatizada con `node:test` y `tsx`. |

## Tests

La suite usa el runner nativo de Node (`node:test`) ejecutado por `tsx`, por lo que no requiere compilar TypeScript antes ni instalar librerias adicionales.

Ejecutar tests:

```bash
npm test
```

Cobertura actual:

- Validadores compartidos: RUT, email, telefono chileno, strings requeridos, numeros, enteros y normalizadores.
- `POST /api/auth/bootstrap-admin`: valida `JWT_SECRET`, bloqueo cuando ya existen usuarios, payload invalido y creacion exitosa con datos normalizados.

Los tests del controlador usan mocks de modelos Sequelize, por lo que no requieren una base de datos activa.

## Estructura del proyecto

```text
src/
  controllers/   Logica HTTP de cada recurso
  database/      Sync y seed
  helpers/       Utilidades de autenticacion/autorizacion
  middlewares/   JWT y validacion de roles
  models/        Modelos Sequelize y relaciones
  routes/        Definicion de endpoints
  service/       Servicios de dominio compartidos
  utils/         Validadores comunes
  validators/    Validadores de formularios/catalogos
```

## Notas de desarrollo

- Todas las respuestas de negocio usan el formato base `{ "ok": boolean, ... }`.
- Los IDs son UUID.
- La base usa nombres de columnas `underscored` en PostgreSQL.
- No hay migraciones versionadas; el esquema se actualiza con `sequelize.sync({ alter: true })`.
- El primer usuario administrador se crea con `POST /api/auth/bootstrap-admin` despues de sincronizar y sembrar la base de datos.
