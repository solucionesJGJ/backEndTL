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

- Roles: `admin`, `client_operator`, `warehouse_operator`.
- Estados de movimiento: desde `BORRADOR_CLIENTE` hasta `CERRADO`.
- Procesos de prenda: `SUCIO_NORMAL`, `MANCHADO`, `REPROCESO`.

Nota: las rutas de tipos de prenda permiten el rol `operator`, pero el seed actual no crea ese rol. Para usar esos endpoints con datos iniciales, utiliza `admin` o ajusta la ruta/seed segun corresponda.

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
- `User`: usuario con rol y cliente asociado opcional.
- `Role`: rol de autorizacion.
- `GarmentType`: tipo de prenda.
- `Garment`: prenda catalogada por codigo, tipo, talla, color, barcode y valor.
- `GarmentProcess`: proceso aplicado a una prenda y porcentaje de recargo.
- `MovementStatus`: estado operativo del lote/inventario.
- `GarmentBatch`: lote de prendas por cliente.
- `GarmentBatchItem`: prenda dentro de un lote, cantidades y calculos monetarios.
- `GarmentMovement`: movimiento de inventario por prenda, lote y estado.
- `GarmentStock`: stock agregado por cliente, prenda y estado.

## Calculo de valores de items

Al agregar o actualizar una prenda en un lote:

- `unit_value` se toma desde `garments.value`.
- `process_percentage` se toma desde `garment_processes.percentage`.
- `calculated_unit_value = unit_value + (unit_value * process_percentage / 100)`.
- `calculated_total = calculated_unit_value * (quantity_received || quantity_sent)`.
- Si el proceso tiene codigo `REPROCESO`, al crear el item el valor unitario calculado queda en `0`.

## Documentacion de API

La referencia de endpoints esta en [docs/API.md](docs/API.md).

## Scripts disponibles

| Script | Descripcion |
| --- | --- |
| `npm run dev` | Ejecuta la API con `tsx --watch` y `.env.dev`. |
| `npm start` | Ejecuta la API con `.env.dev`. |
| `npm run db:sync` | Sincroniza modelos Sequelize contra PostgreSQL usando `alter: true`. |
| `npm run db:seed` | Carga roles, estados y procesos iniciales. |
| `npm test` | No hay tests configurados actualmente. |

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
- No hay usuario inicial creado por seed. Para hacer login, debe existir al menos un usuario activo con password hasheado y rol valido.
