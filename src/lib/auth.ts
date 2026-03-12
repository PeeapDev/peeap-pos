import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import { NextRequest } from "next/server";

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "https://auth.peeap.com";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${AUTH_SERVICE_URL}/.well-known/jwks.json`)
    );
  }
  return jwks;
}

export interface AuthPayload extends JWTPayload {
  sub: string;
  email?: string;
  phone?: string;
  roles: string[];
  client?: string;
}

export async function validateToken(
  token: string
): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: AUTH_SERVICE_URL,
    });
    return payload as AuthPayload;
  } catch (err) {
    console.error("JWT validation failed:", err);
    return null;
  }
}

export async function authenticateRequest(
  request: NextRequest
): Promise<AuthPayload | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  return validateToken(token);
}

export function authenticateServiceCall(request: NextRequest): boolean {
  const secret = request.headers.get("x-service-secret");
  return !!secret && secret === process.env.SERVICE_SECRET;
}
