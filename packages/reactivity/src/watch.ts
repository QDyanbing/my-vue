import { isRef, type Ref } from './ref';
import type { ComputedRef } from './computed';
import { ReactiveEffect } from './effect';
import { isFunction, isObject } from '@vue/shared';
import { isReactive } from './reactive';

export type WatchSource<T = any> = Ref<T, any> | ComputedRef<T> | (() => T);

export type OnCleanup = (cleanupFn: () => void) => void;

export type WatchEffect = (onCleanup: OnCleanup) => void;

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup,
) => any;

export type WatchStopHandle = () => void;

export interface WatchHandle extends WatchStopHandle {
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/**
 * watch 的实现原理：就是依赖effect的scheduler；
 */
export function watch(source: any, cb?: any, options: any = {}) {
  let { immediate, once, deep } = options;

  if (once) {
    // 如果once为true，则需要包装一下回调函数，在回调函数执行后，自动调用cleanup；
    let _cb = cb;
    cb = (...args) => {
      _cb?.(...args);
      stop();
    };
  }

  let getter: () => any;

  if (isRef(source)) {
    getter = () => source.value;
  } else if (isReactive(source)) {
    getter = () => source;
    // 如果deep没传，则默认深度为true；如果传了，则深度为传入的值；
    deep = !deep ? true : deep;
  } else if (isFunction(source)) {
    getter = source;
  }

  if (deep) {
    const baseGetter = getter;

    // 处理deep是数字的情况，如果是true，则深度为Infinity，如果是数字，则深度为数字；
    const depth = deep === true ? Infinity : deep;

    getter = () => traverse(baseGetter(), depth);
  }

  let oldValue: any;

  let cleanup: (() => void) | undefined;

  function onCleanup(cb?: () => void) {
    cleanup = cb;
  }

  function job() {
    if (cleanup) {
      // 清理上一次的副作用，如果有就执行，执行完后，把cleanup设置为null；
      cleanup();
      cleanup = null;
    }

    //  执行 effect.run 拿到getter的返回值，不能直接执行getter，因为要收集依赖；
    const newValue = effect.run();

    // 执行用户传入的回调函数，把新值和旧值传给用户；
    if (cb) {
      cb(newValue, oldValue, onCleanup);
    }

    // 本次的最新值就是下次的旧值；
    oldValue = newValue;
  }

  const effect = new ReactiveEffect(getter);

  effect.scheduler = job;

  if (immediate) {
    // 立即执行一次，因为立即执行一次，所以不需要等到依赖变化后才执行；
    job();
  } else {
    oldValue = effect.run();
  }

  function stop() {
    effect.stop();
  }

  return stop;
}

function traverse(value: any, depth: number, seen: Set<any> = new Set()) {
  // 不是对象，或者深度为0，直接返回；
  if (!isObject(value) || depth <= 0) return value;
  // 如果已经遍历过，直接返回；
  if (seen.has(value)) return value;

  // 添加到seen中，避免重复遍历；
  seen.add(value);
  for (const key in value) {
    traverse(value[key], depth - 1, seen);
  }

  return value;
}
