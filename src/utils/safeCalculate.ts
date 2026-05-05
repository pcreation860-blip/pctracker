/**
 * Safe Calculator - Replaces dangerous eval() usage
 * 
 * This implements a secure mathematical expression evaluator
 * that only allows basic arithmetic operations.
 * 
 * Security: No eval(), no Function constructor, no code execution
 */

export class SafeCalculator {
  private static readonly ALLOWED_CHARS = /^[0-9+\-*/.() ]+$/;
  
  /**
   * Safely calculate a mathematical expression
   * @param expression - String expression like "10 + 20 * 3"
   * @returns Calculated result or null if invalid
   */
  static calculate(expression: string): number | null {
    try {
      // Step 1: Validate input
      if (!expression || !expression.trim()) {
        return null;
      }

      // Step 2: Remove whitespace
      const cleaned = expression.replace(/\s/g, '');

      // Step 3: Check for allowed characters only
      if (!this.ALLOWED_CHARS.test(cleaned)) {
        console.warn('Invalid characters in expression:', expression);
        return null;
      }

      // Step 4: Check for balanced parentheses
      if (!this.hasBalancedParentheses(cleaned)) {
        console.warn('Unbalanced parentheses:', expression);
        return null;
      }

      // Step 5: Parse and calculate using recursive descent parser
      const result = this.parseExpression(cleaned);

      // Step 6: Validate result
      if (isNaN(result) || !isFinite(result)) {
        console.warn('Invalid calculation result:', result);
        return null;
      }

      return result;
    } catch (error) {
      console.error('Safe calculator error:', error);
      return null;
    }
  }

  /**
   * Check if parentheses are balanced
   */
  private static hasBalancedParentheses(expr: string): boolean {
    let count = 0;
    for (const char of expr) {
      if (char === '(') count++;
      if (char === ')') count--;
      if (count < 0) return false;
    }
    return count === 0;
  }

  /**
   * Recursive descent parser - handles order of operations correctly
   */
  private static parseExpression(expr: string): number {
    const tokens = this.tokenize(expr);
    let index = 0;

    const parseNumber = (): number => {
      const token = tokens[index++];
      
      if (token === '(') {
        const result = parseAddSub();
        index++; // skip ')'
        return result;
      }
      
      if (token === '-') {
        return -parseNumber();
      }
      
      return parseFloat(token);
    };

    const parseMulDiv = (): number => {
      let left = parseNumber();

      while (index < tokens.length) {
        const op = tokens[index];
        if (op !== '*' && op !== '/') break;
        
        index++;
        const right = parseNumber();
        
        if (op === '*') {
          left *= right;
        } else {
          if (right === 0) throw new Error('Division by zero');
          left /= right;
        }
      }

      return left;
    };

    const parseAddSub = (): number => {
      let left = parseMulDiv();

      while (index < tokens.length) {
        const op = tokens[index];
        if (op !== '+' && op !== '-') break;
        
        index++;
        const right = parseMulDiv();
        
        if (op === '+') {
          left += right;
        } else {
          left -= right;
        }
      }

      return left;
    };

    return parseAddSub();
  }

  /**
   * Tokenize expression into numbers and operators
   */
  private static tokenize(expr: string): string[] {
    const tokens: string[] = [];
    let current = '';

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];

      if ('0123456789.'.includes(char)) {
        current += char;
      } else {
        if (current) {
          tokens.push(current);
          current = '';
        }
        if (char !== ' ') {
          tokens.push(char);
        }
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }
}

/**
 * Convenience function for quick calculations
 */
export function safeCalculate(expression: string): number | null {
  return SafeCalculator.calculate(expression);
}

/**
 * Format calculation result to specified decimal places
 */
export function formatCalculation(expression: string, decimals: number = 2): string {
  const result = safeCalculate(expression);
  return result !== null ? result.toFixed(decimals) : '';
}
