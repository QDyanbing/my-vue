import { activeSub } from './effect';
import { link, propagate, type Link } from './system';

class Dep {
  // 订阅者链表的头节点
  subs: Link | undefined;
  // 订阅者链表的尾节点
  subsTail: Link | undefined;

  constructor() {}
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

export const track = (target: object, key: string | symbol) => {
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

export const trigger = (target: object, key: string | symbol) => {
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
