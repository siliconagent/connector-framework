// src/transformers/template-transformer.ts
import { 
  TransformationFunction, 
  TransformationResult, 
  TemplateTransformationConfig,
  TransformationOptions
} from '../types/transformation';

/**
 * Utility class for template processing
 */
class TemplateProcessor {
  /**
   * Render a template with given data
   * @param template Template string
   * @param data Data to use for rendering
   * @param placeholderMap Optional placeholder mapping
   * @returns Rendered template string
   */
  static render(
    template: string, 
    data: Record<string, any>, 
    placeholderMap?: Record<string, string>
  ): string {
    // Create a safe context for template rendering
    const context = this.createSafeContext(data);

    // Resolve placeholders if mapping is provided
    const resolvedTemplate = placeholderMap 
      ? this.applyPlaceholderMapping(template, placeholderMap)
      : template;

    // Replace placeholders
    return resolvedTemplate.replace(/\{\{(.*?)\}\}/g, (match, expression) => {
      try {
        // Safely evaluate the expression
        return this.evaluateExpression(expression.trim(), context);
      } catch (error) {
        // Return original match if evaluation fails
        return match;
      }
    });
  }

  /**
   * Create a safe context for template rendering
   * @param data Source data
   * @returns Safe context object
   */
  private static createSafeContext(data: Record<string, any>): Record<string, any> {
    // Deep clone to prevent mutation
    const safeContext: Record<string, any> = {};

    // Recursively copy data, filtering out functions and complex objects
    const copyValue = (value: any): any => {
      if (value === null || value === undefined) return value;
      
      if (typeof value === 'function') return undefined;
      
      if (Array.isArray(value)) {
        return value.map(copyValue);
      }
      
      if (typeof value === 'object') {
        const copied: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) {
          const copiedVal = copyValue(v);
          if (copiedVal !== undefined) {
            copied[k] = copiedVal;
          }
        }
        return copied;
      }
      
      return value;
    };

    for (const [key, value] of Object.entries(data)) {
      const copiedValue = copyValue(value);
      if (copiedValue !== undefined) {
        safeContext[key] = copiedValue;
      }
    }

    return safeContext;
  }

  /**
   * Apply placeholder mapping to template
   * @param template Original template
   * @param placeholderMap Mapping of placeholders
   * @returns Modified template
   */
  private static applyPlaceholderMapping(
    template: string, 
    placeholderMap: Record<string, string>
  ): string {
    return Object.entries(placeholderMap).reduce(
      (currentTemplate, [original, replacement]) => 
        currentTemplate.replace(new RegExp(original, 'g'), replacement),
      template
    );
  }

  /**
   * Safely evaluate an expression in a given context
   * @param expression Expression to evaluate
   * @param context Context for evaluation
   * @returns Evaluated result
   */
  private static evaluateExpression(
    expression: string, 
    context: Record<string, any>
  ): string {
    // Basic dot notation path resolution
    const resolvePath = (obj: any, path: string): any => {
      return path.split('.').reduce((current, key) => 
        current && current[key] !== undefined ? current[key] : undefined, 
        obj
      );
    };

    // Resolve the value from context
    const value = resolvePath(context, expression);

    // Convert to string, handling various types
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}

/**
 * Template Transformer implementation
 */
export class TemplateTransformer implements TransformationFunction {
  /**
   * Transform input data using template configuration
   * @param input Input data to transform
   * @param config Template transformation configuration
   * @param options Transformation options
   * @returns Transformation result
   */
  async transform(
    input: any, 
    config: TemplateTransformationConfig, 
    options: TransformationOptions = {}
  ): Promise<TransformationResult> {
    const startTime = Date.now();

    try {
      // Validate input if requested
      if (options.validateInput) {
        this.validateInput(input);
      }

      // Transform the data
      const transformedData = this.processTemplate(input, config);

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
   * Process template with input data
   * @param input Input data
   * @param config Template transformation configuration
   * @returns Transformed data
   */
  private processTemplate(
    input: any, 
    config: TemplateTransformationConfig
  ): string {
    return TemplateProcessor.render(
      config.template, 
      input, 
      config.placeholderMap
    );
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
   * @param output Transformed data
   */
  private validateOutput(output: string): void {
    if (typeof output !== 'string') {
      throw new Error('Transformation must result in a string');
    }
  }
}

// Export a singleton instance for convenient use
export const templateTransformer = new TemplateTransformer();