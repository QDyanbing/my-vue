import { hasChanged, isObject } from '@vue/shared';
import { link, propagate } from './system';
import { activeSub } from './effect';
import type { Link } from './system';

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

const mutableHandlers: ProxyHandler<object> = {
  get(target, key, receiver) {
    // target = { a: 1, b: 2 }
    // 收集依赖，绑定target中的key和sub之间的依赖关系
    track(target, key);

    // receiver 用来保证访问器里面的 this 指向代理对象；
    return Reflect.get(target, key, receiver);
  },
  set(target, key, newValue, receiver) {
    const oldVal = target[key];

    // 先完成赋值操作
    const res = Reflect.set(target, key, newValue, receiver);

    if (hasChanged(newValue, oldVal)) {
      // 如果旧值和新值不相等，则触发依赖更新
      trigger(target, key);
    }

    return res;
  },
};

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

/**
 * 绑定 target 和 key 关联的所有 Dep
 * targetMap 的结构：
 * target = { a: 1, b: 2 }
 * targetMap = {
 *   [target]: {
 *     a: Dep,
 *     b: Dep,
 *   },
 * }
 */
const targetMap = new WeakMap<object, Map<string | symbol, any>>();

const track = (target: object, key: string | symbol) => {
  // 如果当前没有活跃的 effect，则直接返回
  if (!activeSub) return;
  // 获取 target 对应的 depsMap
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    // 如果没有 depsMap，则说明是第一次收集依赖；那就创建一个新的来保存target和depsMap之间的依赖关系；

    depsMap = new Map();
    targetMap.set(target, depsMap);
  }

  // 获取 key 对应的 dep
  let dep = depsMap.get(key);
  if (!dep) {
    // 如果没有 dep，则说明是第一次收集依赖；那就创建一个新的来保存key和dep之间的依赖关系；
    dep = new Dep();
    depsMap.set(key, dep);
  }

  // 绑定dep和sub的关联关系
  link(dep, activeSub);
};

const trigger = (target: object, key: string | symbol) => {
  // 获取 target 对应的 depsMap
  const depsMap = targetMap.get(target);
  // 如果没有 depsMap，则说明没有收集过依赖，直接返回
  if (!depsMap) return;

  // 获取 key 对应的 dep
  const dep = depsMap.get(key);
  // 如果没有 dep，则说明没有收集过依赖，直接返回
  if (!dep) return;

  // 触发依赖更新
  propagate(dep.subs);
};

class Dep {
  // 订阅者链表的头节点
  subs: Link | undefined;
  // 订阅者链表的尾节点
  subsTail: Link | undefined;

  constructor() {}
}

// 判断 target 是不是响应式，只要在reactiveSet中就是响应式；
export function isReactive(target: any) {
  return reactiveSet.has(target);
}
