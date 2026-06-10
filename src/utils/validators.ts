export function cleanRut(rut: string): string {
  return rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase()
}

export function formatRut(rut: string): string {
  const clean = cleanRut(rut)

  if (clean.length < 2) return rut

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)

  return `${Number(body).toLocaleString('es-CL')}-${dv}`
}

export function isValidRut(rut: string): boolean {
  if (!rut) return false

  const clean = cleanRut(rut)

  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)

  let sum = 0
  let multiplier = 2

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const rest = sum % 11
  const calculated = 11 - rest

  let expectedDv = ''

  if (calculated === 11) expectedDv = '0'
  else if (calculated === 10) expectedDv = 'K'
  else expectedDv = String(calculated)

  return dv === expectedDv
}

export function isValidEmail(email: string): boolean {
  if (!email) return false

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export function isValidPhoneCL(phone: string): boolean {
  if (!phone) return true

  const clean = phone.replace(/\s/g, '')

  return /^(\+?56)?9\d{8}$/.test(clean)
}

export function isRequired(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

export function isPositiveNumber(value: unknown): boolean {
  const numberValue = Number(value)
  return !Number.isNaN(numberValue) && numberValue > 0
}

export function isNonNegativeNumber(value: unknown): boolean {
  const numberValue = Number(value)
  return !Number.isNaN(numberValue) && numberValue >= 0
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '_')
}