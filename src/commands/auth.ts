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

export async function oauthStart(): Promise<string> {
  return unwrap(await commands.oauthStart());
}

export async function oauthExchangeCode(callbackUrl: string): Promise<UserInfo> {
  return unwrap(await commands.oauthExchangeCode(callbackUrl));
}

export async function oauthCancel(): Promise<null> {
  return unwrap(await commands.oauthCancel());
}
