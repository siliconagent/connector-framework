// src/auth/providers/api-key-provider.ts

import { AuthMethod } from '../../types';

export class ApiKeyAuthProvider {
  async authenticate(authConfig: any): Promise<any> {
    console.log('Authenticating with API Key:', authConfig);
    return { connection: { apiKey: authConfig.apiKey } };
  }
}
