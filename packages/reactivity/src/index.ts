import { isObject } from '@vue/shared';

isObject({});

export const reactive = (a, b) => {
  return a + b;
};
