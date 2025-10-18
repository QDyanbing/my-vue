/**
 * 依赖项
 */
export interface Dep {
  // 订阅者链表的头节点
  subs: Link | undefined;
  // 订阅者链表的尾节点
  subsTail: Link | undefined;
}

/**
 * 订阅者
 */
export interface Sub {
  // 依赖项链表的头节点
  deps: Link | undefined;
  // 依赖项链表的尾节点
  depsTail: Link | undefined;
}

/**
 * 链表节点
 */
export interface Link {
  // 订阅者
  sub: Sub;
  // 下一个订阅者节点
  nextSub: Link | undefined;
  // 上一个订阅者节点
  prevSub: Link | undefined;
  // 依赖项
  dep: Dep;
  // 下一个依赖项节点
  nextDep: Link | undefined;
}

/**
 * 链接链表关系
 * @param dep - 依赖项 ref
 * @param sub - 订阅者 effect
 */
export function link(dep: Dep, sub: Sub) {
  /**
   * 尝试复用链表节点:如果不复用，会造成每次调用effect时，都会创建新的链表节点，effect多次执行；
   * 分两种情况：
   * 1. 如果头节点有，尾节点没有，那么尝试着复用头节点
   * 2. 如果尾节点还有 nextDep，尝试复用尾节点的 nextDep
   */
  // effect 链表的尾节点
  const currentDep = sub.depsTail;
  // effect 链表的下一个节点，如果尾节点有，那就用尾节点的 nextDep，如果尾节点没有，那就用头节点
  const nextDep = currentDep === undefined ? sub.deps : currentDep.nextDep;
  // 如果下一个节点存在，并且下一个节点的订阅者是当前的订阅者，那么就复用下一个节点
  if (nextDep && nextDep.sub === sub) {
    sub.depsTail = nextDep;
    return;
  }

  // 构建新的链表节点
  const newLink: Link = {
    sub,
    dep,
    nextSub: undefined,
    prevSub: undefined,
    nextDep: undefined,
  };

  /**
   * 关联链表关系，分两种情况-这里是给依赖项关联订阅者 ref => effect1 => effect2 => effect3
   * 1. 尾节点有，那就往尾节点后面加
   * 2. 如果尾节点没有，则表示第一次关联，那就往头节点加，头尾相同
   */
  if (dep.subsTail) {
    dep.subsTail.nextSub = newLink;
    newLink.prevSub = dep.subsTail;
    dep.subsTail = newLink;
  } else {
    dep.subs = newLink;
    dep.subsTail = newLink;
  }

  /**
   * 关联链表关系，分两种情况-这里是给订阅者关联依赖项 effect1 => ref1 => ref2 => ref3
   * 1. 尾节点有，那就往尾节点后面加
   * 2. 如果尾节点没有，则表示第一次关联，那就往头节点加，头尾相同
   */
  if (sub.depsTail) {
    sub.depsTail.nextDep = newLink;
    sub.depsTail = newLink;
  } else {
    sub.deps = newLink;
    sub.depsTail = newLink;
  }
}

/**
 * 传播更新的函数
 * @param subs
 */
export function propagate(subs: Link) {
  let sub = subs;
  let queuedEffects = [];

  while (sub) {
    queuedEffects.push(sub.sub);
    sub = sub.nextSub;
  }

  queuedEffects.forEach(effect => effect.notify?.());
}
