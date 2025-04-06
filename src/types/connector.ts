// src/types/connector.ts

import { OperationDefinition } from './operation';
import { AuthMethod } from './authentication';

export interface ConnectorDefinition {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  documentationUrl?: string;
  version: string;
  compatibilityRanges?: string[];
  categories?: string[];
  tags?: string[];
  author?: string;
  maintainer?: string;
  operations: OperationDefinition[];
  authMethods: AuthMethod[];
}

```
