import { commands, type UserInfo } from '../bindings';

function unwrap<T>(result: { status: "ok"; data: T } | { status: "error"; error: string }): T {
  if (result.status === "ok") return result.data;
  throw new Error(result.error);
}

export async function validateToken(token: string): Promise<UserInfo> {
  return unwrap(await commands.validateToken(token));
}

export async function logout(): Promise<null> {
  return unwrap(await commands.logout());
}

export async function getStoredToken(): Promise<string | null> {
  return unwrap(await commands.getStoredToken());
}

export async function checkExistingToken(): Promise<string | null> {
  return unwrap(await commands.checkExistingToken());
}
