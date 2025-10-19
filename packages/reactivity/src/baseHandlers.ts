import { hasChanged, isObject } from '@vue/shared';
import { track, trigger } from './dep';
import { isRef } from './ref';
import { reactive } from './reactive';

/**
 * 处理对象的响应式问题；
 */
export const mutableHandlers: ProxyHandler<object> = {
  get(target, key, receiver) {
    // target = { a: 1, b: 2 }
    // 收集依赖，绑定target中的key和sub之间的依赖关系
    track(target, key);

    // receiver 用来保证访问器里面的 this 指向代理对象；
    const res = Reflect.get(target, key, receiver);

    if (isRef(res)) {
      // target = {a:ref(0)}
      // 如果target.a 是一个 ref，那么就直接把值给它，不要让它 .value
      return res.value;
    }

    if (isObject(res)) {
      // target = {a:{b:1}};处理对象的嵌套响应式问题；

      return reactive(res);
    }

    return res;
  },
  set(target, key, newValue, receiver) {
    const oldVal = target[key];

    // 先完成赋值操作
    const res = Reflect.set(target, key, newValue, receiver);

    if (isRef(oldVal) && !isRef(newValue)) {
      // 旧值是 ref，新值不是 ref，则需要对旧值的 .value 进行赋值；
      // 旧值是 ref，新值是 ref，直接跳过即可；
      oldVal.value = newValue;

      // 这里之所以return是因为：已经在ref中完成trigger，如果不return会多次触发；
      return res;
    }

    if (hasChanged(newValue, oldVal)) {
      // 如果旧值和新值不相等，则触发依赖更新
      trigger(target, key);
    }

    return res;
  },
};
