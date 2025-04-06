// src/auth/providers/jwt-provider.ts

export class JWTProvider {
  async authenticate(authConfig: any): Promise<any> {
    console.log('Authenticating with JWT:', authConfig);
    return { connection: { jwtToken: authConfig.jwtToken } };
  }
}
