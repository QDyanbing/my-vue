import { isObject } from '@vue/shared';
import { mutableHandlers } from './baseHandlers';

export function reactive(target: object) {
  return createReactiveObject(target);
}

/**
 * 缓存对象的代理对象，避免重复创建代理对象
 * target = { a: 1, b: 2 }
 * reactiveMap = {
 *   [target]: Proxy,
 * }
 */
const reactiveMap = new WeakMap<object, object>();

/**
 * 保存
 * target = { a: 1, b: 2 }
 * reactiveSet = [Proxy, Proxy]
 */
const reactiveSet = new WeakSet<object>();

export function createReactiveObject(target: object) {
  // 如果 target 不是对象，则直接返回
  if (!isObject(target)) return target;

  // 判断 target 是不是在 reactiveSet 里在则直接返回；
  if (reactiveSet.has(target)) return target;

  const existingProxy = reactiveMap.get(target);
  if (existingProxy) return existingProxy;

  const proxy = new Proxy(target, mutableHandlers);

  reactiveMap.set(target, proxy);
  reactiveSet.add(proxy);

  return proxy;
}

// 判断 target 是不是响应式，只要在reactiveSet中就是响应式；
export function isReactive(target: any) {
  return reactiveSet.has(target);
}
