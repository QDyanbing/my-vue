import { hasChanged, isObject } from '@vue/shared';
import { track, trigger } from './dep';
import { isRef } from './ref';
import { reactive } from './reactive';

export const mutableHandlers: ProxyHandler<object> = {
  get(target, key, receiver) {
    // target = { a: 1, b: 2 }
    // 收集依赖，绑定target中的key和sub之间的依赖关系
    track(target, key);

    const res = Reflect.get(target, key, receiver);

    if (isRef(res)) {
      /**
       * target = {a:ref(0)}
       * 如果target.a 是一个 ref，那么就直接把值给它，不要让它 .value
       */
      return res.value;
    }

    if (isObject(res)) {
      // 处理对象的嵌套响应式问题；
      return reactive(res);
    }

    // receiver 用来保证访问器里面的 this 指向代理对象；
    return res;
  },
  set(target, key, newValue, receiver) {
    const oldVal = target[key];

    // 先完成赋值操作
    const res = Reflect.set(target, key, newValue, receiver);

    if (isRef(oldVal) && !isRef(newValue)) {
      oldVal.value = newValue;

      return res;
    }

    if (hasChanged(newValue, oldVal)) {
      // 如果旧值和新值不相等，则触发依赖更新
      trigger(target, key);
    }

    return res;
  },
};
