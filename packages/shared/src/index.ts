export const isObject = (val: unknown): boolean => {
  return val !== null && typeof val === 'object';
};

// compare whether a value has changed, accounting for NaN.
export const hasChanged = (value: any, oldValue: any): boolean => !Object.is(value, oldValue);
