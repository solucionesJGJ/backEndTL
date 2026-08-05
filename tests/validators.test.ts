import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanRut,
  formatRut,
  isNonEmptyString,
  isNonNegativeInteger,
  isNonNegativeNumber,
  isOptionalNonNegativeInteger,
  isOptionalNonNegativeNumber,
  isPositiveInteger,
  isPositiveNumber,
  isRequired,
  isValidEmail,
  isValidPhoneCL,
  isValidRut,
  normalizeCode,
  normalizeText,
} from "../src/utils/validators.js";

test("validadores de strings requeridos", () => {
  assert.equal(isRequired(" texto "), true);
  assert.equal(isRequired("   "), false);
  assert.equal(isRequired(null), false);
  assert.equal(isRequired(0), true);

  assert.equal(isNonEmptyString(" texto "), true);
  assert.equal(isNonEmptyString("   "), false);
  assert.equal(isNonEmptyString(123), false);
});

test("validadores de email, telefono chileno y RUT", () => {
  assert.equal(isValidEmail("usuario@example.com"), true);
  assert.equal(isValidEmail("usuario@example"), false);

  assert.equal(isValidPhoneCL("+56912345678"), true);
  assert.equal(isValidPhoneCL("912345678"), true);
  assert.equal(isValidPhoneCL("+56212345678"), false);

  assert.equal(cleanRut("12.345.678-5"), "123456785");
  assert.equal(formatRut("123456785"), "12.345.678-5");
  assert.equal(isValidRut("12.345.678-5"), true);
  assert.equal(isValidRut("12.345.678-0"), false);
});

test("validadores numericos rechazan vacios, NaN y negativos segun corresponda", () => {
  assert.equal(isPositiveNumber(1), true);
  assert.equal(isPositiveNumber("1"), true);
  assert.equal(isPositiveNumber(0), false);
  assert.equal(isPositiveNumber(""), false);
  assert.equal(isPositiveNumber("abc"), false);

  assert.equal(isNonNegativeNumber(0), true);
  assert.equal(isNonNegativeNumber("10.5"), true);
  assert.equal(isNonNegativeNumber(-1), false);

  assert.equal(isOptionalNonNegativeNumber(undefined), true);
  assert.equal(isOptionalNonNegativeNumber(""), true);
  assert.equal(isOptionalNonNegativeNumber("-1"), false);
});

test("validadores de enteros distinguen decimales", () => {
  assert.equal(isPositiveInteger(1), true);
  assert.equal(isPositiveInteger("2"), true);
  assert.equal(isPositiveInteger("2.5"), false);
  assert.equal(isPositiveInteger(0), false);

  assert.equal(isNonNegativeInteger(0), true);
  assert.equal(isNonNegativeInteger("5"), true);
  assert.equal(isNonNegativeInteger("5.1"), false);

  assert.equal(isOptionalNonNegativeInteger(undefined), true);
  assert.equal(isOptionalNonNegativeInteger(""), true);
  assert.equal(isOptionalNonNegativeInteger("-1"), false);
});

test("normalizadores limpian espacios y codigos", () => {
  assert.equal(normalizeText("  Hola    Mundo  "), "Hola Mundo");
  assert.equal(normalizeCode(" sucio normal "), "SUCIO_NORMAL");
});
