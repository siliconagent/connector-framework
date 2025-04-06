// src/types/transformation.ts
/**
 * Transformation method types supported by the framework
 */
export enum TransformationMethod {
  SCHEMA_MAPPING = 'schema_mapping',
  JSON_PATH = 'json_path',
  TEMPLATE = 'template',
  CUSTOM = 'custom'
}

/**
 * Represents the complexity of a transformation
 */
export enum TransformationComplexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex'
}

/**
 * Configuration for schema-based transformation
 */
export interface SchemaTransformationConfig {
  method: TransformationMethod.SCHEMA_MAPPING;
  
  /**
   * Source schema definition
   */
  sourceSchema: Record<string, any>;

  /**
   * Target schema definition
   */
  targetSchema: Record<string, any>;

  /**
   * Mapping rules between source and target schemas
   */
  mappingRules: Record<string, string>;
}

/**
 * Configuration for JSON path transformation
 */
export interface JsonPathTransformationConfig {
  method: TransformationMethod.JSON_PATH;
  
  /**
   * JSON path expressions for extracting values
   */
  extractionRules: Record<string, string>;

  /**
   * Optional filtering conditions
   */
  filterConditions?: Record<string, any>;
}

/**
 * Configuration for template-based transformation
 */
export interface TemplateTransformationConfig {
  method: TransformationMethod.TEMPLATE;
  
  /**
   * Transformation template string
   */
  template: string;

  /**
   * Placeholder mapping
   */
  placeholderMap?: Record<string, string>;
}

/**
 * Configuration for custom transformation
 */
export interface CustomTransformationConfig {
  method: TransformationMethod.CUSTOM;
  
  /**
   * Identifier for the custom transformation
   */
  transformationId: string;

  /**
   * Arbitrary configuration data
   */
  config: Record<string, any>;
}

/**
 * Union type of all transformation configurations
 */
export type TransformationConfig = 
  | SchemaTransformationConfig
  | JsonPathTransformationConfig
  | TemplateTransformationConfig
  | CustomTransformationConfig;

/**
 * Options for transformation execution
 */
export interface TransformationOptions {
  /**
   * Indicates whether to validate input before transformation
   */
  validateInput?: boolean;

  /**
   * Indicates whether to validate output after transformation
   */
  validateOutput?: boolean;

  /**
   * Error handling strategy
   */
  errorHandling?: 'strict' | 'lenient' | 'ignore';

  /**
   * Additional context for transformation
   */
  context?: Record<string, any>;
}

/**
 * Transformation error details
 */
export interface TransformationError {
  /**
   * Error code
   */
  code: string;

  /**
   * Detailed error message
   */
  message: string;

  /**
   * Location or path where the error occurred
   */
  path?: string;

  /**
   * Additional error context
   */
  details?: Record<string, any>;
}

/**
 * Result of a transformation operation
 */
export interface TransformationResult<T = any> {
  /**
   * Indicates whether the transformation was successful
   */
  success: boolean;

  /**
   * Transformed data
   */
  data?: T;

  /**
   * Error information if transformation failed
   */
  error?: TransformationError;

  /**
   * Metadata about the transformation
   */
  metadata?: {
    /**
     * Timestamp of transformation start
     */
    startTime: number;

    /**
     * Timestamp of transformation completion
     */
    endTime: number;

    /**
     * Duration of transformation
     */
    duration: number;

    /**
     * Complexity of the transformation
     */
    complexity?: TransformationComplexity;
  };
}

/**
 * Interface for transformation function
 */
export interface TransformationFunction {
  /**
   * Execute the transformation
   * @param input Input data to transform
   * @param config Transformation configuration
   * @param options Transformation execution options
   * @returns Promise resolving to transformation result
   */
  transform(
    input: any, 
    config: TransformationConfig, 
    options?: TransformationOptions
  ): Promise<TransformationResult>;
}

/**
 * Registration options for a transformation
 */
export interface RegisterTransformationOptions {
  /**
   * Unique identifier for the transformation
   */
  id: string;

  /**
   * Name of the transformation
   */
  name?: string;

  /**
   * Description of the transformation
   */
  description?: string;

  /**
   * Overwrite existing transformation if it exists
   */
  overwrite?: boolean;
}

/**
 * Batch transformation configuration
 */
export interface BatchTransformationConfig {
  /**
   * Maximum number of items to transform in a single batch
   */
  maxBatchSize?: number;

  /**
   * Indicates whether batch transformation supports parallel processing
   */
  parallelProcessing?: boolean;

  /**
   * Timeout for batch transformation
   */
  batchTimeout?: number;
}

/**
 * Transformation performance metrics
 */
export interface TransformationMetrics {
  /**
   * Total number of items processed
   */
  totalItems: number;

  /**
   * Number of successful transformations
   */
  successfulTransformations: number;

  /**
   * Number of failed transformations
   */
  failedTransformations: number;

  /**
   * Average transformation time
   */
  averageTransformationTime: number;
}