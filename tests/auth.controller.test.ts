import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASS = "test";
process.env.DB_HOST = "localhost";
process.env.JWT_SECRET = "test-secret";

const { bootstrapAdmin } = await import("../src/controllers/auth.controller.js");
const { Role, User } = await import("../src/models/index.js");

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

function createResponse(): MockResponse {
  return {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

function mockRequest(body: unknown) {
  return { body } as any;
}

test.afterEach(() => {
  delete process.env.JWT_EXPIRES_IN;
});

test("bootstrapAdmin rechaza cuando JWT_SECRET no esta configurado", async () => {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  const response = createResponse();
  await bootstrapAdmin(mockRequest({}), response as any);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    ok: false,
    message: "JWT_SECRET no esta configurado",
  });

  process.env.JWT_SECRET = originalSecret;
});

test("bootstrapAdmin rechaza si ya existe algun usuario", async () => {
  const originalCount = (User as any).count;
  (User as any).count = async () => 1;

  const response = createResponse();
  await bootstrapAdmin(
    mockRequest({
      name: "Admin",
      email: "admin@example.com",
      password: "password123",
    }),
    response as any
  );

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    ok: false,
    message: "El usuario administrador inicial ya fue creado",
  });

  (User as any).count = originalCount;
});

test("bootstrapAdmin valida campos obligatorios y formato de email", async () => {
  const originalCount = (User as any).count;
  (User as any).count = async () => 0;

  const missingResponse = createResponse();
  await bootstrapAdmin(mockRequest({ email: "admin@example.com" }), missingResponse as any);

  assert.equal(missingResponse.statusCode, 400);
  assert.deepEqual(missingResponse.body, {
    ok: false,
    message: "name, email y password son obligatorios",
  });

  const emailResponse = createResponse();
  await bootstrapAdmin(
    mockRequest({
      name: "Admin",
      email: "correo-invalido",
      password: "password123",
    }),
    emailResponse as any
  );

  assert.equal(emailResponse.statusCode, 400);
  assert.deepEqual(emailResponse.body, {
    ok: false,
    message: "El email no es valido",
  });

  (User as any).count = originalCount;
});

test("bootstrapAdmin crea administrador inicial y normaliza datos", async () => {
  const originalCount = (User as any).count;
  const originalCreate = (User as any).create;
  const originalFindOrCreate = (Role as any).findOrCreate;

  (User as any).count = async () => 0;
  (Role as any).findOrCreate = async () => [
    {
      id: "role-admin-id",
      name: "admin",
      nameDisplay: "Administrador",
    },
  ];
  (User as any).create = async (payload: any) => ({
    id: "user-admin-id",
    name: payload.name,
    email: payload.email,
    role_id: payload.role_id,
    client_id: payload.client_id,
    active: payload.active,
  });

  const response = createResponse();
  await bootstrapAdmin(
    mockRequest({
      name: "  Admin   Principal  ",
      email: " ADMIN@EXAMPLE.COM ",
      password: "password123",
    }),
    response as any
  );

  assert.equal(response.statusCode, 201);
  assert.equal((response.body as any).ok, true);
  assert.equal((response.body as any).user.name, "Admin Principal");
  assert.equal((response.body as any).user.email, "admin@example.com");
  assert.equal((response.body as any).user.role.name, "admin");
  assert.equal(typeof (response.body as any).token, "string");

  (User as any).count = originalCount;
  (User as any).create = originalCreate;
  (Role as any).findOrCreate = originalFindOrCreate;
});
