// src/integrations/rule-engine-adapter.ts
import { EventEmitter } from '../events/event-emitter';
import { ConnectorOperation } from '../types/operation';
import { ConnectorConnection } from '../types/connector';

/**
 * Represents a rule in the rule engine
 */
export interface Rule {
  /**
   * Unique identifier for the rule
   */
  id: string;

  /**
   * Human-readable name of the rule
   */
  name: string;

  /**
   * Condition to evaluate the rule
   */
  condition: RuleCondition;

  /**
   * Actions to take when the rule is matched
   */
  actions: RuleAction[];

  /**
   * Priority of the rule (lower number = higher priority)
   */
  priority?: number;

  /**
   * Metadata about the rule
   */
  metadata?: Record<string, any>;
}

/**
 * Represents a condition for a rule
 */
export type RuleCondition = (context: RuleEvaluationContext) => boolean;

/**
 * Context for rule evaluation
 */
export interface RuleEvaluationContext {
  /**
   * Input data for rule evaluation
   */
  input: any;

  /**
   * Additional metadata or context
   */
  metadata?: Record<string, any>;
}

/**
 * Types of rule actions
 */
export enum RuleActionType {
  EXECUTE_OPERATION = 'execute_operation',
  TRIGGER_WEBHOOK = 'trigger_webhook',
  SEND_NOTIFICATION = 'send_notification',
  CUSTOM = 'custom'
}

/**
 * Represents an action to be taken when a rule is matched
 */
export interface RuleAction {
  /**
   * Type of action
   */
  type: RuleActionType;

  /**
   * Configuration for the action
   */
  config: any;
}

/**
 * Action to execute a connector operation
 */
export interface ExecuteOperationAction extends RuleAction {
  type: RuleActionType.EXECUTE_OPERATION;
  config: {
    /**
     * Connector ID
     */
    connectorId: string;

    /**
     * Operation ID
     */
    operationId: string;

    /**
     * Connection ID
     */
    connectionId: string;

    /**
     * Input parameters for the operation
     */
    inputs?: any;
  };
}

/**
 * Action to trigger a webhook
 */
export interface WebhookAction extends RuleAction {
  type: RuleActionType.TRIGGER_WEBHOOK;
  config: {
    /**
     * Webhook URL
     */
    url: string;

    /**
     * HTTP method
     */
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';

    /**
     * Additional headers
     */
    headers?: Record<string, string>;

    /**
     * Payload to send
     */
    payload?: any;
  };
}

/**
 * Rule Engine Adapter for Connector Framework
 */
export class RuleEngineAdapter {
  /**
   * Event emitter for rule-related events
   */
  private eventEmitter: EventEmitter;

  /**
   * Registered rules
   */
  private rules: Map<string, Rule> = new Map();

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Register a new rule
   * @param rule Rule to register
   * @returns Registered rule
   */
  registerRule(rule: Rule): Rule {
    // Validate rule
    this.validateRule(rule);

    // Check for existing rule
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule with ID ${rule.id} already exists`);
    }

    // Register the rule
    this.rules.set(rule.id, rule);

    // Emit registration event
    this.eventEmitter.emit('rule:registered', rule);

    return rule;
  }

  /**
   * Evaluate rules against a given context
   * @param context Evaluation context
   * @returns Matched rules
   */
  evaluateRules(context: RuleEvaluationContext): Rule[] {
    // Sort rules by priority (lower number = higher priority)
    const sortedRules = Array.from(this.rules.values())
      .sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity));

    // Find and execute matched rules
    const matchedRules = sortedRules.filter(rule => 
      rule.condition(context)
    );

    // Execute actions for matched rules
    matchedRules.forEach(rule => this.executeRuleActions(rule, context));

    return matchedRules;
  }

  /**
   * Execute actions for a matched rule
   * @param rule Matched rule
   * @param context Evaluation context
   */
  private async executeRuleActions(
    rule: Rule, 
    context: RuleEvaluationContext
  ): Promise<void> {
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, context);

        // Emit action execution event
        this.eventEmitter.emit('rule:action-executed', {
          ruleId: rule.id,
          actionType: action.type,
          timestamp: Date.now()
        });
      } catch (error) {
        // Emit action execution error event
        this.eventEmitter.emit('rule:action-failed', {
          ruleId: rule.id,
          actionType: action.type,
          error,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Execute a specific rule action
   * @param action Action to execute
   * @param context Evaluation context
   */
  private async executeAction(
    action: RuleAction, 
    context: RuleEvaluationContext
  ): Promise<void> {
    switch (action.type) {
      case RuleActionType.EXECUTE_OPERATION:
        await this.executeOperationAction(action as ExecuteOperationAction, context);
        break;
      
      case RuleActionType.TRIGGER_WEBHOOK:
        await this.triggerWebhookAction(action as WebhookAction, context);
        break;
      
      case RuleActionType.SEND_NOTIFICATION:
        await this.sendNotificationAction(action, context);
        break;
      
      case RuleActionType.CUSTOM:
        await this.executeCustomAction(action, context);
        break;
      
      default:
        throw new Error(`Unsupported action type: ${action.type}`);
    }
  }

  /**
   * Execute an operation action
   * @param action Operation action
   * @param context Evaluation context
   */
  private async executeOperationAction(
    action: ExecuteOperationAction, 
    context: RuleEvaluationContext
  ): Promise<void> {
    // TODO: Inject connector framework for operation execution
    // This is a placeholder for actual implementation
    console.log('Executing operation action', {
      connectorId: action.config.connectorId,
      operationId: action.config.operationId,
      inputs: {
        ...action.config.inputs,
        ...context.input
      }
    });
  }

  /**
   * Trigger a webhook action
   * @param action Webhook action
   * @param context Evaluation context
   */
  private async triggerWebhookAction(
    action: WebhookAction, 
    context: RuleEvaluationContext
  ): Promise<void> {
    // TODO: Implement actual webhook triggering
    console.log('Triggering webhook', {
      url: action.config.url,
      method: action.config.method ?? 'POST',
      payload: {
        ...action.config.payload,
        context
      }
    });
  }

  /**
   * Send a notification action
   * @param action Notification action
   * @param context Evaluation context
   */
  private async sendNotificationAction(
    action: RuleAction, 
    context: RuleEvaluationContext
  ): Promise<void> {
    // TODO: Implement notification sending logic
    console.log('Sending notification', {
      action,
      context
    });
  }

  /**
   * Execute a custom action
   * @param action Custom action
   * @param context Evaluation context
   */
  private async executeCustomAction(
    action: RuleAction, 
    context: RuleEvaluationContext
  ): Promise<void> {
    // TODO: Implement custom action execution
    console.log('Executing custom action', {
      action,
      context
    });
  }

  /**
   * Validate a rule before registration
   * @param rule Rule to validate
   */
  private validateRule(rule: Rule): void {
    if (!rule.id) {
      throw new Error('Rule must have a unique ID');
    }

    if (!rule.name) {
      throw new Error('Rule must have a name');
    }

    if (!rule.condition) {
      throw new Error('Rule must have a condition');
    }

    if (!rule.actions || rule.actions.length === 0) {
      throw new Error('Rule must have at least one action');
    }
  }

  /**
   * Subscribe to rule-related events
   * @param eventName Event name
   * @param callback Event handler
   */
  on(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.on(eventName, callback);
  }

  /**
   * Unsubscribe from rule-related events
   * @param eventName Event name
   * @param callback Event handler
   */
  off(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.off(eventName, callback);
  }
}

// Export a singleton instance for convenient use
export const ruleEngineAdapter = new RuleEngineAdapter();