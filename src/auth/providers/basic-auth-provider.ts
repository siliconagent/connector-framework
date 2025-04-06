// src/auth/providers/basic-auth-provider.ts

export class BasicAuthProvider {
  async authenticate(authConfig: any): Promise<any> {
    console.log('Authenticating with Basic Auth:', authConfig);
    return { connection: { username: authConfig.username, password: authConfig.password } };
  }
}
