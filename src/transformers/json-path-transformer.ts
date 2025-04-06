// src/transformers/json-path-transformer.ts
import { 
  TransformationFunction, 
  TransformationResult, 
  JsonPathTransformationConfig,
  TransformationOptions
} from '../types/transformation';

/**
 * Utility for parsing and evaluating JSON paths
 */
class JsonPathProcessor {
  /**
   * Extract value from an object using JSON path
   * @param obj Source object
   * @param path JSON path expression
   * @returns Extracted value
   */
  static extract(obj: any, path: string): any {
    // Split the path into segments
    const segments = this.normalizePath(path);
    
    // Traverse the object
    return segments.reduce((current, segment) => {
      // Handle array indexing
      if (segment.includes('[')) {
        const [prop, index] = this.parseArrayAccess(segment);
        return prop ? current?.[prop]?.[index] : current?.[index];
      }
      
      // Standard property access
      return current?.[segment];
    }, obj);
  }

  /**
   * Normalize JSON path by removing '$' and converting dot notation
   * @param path Original path
   * @returns Normalized path segments
   */
  private static normalizePath(path: string): string[] {
    // Remove leading '$' if present
    path = path.replace(/^\$\.?/, '');
    
    // Split by dot, handling bracket notation
    return path.split(/\.(?![^\[]*\])/g);
  }

  /**
   * Parse array access notation
   * @param segment Path segment potentially containing array access
   * @returns Tuple of property and index
   */
  private static parseArrayAccess(segment: string): [string | null, number | null] {
    const match = segment.match(/^([^[]*)\[(\d+)\]$/);
    
    if (match) {
      const prop = match[1] || null;
      const index = parseInt(match[2], 10);
      return [prop, index];
    }
    
    return [null, null];
  }
}

/**
 * JSON Path Transformer implementation
 */
export class JsonPathTransformer implements TransformationFunction {
  /**
   * Transform input data using JSON path extraction rules
   * @param input Input data to transform
   * @param config JSON path transformation configuration
   * @param options Transformation options
   * @returns Transformation result
   */
  async transform(
    input: any, 
    config: JsonPathTransformationConfig, 
    options: TransformationOptions = {}
  ): Promise<TransformationResult> {
    const startTime = Date.now();

    try {
      // Validate input if requested
      if (options.validateInput) {
        this.validateInput(input);
      }

      // Extract data using JSON path rules
      const transformedData = this.extractData(input, config);

      // Validate output if requested
      if (options.validateOutput) {
        this.validateOutput(transformedData);
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
   * Extract data based on JSON path configuration
   * @param input Input data
   * @param config Transformation configuration
   * @returns Transformed data
   */
  private extractData(
    input: any, 
    config: JsonPathTransformationConfig
  ): Record<string, any> {
    const result: Record<string, any> = {};

    // Process extraction rules
    for (const [key, path] of Object.entries(config.extractionRules)) {
      const value = JsonPathProcessor.extract(input, path);
      
      // Apply optional filtering
      if (this.passesFilter(value, config.filterConditions?.[key])) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Validate input data
   * @param input Input to validate
   */
  private validateInput(input: any): void {
    if (input === null || input === undefined) {
      throw new Error('Input cannot be null or undefined');
    }

    if (typeof input !== 'object') {
      throw new Error('Input must be an object');
    }
  }

  /**
   * Validate transformed output
   * @param output Transformed data to validate
   */
  private validateOutput(output: any): void {
    if (typeof output !== 'object') {
      throw new Error('Transformation must result in an object');
    }
  }

  /**
   * Check if a value passes the specified filter conditions
   * @param value Value to filter
   * @param filter Filter condition
   * @returns Boolean indicating if value passes filter
   */
  private passesFilter(value: any, filter?: any): boolean {
    // No filter means always pass
    if (filter === undefined) return true;

    // Handle different filter types
    if (typeof filter === 'function') {
      return filter(value);
    }

    // Exact value match
    if (value === filter) return true;

    // Array of acceptable values
    if (Array.isArray(filter) && filter.includes(value)) return true;

    // Regex match for strings
    if (filter instanceof RegExp && typeof value === 'string') {
      return filter.test(value);
    }

    return false;
  }
}

// Export a singleton instance for convenient use
export const jsonPathTransformer = new JsonPathTransformer();