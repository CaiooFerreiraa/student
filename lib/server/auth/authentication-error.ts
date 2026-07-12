export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Autenticação necessária.");
    this.name = "AuthenticationRequiredError";
  }
}
