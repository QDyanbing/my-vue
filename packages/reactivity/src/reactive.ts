import { isObject } from '@vue/shared';
import { mutableHandlers } from './baseHandlers';

// 保存所有使用 reactive 创建出来的响应式对象
// [Proxy1, Proxy2]
const reactiveSet = new WeakSet<object>();

// 保存 target 和 响应式对象之间的关联关系
// reactiveMap = {
//   [target]: Proxy,
// }
const reactiveMap = new WeakMap<object, object>();

export function reactive(target: object) {
  return createReactiveObject(target);
}

export function createReactiveObject(target: object) {
  // 如果 target 不是对象，则直接返回
  if (!isObject(target)) return target;

  // 判断 target 是不是在 reactiveSet 里在则直接返回；
  if (reactiveSet.has(target)) return target;

  const existingProxy = reactiveMap.get(target);
  if (existingProxy) return existingProxy;

  const proxy = new Proxy(target, mutableHandlers);

  // 保存代理对象，避免重复创建代理对象；
  reactiveSet.add(proxy);
  // 缓存代理对象，避免重复创建代理对象；
  reactiveMap.set(target, proxy);

  // 返回代理对象；
  return proxy;
}

// 判断 target 是不是响应式，只要在reactiveSet中就是响应式；
export function isReactive(target: any) {
  return reactiveSet.has(target);
}
