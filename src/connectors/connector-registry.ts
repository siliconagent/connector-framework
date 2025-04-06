// src/connectors/connector-registry.ts

import { ConnectorDefinition } from '../types/connector';

export class ConnectorRegistry {
  private connectors: Map<string, ConnectorDefinition> = new Map();

  registerConnector(connectorDefinition: ConnectorDefinition): void {
    if (this.connectors.has(connectorDefinition.id)) {
      throw new Error(\`Connector with id '\${connectorDefinition.id}' already registered.\`);
    }
    this.connectors.set(connectorDefinition.id, connectorDefinition);
    console.log(\`Connector '\${connectorDefinition.name}' registered.\`);
  }

  getConnector(connectorId: string): ConnectorDefinition | undefined {
    return this.connectors.get(connectorId);
  }

  listConnectors(): ConnectorDefinition[] {
    return Array.from(this.connectors.values());
  }
}

```
