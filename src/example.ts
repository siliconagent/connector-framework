import { createConnectorFramework } from './core/framework';

const connectorFramework = createConnectorFramework();

connectorFramework.registerConnector({
  id: 'example-connector',
  name: 'Example Connector',
  version: '1.0.0',
  description: 'This is an example connector.',
  operations: [
    {
      id: 'exampleOperation',
      name: 'Example Operation',
      description: 'This is an example operation.',
      execute: async (inputs: any, auth: any, options?: any) => {
        console.log('Executing example operation with inputs:', inputs, auth, options);
        return { result: 'Example operation successful' };
      }
    }
  ],
  authMethods: [{ type: 'apiKey' }]
});

async function testExample() {
  const connector = connectorFramework.getConnector('example-connector');
  if (connector) {
    console.log('Connector details:', connector);
    const result = await connectorFramework.executeOperation(
      'example-connector',
      'exampleOperation',
      { inputData: 'test' },
      { apiKey: 'test-key' }
    );
    console.log('Operation result:', result);
  } else {
    console.log('Connector not found.');
  }
}

testExample();
