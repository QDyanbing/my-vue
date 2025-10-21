import { isRef, type Ref } from './ref';
import type { ComputedRef } from './computed';
import { ReactiveEffect } from './effect';

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
  const { immediate } = options;

  let getter: () => any;

  if (isRef(source)) {
    getter = () => source.value;
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

  return () => {
    effect.stop();
  };
}
