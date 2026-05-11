import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "product_gen_admin_session";

function clean(value) {
  return String(value || "").trim();
}

function getSessionSecret() {
  return clean(process.env.PRODUCT_GEN_SESSION_SECRET) || clean(process.env.PRODUCT_GEN_ADMIN_PASSWORD) || "product-gen";
}

function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.exp || Number(payload.exp) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function validateAdminCredentials(email, password) {
  const configuredEmail = clean(process.env.PRODUCT_GEN_ADMIN_EMAIL) || "admin@example.com";
  const configuredPassword = clean(process.env.PRODUCT_GEN_ADMIN_PASSWORD) || "change-me";

  const emailBuffer = Buffer.from(clean(email).toLowerCase());
  const configuredEmailBuffer = Buffer.from(configuredEmail.toLowerCase());
  const passwordBuffer = Buffer.from(clean(password));
  const configuredPasswordBuffer = Buffer.from(configuredPassword);

  const emailMatch =
    emailBuffer.length === configuredEmailBuffer.length &&
    crypto.timingSafeEqual(emailBuffer, configuredEmailBuffer);
  const passwordMatch =
    passwordBuffer.length === configuredPasswordBuffer.length &&
    crypto.timingSafeEqual(passwordBuffer, configuredPasswordBuffer);

  return emailMatch && passwordMatch;
}

export function createAdminSession(email) {
  return signPayload({
    sub: clean(email).toLowerCase(),
    exp: Date.now() + 1000 * 60 * 60 * 12
  });
}

export function getAdminSession(cookieStore) {
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyToken(token);
}

export function clearAdminSessionOptions() {
  return {
    name: ADMIN_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0)
  };
}

export function buildAdminSessionOptions(token) {
  return {
    name: ADMIN_COOKIE_NAME,
    value: token,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(Date.now() + 1000 * 60 * 60 * 12)
  };
}
