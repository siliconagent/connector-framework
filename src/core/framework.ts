// src/core/framework.ts

import { ConnectorRegistry } from './connector-registry';
import { OperationExecutor } from './operation-executor';

export function createConnectorFramework() {
  const connectorRegistry = new ConnectorRegistry();
  const operationExecutor = new OperationExecutor();

  return {
    registerConnector: connectorRegistry.registerConnector.bind(connectorRegistry),
    getConnector: connectorRegistry.getConnector.bind(connectorRegistry),
    executeOperation: operationExecutor.execute.bind(operationExecutor),
  };
}

export type ConnectorFrameworkInstance = ReturnType<typeof createConnectorFramework>;
