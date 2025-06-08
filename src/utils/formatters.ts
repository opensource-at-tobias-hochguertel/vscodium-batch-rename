/**
 * Safely converts any value to a string for use in error messages and logs.
 * Handles all JavaScript data types with proper formatting.
 *
 * @param value Any value to convert to string
 * @returns Human-readable string representation
 */
export function formatErrorValue(value: unknown): string {
  // Handle null and undefined
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  // Handle Error objects specially to extract the message
  if (value instanceof Error) {
    if (value.stack) {
      // Extract the first line of the stack trace for conciseness
      const firstLine = value.stack.split("\n")[0];
      return `${value.message} (${firstLine})`;
    }
    return value.message;
  }

  // Handle primitive types directly
  if (typeof value === "string") return value;
  if (typeof value === "number")
    return Number.isFinite(value) ? value.toString() : `${value}`;
  if (typeof value === "boolean") return value.toString();
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") {
    return `[Function: ${value.name || "anonymous"}]`;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    try {
      // Limit array representation to avoid overwhelming logs
      const maxItems = 5;
      const items = value
        .slice(0, maxItems)
        .map((item) => formatErrorValue(item));
      const suffix =
        value.length > maxItems
          ? `, ... (${value.length - maxItems} more items)`
          : "";
      return `[${items.join(", ")}${suffix}]`;
    } catch {
      return `[Array(${value.length})]`;
    }
  }

  // Handle objects - properly typed for ESLint compliance
  if (typeof value === "object") {
    // We've already handled null above
    try {
      // Use JSON.stringify with cycle detection
      const seen = new WeakSet<object>();
      const replacer = (_key: string, val: unknown): unknown => {
        if (typeof val === "object" && val !== null) {
          // No type assertion needed - TypeScript knows non-null object is an object
          if (seen.has(val)) {
            return "[Circular Reference]";
          }
          seen.add(val);
        }
        return val;
      };

      return JSON.stringify(value, replacer, 2);
    } catch {
      // If JSON.stringify fails, create a property list
      try {
        const constructorName = value.constructor?.name || "Object";

        // Type assertions not needed with proper type narrowing
        const entries = Object.entries(value)
          .slice(0, 10) // Limit to first 10 properties
          .map(([k, v]) => `${k}: ${typeof v}`);

        const suffix =
          Object.keys(value).length > 10
            ? `, ... (${Object.keys(value).length - 10} more properties)`
            : "";

        return `[${constructorName}: {${entries.join(", ")}${suffix}}]`;
      } catch {
        return "[Object]";
      }
    }
  }

  // This is unreachable in theory since we've handled all possible types,
  // but TypeScript doesn't know that, so we need a fallback
  return `[Unknown Type: ${typeof value}]`;
}
