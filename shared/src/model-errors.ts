export function isExpiredSignIn(message: string): boolean {
  return (
    /sign-in expired or was revoked/i.test(message) ||
    (/oauth.*refresh|refresh.*token/i.test(message) &&
      /invalid_grant|refresh[_ ]token[_ ](?:expired|revoked|reused)|(?:expired|revoked) refresh token/i.test(
        message,
      ))
  );
}
