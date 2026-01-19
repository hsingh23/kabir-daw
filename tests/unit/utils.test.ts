import { describe, it, expect } from 'vitest';
import { moveItem } from '../../services/utils';

describe('utils', () => {
  describe('moveItem', () => {
    it('moves an item to a new index', () => {
      const arr = ['a', 'b', 'c', 'd'];
      // Move 'a' (0) to index 2 (between b and c? No, splice insert at index)
      // Array: a, b, c, d
      // remove 'a': b, c, d
      // insert 'a' at 2: b, c, a, d
      const result = moveItem(arr, 0, 2);
      expect(result).toEqual(['b', 'c', 'a', 'd']);
    });

    it('moves an item backwards', () => {
      const arr = ['a', 'b', 'c', 'd'];
      // Move 'c' (2) to 0
      // remove 'c': a, b, d
      // insert at 0: c, a, b, d
      const result = moveItem(arr, 2, 0);
      expect(result).toEqual(['c', 'a', 'b', 'd']);
    });

    it('handles invalid indices gracefully', () => {
      const arr = ['a', 'b'];
      const result = moveItem(arr, -1, 5);
      expect(result).toEqual(['a', 'b']);
      expect(result).not.toBe(arr); // Should return new array instance even if no change
    });
  });
});