// src/types/transformation.ts

export interface TransformationDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'schema' | 'jsonPath' | 'template';
  configSchema?: any;
  transform: (data: any, config: any) => any;
}
