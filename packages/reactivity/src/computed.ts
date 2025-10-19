import { hasChanged, isFunction } from '@vue/shared';
import { ReactiveFlags } from './ref';
import { Dependency, endTrack, link, Link, startTrack, Sub } from './system';
import { activeSub, setActiveSub } from './effect';

export type ComputedGetter<T> = (oldValue?: T) => T;
export type ComputedSetter<T> = (newValue: T) => void;

export interface WritableComputedOptions<T, S = T> {
  get: ComputedGetter<T>;
  set: ComputedSetter<S>;
}

/**
 * 计算属性的实现类,计算属性即是 dep，也是 sub；
 * 当computed内函数执行收集依赖时，会收集 computed 作为 sub；
 * 当computed的值被effect访问时，会作为effect的dep（这个时候effect为sub）
 */
class ComputedRefImpl implements Dependency, Sub {
  // computed 也是一个ref，通过 isRef 也返回true；
  [ReactiveFlags.IS_REF] = true;
  // 保存 fn 的返回值
  _value: any;
  // 作为 dep，要关联 subs，等我的值更新了，我要通知它们重新执行；
  subs: Link;
  subsTail: Link;
  // 作为 sub，我要知道哪些 dep，被我收集了
  deps: Link;
  depsTail: Link;

  tracking: boolean = false;
  // 计算属性，脏不脏，如果 dirty 为 true，表示计算属性是脏的，get value 的时候，需要执行 update
  dirty: boolean = true;

  constructor(
    public fn: () => any,
    private setter: (value: any) => void,
  ) {}

  get value() {
    if (this.dirty) {
      // 如果计算属性脏了，执行 update
      this.update();
    }

    // 作为 dep 要和 sub 做关联关系，收集依赖
    if (activeSub) {
      link(this, activeSub);
    }

    return this._value;
  }

  set value(newValue: any) {
    if (this.setter) {
      this.setter(newValue);
    } else {
      console.warn('Write operation failed: computed value is readonly');
    }
  }

  update() {
    /**
     * 实现 sub 的功能，为了在 执行 fn 期间，收集 fn 执行过程中访问到的响应式数据
     * 建立 dep 和 sub 之间的关联关系
     */
    // 先将当前的 effect 保存起来，用来处理嵌套的逻辑
    const prevSub = activeSub;

    // 每次执行 fn 之前，把 this 放到 activeSub 上面
    setActiveSub(this);
    startTrack(this);

    try {
      // 拿到老值
      const oldValue = this._value;
      // 拿到新的值
      this._value = this.fn();

      // 如果值发生了变化，就返回 true，否则就是 false
      return hasChanged(this._value, oldValue);
    } finally {
      endTrack(this);
      // 执行完成后，恢复之前的 effect
      setActiveSub(prevSub);
    }
  }
}

/**
 * 计算属性
 * @param getterOrOptions 有可能是一个 函数，也有可能是一个对象，对象的话里面有 get 和 set 属性
 * @returns {ComputedRefImpl}
 */
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
): ComputedRefImpl {
  let getter: ComputedGetter<T>;
  let setter: ComputedSetter<T> | undefined;

  if (isFunction(getterOrOptions)) {
    // const c = computed(()=>{})
    getter = getterOrOptions;
  } else {
    /**
     * const c = computed({
     *   get(){},
     *   set(){}
     * })
     */
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }

  return new ComputedRefImpl(getter, setter);
}
