/**
 * 依赖项
 */
export interface Dependency {
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
  tracking: boolean;
  dirty: boolean;
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
  dep: Dependency;
  // 下一个依赖项节点
  nextDep: Link | undefined;
}

// 保存已经被清理掉的节点，留着复用
let linkPool: Link;

/**
 * 链接链表关系
 * @param dep - 依赖项 ref
 * @param sub - 订阅者 effect
 */
export function link(dep: Dependency, sub: Sub) {
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
  // 如果下一个节点存在，并且下一个节点的依赖项是当前的依赖项，那么就复用下一个节点
  // 这里实际上比较的是两个ref是不是一致的
  // effect链表的节点保存的是所使用的ref串联起来的链表；nextDep.dep 是从 effect链表中获取的ref
  // dep是当前调用getter得到的ref
  // 如果两者一致则证明依赖已经收集过了，直接返回；当前节点比较后要把尾节点指向nextDep（即节点后移，才能继续比较下一个）；
  if (nextDep && nextDep.dep === dep) {
    sub.depsTail = nextDep;
    return;
  }

  /**
   * computed这里
   * @TODO 源码这里不是这样做的，源码是时间换空间；目前的处理方式是空间换时间；这里后面也可以按官方的尝试一下；
   * 源码是 如果dep和sub建立过关联关系，则直接返回；否则创建新节点；
   */

  let newLink: Link;
  // 查看 linkPool 是否有可用的节点
  if (linkPool) {
    // 如果有就取一个节点复用
    newLink = linkPool;
    linkPool = linkPool.nextDep;
    newLink.nextDep = nextDep;
    newLink.dep = dep;
    newLink.sub = sub;
  } else {
    // 如果没有，就创建新的
    newLink = {
      sub,
      dep, // 在第二次调用effect做对比时如果节点没有被复用会创建新节点，在这里可以把没比对成功的节点记录在新节点的next上，来方便后面回收这个节点
      nextDep,
      nextSub: undefined,
      prevSub: undefined,
    };
  }

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

function processComputedUpdate(sub: any) {
  /**
   * 更新计算属性
   * 1. 调用 update
   * 2. 通知 subs 链表上所有的 sub，重新执行
   */
  if (sub.subs && sub.update()) {
    // sub.update 返回 true，表示值发生了变化
    propagate(sub.subs);
  }
}

/**
 * 传播更新的函数
 * @param subs
 */
export function propagate(subs: Link) {
  let link = subs;
  let queuedEffect = [];
  while (link) {
    const sub = link.sub;
    if (!sub.tracking && !sub.dirty) {
      /**
       * @TODO 源码这里是没有建立关联关系，我们的做法是空间换时间；建立了重复关系，但判断了没有执行过；这里后面也可以按官方的尝试一下；
       */
      // 不管effect还是computed都设置为脏的，一旦重新执行就会走这边；走这边到这里就变成了脏的；
      // 当dirty为false时，才会进来；下一个节点还是脏的，就进不来了；当追踪完了就不脏了；
      sub.dirty = true;
      if ('update' in sub) {
        processComputedUpdate(sub);
      } else {
        queuedEffect.push(sub);
      }
    }
    link = link.nextSub;
  }

  queuedEffect.forEach(effect => effect.notify());
}

/**
 * 开始追踪依赖，将depsTail，尾节点设置成 undefined
 * @param sub
 */
export function startTrack(sub: Sub) {
  // 设置当前 effect 正在追踪依赖
  sub.tracking = true;
  // 将依赖项链表的尾节点设置为 undefined
  // 这里这么做的主要原因是，为了判断出当前是否是第一次执行，第一次执行是头尾都为 undefined；非第一次执行时把尾节点指向undefined
  sub.depsTail = undefined;
}

/**
 * 结束追踪，找到需要清理的依赖，断开关联关系
 * @param sub
 */
export function endTrack(sub: Sub) {
  // 设置当前 effect 不再追踪依赖
  sub.tracking = false;
  const depsTail = sub.depsTail;
  // 追踪完了，不脏了
  sub.dirty = false;

  /**
   * 如果 depsTail 有，并且 depsTail 还有 nextDep ，我们应该把它们的依赖关系清理掉
   * 如果 depsTail 没有，并且头节点有，那就把所有的都清理掉
   */
  if (depsTail) {
    if (depsTail.nextDep) {
      clearTracking(depsTail.nextDep);
      // 当前节点删除后，把当前节点的下一个节点指向 undefined
      depsTail.nextDep = undefined;
    }
  } else if (sub.deps) {
    clearTracking(sub.deps);
    // 当前节点删除后，把当前节点的依赖项指向 undefined
    sub.deps = undefined;
  }
}

/**
 * 清理依赖关系
 * @param link
 */
function clearTracking(link: Link) {
  // 这里是双向链表删除指定节点
  while (link) {
    const { prevSub, nextSub, nextDep, dep } = link;

    if (prevSub) {
      // 当前节点有上一个节点，那就把上一个节点的下一个节点指向当前节点的下一个节点
      prevSub.nextSub = nextSub;
      // 当前节点删除后，把当前节点的下一个节点指向 undefined
      link.nextSub = undefined;
    } else {
      // 当前节点没有上一个节点，那就是头节点，那就把 dep.subs 指向当前节点的下一个节点
      dep.subs = nextSub;
    }

    if (nextSub) {
      // 当前节点有下一个节点，那就把下一个节点的上一个节点指向当前节点的上一个节点
      nextSub.prevSub = prevSub;
      // 当前节点删除后，把当前节点的上一个节点指向 undefined
      link.prevSub = undefined;
    } else {
      // 当前节点没有下一个节点，那就是尾节点，那就把 dep.subsTail 只想上一个节点
      dep.subsTail = prevSub;
    }

    // 当前节点删除后，把当前节点的依赖项指向 undefined
    link.dep = undefined;
    // 当前节点删除后，把当前节点的订阅者指向 undefined
    link.sub = undefined;

    // 把不要的节点保存在  linkPool 中，留着复用；这样可以避免每次都创建新的节点，提高性能；
    link.nextDep = linkPool;
    linkPool = link;

    // 当前节点删除后，把当前节点的下一个节点指向当前节点的下一个节点
    link = nextDep;
  }
}
