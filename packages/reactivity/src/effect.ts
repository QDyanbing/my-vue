import { startTrack, endTrack } from './system';
import type { Link, Sub } from './system';

// @TODO：这里的类型有点麻烦暂时没改
export interface DebuggerOptions {
  onTrack?: (event: unknown) => void;
  onTrigger?: (event: unknown) => void;
}

export type EffectScheduler = (...args: any[]) => any;

export interface ReactiveEffectOptions extends DebuggerOptions {
  scheduler?: EffectScheduler;
  allowRecurse?: boolean;
  onStop?: () => void;
}

// 用来保存当前正在执行的 effect
export let activeSub = null;

export function setActiveSub(sub: any) {
  activeSub = sub;
}

// Effect 的实现类
export class ReactiveEffect implements Sub {
  // 依赖项链表的头节点 ref1 -> ref2 -> ref3
  deps: Link | undefined;
  // 依赖项链表的尾节点
  depsTail: Link | undefined;
  // 是否正在追踪依赖,解决循环依赖问题
  tracking: boolean = false;

  dirty: boolean = false;

  constructor(public fn: Function) {}

  run() {
    /**
     * 先将当前的 effect 保存起来，用来处理嵌套的逻辑;
     * effect(()=>{
     *  effect(()=>{
     *    console.log('effect2');
     *  });
     *  console.log('effect1');
     * });
     *
     */
    const prevSub = activeSub;
    // 将当前的 effect 设置为活跃的 effect
    setActiveSub(this);

    // 开始追踪依赖
    startTrack(this);

    try {
      return this.fn();
    } finally {
      // 结束追踪依赖
      endTrack(this);

      // 执行完成后，恢复之前的 effect，这样就可以处理嵌套的逻辑了
      setActiveSub(prevSub);
    }
  }

  /**
   * 通知更新的方法，如果依赖的数据发生了变化，会调用这个函数
   */
  notify() {
    this.scheduler();
  }

  /**
   * 默认调用 run，如果用户传了，那以用户的为主，实例属性的优先级，由于原型属性
   */
  scheduler() {
    this.run();
  }
}

export const effect = (fn: Function, options?: ReactiveEffectOptions) => {
  const e = new ReactiveEffect(fn);
  Object.assign(e, options);
  e.run();
  /**
   * 绑定函数的 this
   */
  const runner = e.run.bind(e);
  /**
   * 把 effect 的实例，放到函数属性中
   */
  runner.effect = e;

  return runner;
};
