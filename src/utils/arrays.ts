/**
 * Type-safe array element access utilities
 */
export const Arrays = {
  /**
   * Gets the first element of an array in a type-safe manner
   * @param array The array to access
   * @returns The first element or undefined if array is empty
   */
  first<T>(array: T[]): T | undefined {
    return array.length > 0 ? array[0] : undefined;
  },

  /**
   * Gets the last element of an array in a type-safe manner
   * @param array The array to access
   * @returns The last element or undefined if array is empty
   */
  last<T>(array: T[]): T | undefined {
    return array.length > 0 ? array[array.length - 1] : undefined;
  },

  /**
   * Gets an element at a specific index with type safety
   * @param array The array to access
   * @param index The index to access
   * @returns The element at the index or undefined if index is out of bounds
   */
  at<T>(array: T[], index: number): T | undefined {
    return index >= 0 && index < array.length ? array[index] : undefined;
  },
};
