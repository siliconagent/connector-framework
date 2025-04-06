// src/types/operation.ts

export interface OperationDefinition {
  id: string;
  name: string;
  description?: string;
  inputSchema?: any; // Define schema more specifically if needed
  outputSchema?: any; // Define schema more specifically if needed
  operationCategory?: string;
  sampleInputs?: any[];
  sampleOutputs?: any[];
  rateLimitingInfo?: any; // Define rate limiting info structure
  errorCodes?: any; // Define error codes structure
  execute: (inputs: any, auth: any, options?: any) => Promise<any>;
}

```
