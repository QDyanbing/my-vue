import { hasChanged, isObject } from '@vue/shared';
import { activeSub } from './effect';
import { link, propagate } from './system';
import type { Dependency, Link } from './system';
import { reactive } from './reactive';

export enum ReactiveFlags {
  IS_REF = '__v_isRef',
}

// Ref 的实现类
class RefImpl implements Dependency {
  // 保存实际的值 ref(0) -> 0
  _value: any;
  // 标记为 Ref，主要用于判断是否是 Ref 对象
  [ReactiveFlags.IS_REF]: true = true;

  /**
   * 订阅者链表的头节点，理解为我们将的 head effect1 -> effect2 -> effect3
   */
  subs: Link | undefined;

  /**
   * 订阅者链表的尾节点，理解为我们讲的 tail
   */
  subsTail: Link | undefined;

  constructor(value: any) {
    // 如果 value 是对象，则转换为响应式对象；
    this._value = isObject(value) ? reactive(value) : value;
  }

  get value() {
    // 当读取 value 时，收集依赖
    trackRef(this);
    return this._value;
  }

  set value(newValue: any) {
    if (hasChanged(newValue, this._value)) {
      this._value = isObject(newValue) ? reactive(newValue) : newValue;

      // 当设置 value 时，触发更新，通知订阅者更新
      triggerRef(this);
    }
  }
}

export const ref = (value: any): RefImpl => {
  return new RefImpl(value);
};

/**
 * 判断是否是 Ref 对象
 * @param value - 要判断的值
 * @returns {boolean} - 是否是 Ref 对象
 */
export function isRef(value: any): boolean {
  return !!(value && value[ReactiveFlags.IS_REF]);
}

/**
 * 收集依赖，建立 ref 和 effect 之间的链表关系
 * @param dep - 要收集依赖的 ref 对象
 */
export function trackRef(dep: RefImpl) {
  if (activeSub) {
    link(dep, activeSub);
  }
}

/**
 * 触发 ref 关联的 effect 重新执行
 * @param dep - 要触发更新的 ref 对象
 */
export function triggerRef(dep: RefImpl) {
  if (dep.subs) {
    propagate(dep.subs);
  }
}
