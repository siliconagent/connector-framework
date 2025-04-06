// src/transformers/schema-transformer.ts
import { 
  TransformationFunction, 
  TransformationResult, 
  SchemaTransformationConfig,
  TransformationOptions
} from '../types/transformation';
import Ajv from 'ajv';

/**
 * Utility for deep object cloning and manipulation
 */
class ObjectUtils {
  /**
   * Perform deep clone of an object
   * @param obj Object to clone
   * @returns Deep cloned object
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item)) as T;
    }

    const clonedObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = this.deepClone(obj[key]);
      }
    }

    return clonedObj;
  }

  /**
   * Set value in a nested object using dot notation
   * @param obj Target object
   * @param path Dot-notated path
   * @param value Value to set
   */
  static setNestedValue(obj: any, path: string, value: any): void {
    const segments = path.split('.');
    const lastKey = segments.pop()!;
    
    const target = segments.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, obj);

    target[lastKey] = value;
  }

  /**
   * Get value from a nested object using dot notation
   * @param obj Source object
   * @param path Dot-notated path
   * @returns Value at the specified path
   */
  static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => 
      current && current[key] !== undefined ? current[key] : undefined, 
      obj
    );
  }
}

/**
 * Schema Transformer implementation
 */
export class SchemaTransformer implements TransformationFunction {
  /**
   * JSON Schema validator
   */
  private validator: Ajv;

  constructor() {
    // Initialize JSON Schema validator
    this.validator = new Ajv({
      // Enable additional validations
      allErrors: true,
      coerceTypes: true,
      useDefaults: true
    });
  }

  /**
   * Transform input data based on schema mapping
   * @param input Input data to transform
   * @param config Schema transformation configuration
   * @param options Transformation options
   * @returns Transformation result
   */
  async transform(
    input: any, 
    config: SchemaTransformationConfig, 
    options: TransformationOptions = {}
  ): Promise<TransformationResult> {
    const startTime = Date.now();

    try {
      // Validate input schema if requested
      if (options.validateInput) {
        this.validateInputSchema(input, config.sourceSchema);
      }

      // Transform the data
      const transformedData = this.mapData(input, config);

      // Validate output schema if requested
      if (options.validateOutput) {
        this.validateOutputSchema(transformedData, config.targetSchema);
      }

      return {
        success: true,
        data: transformedData,
        metadata: {
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      // Handle transformation errors
      return {
        success: false,
        error: {
          code: 'TRANSFORMATION_FAILED',
          message: error.message,
          details: {
            originalError: error,
            config
          }
        },
        metadata: {
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Map data from source to target schema
   * @param input Input data
   * @param config Transformation configuration
   * @returns Transformed data
   */
  private mapData(
    input: any, 
    config: SchemaTransformationConfig
  ): any {
    // Create a deep clone of the input to avoid mutation
    const transformedData: any = {};

    // Process mapping rules
    for (const [targetPath, sourcePath] of Object.entries(config.mappingRules)) {
      // Extract value from source
      const sourceValue = ObjectUtils.getNestedValue(input, sourcePath);

      // Set value in target
      if (sourceValue !== undefined) {
        ObjectUtils.setNestedValue(transformedData, targetPath, sourceValue);
      }
    }

    return transformedData;
  }

  /**
   * Validate input against source schema
   * @param input Input data
   * @param sourceSchema Source schema
   */
  private validateInputSchema(input: any, sourceSchema: Record<string, any>): void {
    const validate = this.validator.compile(sourceSchema);
    const valid = validate(input);

    if (!valid) {
      throw new Error(`Input validation failed: ${this.validator.errorsText(validate.errors)}`);
    }
  }

  /**
   * Validate output against target schema
   * @param output Transformed data
   * @param targetSchema Target schema
   */
  private validateOutputSchema(output: any, targetSchema: Record<string, any>): void {
    const validate = this.validator.compile(targetSchema);
    const valid = validate(output);

    if (!valid) {
      throw new Error(`Output validation failed: ${this.validator.errorsText(validate.errors)}`);
    }
  }
}

// Export a singleton instance for convenient use
export const schemaTransformer = new SchemaTransformer();