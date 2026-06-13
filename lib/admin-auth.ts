import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "bolao_admin";
const ADMIN_TOKEN_MESSAGE = "bolao-turma-101-admin-v1";

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAdminConfigured() {
  return getAdminPassword().length >= 8;
}

export function verifyAdminPassword(password: string) {
  const expected = getAdminPassword();

  if (!isAdminConfigured()) {
    return false;
  }

  return safeCompare(password, expected);
}

export function createAdminToken() {
  const secret = getAdminPassword();

  if (!isAdminConfigured()) {
    return "";
  }

  return createHmac("sha256", secret).update(ADMIN_TOKEN_MESSAGE).digest("hex");
}

export function verifyAdminToken(token?: string) {
  if (!token || !isAdminConfigured()) {
    return false;
  }

  return safeCompare(token, createAdminToken());
}
