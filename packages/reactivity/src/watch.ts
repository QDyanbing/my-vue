import { isRef, type Ref } from './ref';
import type { ComputedRef } from './computed';
import { ReactiveEffect } from './effect';
import { isObject } from '@vue/shared';

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
export function watch(source: any, cb?: Function, options: any = {}) {
  const { immediate, once, deep } = options;

  if (once) {
    // 如果once为true，则需要包装一下回调函数，在回调函数执行后，自动调用cleanup；
    let _cb = cb;
    cb = (...args: any[]) => {
      _cb?.(...args);
      cleanup();
    };
  }

  let getter: () => any;

  if (isRef(source)) {
    getter = () => source.value;
  }

  if (deep) {
    const baseGetter = getter;

    getter = () => traverse(baseGetter());
  }

  let oldValue: any;

  function job() {
    //  执行 effect.run 拿到getter的返回值，不能直接执行getter，因为要收集依赖；
    const newValue = effect.run();

    // 执行用户传入的回调函数，把新值和旧值传给用户；
    if (cb) {
      cb(newValue, oldValue);
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

  function cleanup() {
    effect.stop();
  }

  return cleanup;
}

function traverse(value: any, seen: Set<any> = new Set()) {
  // 不是对象，直接返回；
  if (!isObject(value)) return value;
  // 如果已经遍历过，直接返回；
  if (seen.has(value)) return value;

  // 添加到seen中，避免重复遍历；
  seen.add(value);
  for (const key in value) {
    traverse(value[key], seen);
  }

  return value;
}
