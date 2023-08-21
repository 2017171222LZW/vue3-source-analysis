import {
  isArray,
  isFunction,
  isString,
  isObject,
  EMPTY_ARR,
  extend,
  normalizeClass,
  normalizeStyle,
  PatchFlags,
  ShapeFlags,
  SlotFlags,
  isOn
} from '@vue/shared'
import {
  ComponentInternalInstance,
  Data,
  ConcreteComponent,
  ClassComponent,
  Component,
  isClassComponent
} from './component'
import { RawSlots } from './componentSlots'
import { isProxy, Ref, toRaw, ReactiveFlags, isRef } from '@vue/reactivity'
import { AppContext } from './apiCreateApp'
import {
  Suspense,
  SuspenseImpl,
  isSuspense,
  SuspenseBoundary
} from './components/Suspense'
import { DirectiveBinding } from './directives'
import { TransitionHooks } from './components/BaseTransition'
import { warn } from './warning'
import { Teleport, TeleportImpl, isTeleport } from './components/Teleport'
import {
  currentRenderingInstance,
  currentScopeId
} from './componentRenderContext'
import { RendererNode, RendererElement } from './renderer'
import { NULL_DYNAMIC_COMPONENT } from './helpers/resolveAssets'
import { hmrDirtyComponents } from './hmr'
import { convertLegacyComponent } from './compat/component'
import { convertLegacyVModelProps } from './compat/componentVModel'
import { defineLegacyVNodeProperties } from './compat/renderFn'
import { callWithAsyncErrorHandling, ErrorCodes } from './errorHandling'
import { ComponentPublicInstance } from './componentPublicInstance'

export const Fragment = Symbol.for('v-fgt') as any as {
  __isFragment: true
  new (): {
    $props: VNodeProps
  }
}
export const Text = Symbol.for('v-txt')
export const Comment = Symbol.for('v-cmt')
export const Static = Symbol.for('v-stc')

export type VNodeTypes = // 虚拟结点类型

    | string // 字符串
    | VNode // 虚拟结点
    | Component // 组件结点
    | typeof Text // 文本结点
    | typeof Static // 静态结点
    | typeof Comment // 注释结点
    | typeof Fragment // 片段节点，用于在模板中包含多个根级别的节点
    | typeof Teleport // 传送门节点，用于将子节点渲染到DOM树中的不同位置
    | typeof TeleportImpl // 传送门实现类
    | typeof Suspense // Suspense节点类型
    | typeof SuspenseImpl // Suspense实现类类型

export type VNodeRef = // 虚拟结点引用类型

    | string // 字符串
    | Ref // 引用类型
    | ((
        ref: Element | ComponentPublicInstance | null,
        refs: Record<string, any>
      ) => void) // 一个回调函数，接收两个参数：ref和refs

export type VNodeNormalizedRefAtom = {
  // 标准化引用原子类型
  i: ComponentInternalInstance // 表示组件的内部实例，用于在编译过程中跟踪引用所属的组件实例
  r: VNodeRef // 表示引用对象本身，可以是字符串、引用对象（Ref）或一个回调函数
  k?: string // 可选属性，表示引用的键（key），用于处理具有多个引用的情况
  f?: boolean // 可选属性，表示是否在循环中使用的引用标记（refInFor marker），用于处理在循环中使用引用的情况
}

export type VNodeNormalizedRef = // 标准化引用类型

    | VNodeNormalizedRefAtom // 单个原子类型
    | VNodeNormalizedRefAtom[] // 或多个原子类型

type VNodeMountHook = (vnode: VNode) => void // 虚拟结点挂载钩子
type VNodeUpdateHook = (vnode: VNode, oldVNode: VNode) => void // 虚拟结点更新钩子
export type VNodeHook = // 虚拟结点钩子，批量管理结点的挂载与更新
  VNodeMountHook | VNodeUpdateHook | VNodeMountHook[] | VNodeUpdateHook[]

// https://github.com/microsoft/TypeScript/issues/33099
export type VNodeProps = {
  // 虚拟结点的属性
  key?: string | number | symbol // key用于diff算法判断是否需要更新结点
  ref?: VNodeRef // 结点的引用类型
  ref_for?: boolean // 表示是否在循环中使用的引用标记
  ref_key?: string // 表示引用的键（key），用于处理多个引用的情况

  // vnode hooks
  onVnodeBeforeMount?: VNodeMountHook | VNodeMountHook[] // 挂载前
  onVnodeMounted?: VNodeMountHook | VNodeMountHook[] // 挂载后
  onVnodeBeforeUpdate?: VNodeUpdateHook | VNodeUpdateHook[] // 更新前
  onVnodeUpdated?: VNodeUpdateHook | VNodeUpdateHook[] // 更新后
  onVnodeBeforeUnmount?: VNodeMountHook | VNodeMountHook[] // 卸载前
  onVnodeUnmounted?: VNodeMountHook | VNodeMountHook[] // 卸载后
}

type VNodeChildAtom = // 虚拟节点子节点的原子类型
  VNode | string | number | boolean | null | undefined | void

// 可嵌套的虚拟子结点数组
export type VNodeArrayChildren = Array<VNodeArrayChildren | VNodeChildAtom>
// 虚拟子结点
export type VNodeChild = VNodeChildAtom | VNodeArrayChildren

export type VNodeNormalizedChildren =
  | string
  | VNodeArrayChildren
  | RawSlots
  | null

export interface VNode<
  HostNode = RendererNode,
  HostElement = RendererElement,
  ExtraProps = { [key: string]: any }
> {
  /**
   * @internal
   */
  __v_isVNode: true // 一个内部标记，表示这是一个Vue虚拟节点

  /**
   * @internal
   */
  [ReactiveFlags.SKIP]: true

  type: VNodeTypes // 表示虚拟节点的类型
  props: (VNodeProps & ExtraProps) | null // 表示虚拟节点的属性
  key: string | number | symbol | null // 用于在diff算法中判断虚拟节点是否需要更新的键
  ref: VNodeNormalizedRef | null // 表示虚拟节点的引用类型，可以是一个VNodeNormalizedRef对象，也可以是null
  /**
   * SFC only. This is assigned on vnode creation using currentScopeId
   * which is set alongside currentRenderingInstance.
   */
  scopeId: string | null // 在SFC（单文件组件）中使用的作用域ID，用于样式隔离
  /**
   * SFC only. This is assigned to:
   * - Slot fragment vnodes with :slotted SFC styles.
   * - Component vnodes (during patch/hydration) so that its root node can
   *   inherit the component's slotScopeIds
   * @internal
   */
  slotScopeIds: string[] | null // 在SFC中，用于插槽和组件之间传递作用域ID的数组
  children: VNodeNormalizedChildren // 表示虚拟节点的子节点
  component: ComponentInternalInstance | null // 表示虚拟节点所属的组件实例
  dirs: DirectiveBinding[] | null // 表示虚拟节点的指令绑定
  transition: TransitionHooks<HostElement> | null // 表示虚拟节点的过渡钩子

  // DOM
  el: HostNode | null // 表示虚拟节点对应的真实DOM节点
  anchor: HostNode | null // fragment anchor              // 表示虚拟节点的锚点节点（用于片段）
  target: HostElement | null // teleport target           // 表示虚拟节点的目标元素（用于传送门）
  targetAnchor: HostNode | null // teleport target anchor // 表示虚拟节点的目标锚点节点（用于传送门）
  /**
   * number of elements contained in a static vnode
   * @internal
   */
  staticCount: number // 在静态虚拟节点中，表示包含的元素数量

  // suspense
  suspense: SuspenseBoundary | null // 表示虚拟节点的悬停边界
  /**
   * @internal
   */
  ssContent: VNode | null // 悬停边界中的内容节点
  /**
   * @internal
   */
  ssFallback: VNode | null // 悬停边界中的回退节点

  // optimization only
  shapeFlag: number // 表示虚拟节点的形状标志
  patchFlag: number // 表示虚拟节点的更新标志
  /**
   * @internal
   */
  dynamicProps: string[] | null // 动态属性
  /**
   * @internal
   */
  dynamicChildren: VNode[] | null // 动态子节点

  // application root node only
  appContext: AppContext | null // 虚拟结点所属app的上下文

  /**
   * @internal lexical scope owner instance
   * 在模板中使用了组件的方法或属性时，Vue会在渲染过程中将这些方法和属性包装成虚拟节点，并在ctx属性中存储对应的组件实例。
   * 这样，在渲染和更新虚拟节点时，可以通过访问ctx属性来获取组件实例的相关信息，从而正确地渲染和更新模板
   */
  ctx: ComponentInternalInstance | null // 表示虚拟节点的词法作用域所有者组件实例

  /**
   * @internal attached by v-memo
   */
  memo?: any[] // 通过v-memo附加的内部属性
  /**
   * @internal __COMPAT__ only
   */
  isCompatRoot?: true // 仅在__COMPAT__兼容模式下使用的内部属性
  /**
   * @internal custom element interception hook
   * 自定义元素拦截钩子是在Vue中用于拦截自定义元素的生命周期钩子的一个特殊钩子。
   * 当一个自定义元素被创建时，Vue会调用该钩子函数并传入组件的内部实例作为参数，
   * 开发者可以在该钩子函数中进行一些自定义的操作，例如记录日志、修改组件实例的属性等
   */
  ce?: (instance: ComponentInternalInstance) => void // 自定义元素拦截钩子
}

// Since v-if and v-for are the two possible ways node structure can dynamically
// change, once we consider v-if branches and each v-for fragment a block, we
// can divide a template into nested blocks, and within each block the node
// structure would be stable. This allows us to skip most children diffing
// and only worry about the dynamic nodes (indicated by patch flags).
// 模板编译和渲染过程中的节点分块处理
export const blockStack: (VNode[] | null)[] = []
export let currentBlock: VNode[] | null = null

/**
 * Open a block.
 * This must be called before `createBlock`. It cannot be part of `createBlock`
 * because the children of the block are evaluated before `createBlock` itself
 * is called. The generated code typically looks like this:
 *
 * ```js
 * function render() {
 *   return (openBlock(),createBlock('div', null, [...]))
 * }
 * ```
 * disableTracking is true when creating a v-for fragment block, since a v-for
 * fragment always diffs its children.
 * 当不断需要diff算法进行动态更新的代码块比如v-for，则将disableTracking置为true
 * @private
 */
export function openBlock(disableTracking = false) {
  blockStack.push((currentBlock = disableTracking ? null : []))
}
// 删除最近的一个块
export function closeBlock() {
  blockStack.pop()
  currentBlock = blockStack[blockStack.length - 1] || null
}

// Whether we should be tracking dynamic child nodes inside a block.
// Only tracks when this value is > 0
// We are not using a simple boolean because this value may need to be
// incremented/decremented by nested usage of v-once (see below)
// 如果模板中包含动态块，比如 v-if、v-for等，则需要进行跟踪，值对应实际需要跟踪的动态块个数
export let isBlockTreeEnabled = 1

/**
 * Block tracking sometimes needs to be disabled, for example during the
 * creation of a tree that needs to be cached by v-once. The compiler generates
 * code like this:
 *
 * ``` js
 * _cache[1] || (
 *   setBlockTracking(-1),
 *   _cache[1] = createVNode(...),
 *   setBlockTracking(1),
 *   _cache[1]
 * )
 * ```
 *
 * @private
 */
export function setBlockTracking(value: number) {
  isBlockTreeEnabled += value
}

// 将需要跟踪的块，挂在其所在的虚拟结点属性中
function setupBlock(vnode: VNode) {
  // save current block children on the block vnode
  // 将此虚拟结点中的动态结点放到其动态子节点属性中
  vnode.dynamicChildren =
    isBlockTreeEnabled > 0 ? currentBlock || (EMPTY_ARR as any) : null
  // close block
  closeBlock()
  // a block is always going to be patched, so track it as a child of its
  // parent block
  if (isBlockTreeEnabled > 0 && currentBlock) {
    currentBlock.push(vnode)
  }
  return vnode
}

/**
 * @private
 */
export function createElementBlock(
  type: string | typeof Fragment,
  props?: Record<string, any> | null,
  children?: any,
  patchFlag?: number,
  dynamicProps?: string[],
  shapeFlag?: number
) {
  return setupBlock(
    createBaseVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      shapeFlag,
      true /* isBlock */
    )
  )
}

/**
 * Create a block root vnode. Takes the same exact arguments as `createVNode`.
 * A block root keeps track of dynamic nodes within the block in the
 * `dynamicChildren` array.
 *
 * @private
 */
export function createBlock(
  type: VNodeTypes | ClassComponent,
  props?: Record<string, any> | null,
  children?: any,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  return setupBlock(
    createVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      true /* isBlock: prevent a block from tracking itself */
    )
  )
}
// 判断是否为虚拟结点
export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}
// 判断是否是相同的虚拟结点类型
export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  if (
    __DEV__ &&
    n2.shapeFlag & ShapeFlags.COMPONENT &&
    hmrDirtyComponents.has(n2.type as ConcreteComponent)
  ) {
    // #7042, ensure the vnode being unmounted during HMR
    // bitwise operations to remove keep alive flags
    n1.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
    n2.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE
    // HMR only: if the component has been hot-updated, force a reload.
    return false
  }
  return n1.type === n2.type && n1.key === n2.key
}

let vnodeArgsTransformer:
  | ((
      args: Parameters<typeof _createVNode>,
      instance: ComponentInternalInstance | null
    ) => Parameters<typeof _createVNode>)
  | undefined

/**
 * Internal API for registering an arguments transform for createVNode
 * used for creating stubs in the test-utils
 * It is *internal* but needs to be exposed for test-utils to pick up proper
 * typings
 */
export function transformVNodeArgs(transformer?: typeof vnodeArgsTransformer) {
  vnodeArgsTransformer = transformer
}

const createVNodeWithArgsTransform = (
  ...args: Parameters<typeof _createVNode>
): VNode => {
  return _createVNode(
    ...(vnodeArgsTransformer
      ? vnodeArgsTransformer(args, currentRenderingInstance)
      : args)
  )
}

export const InternalObjectKey = `__vInternal`
// 如果key存在，则返回key值，否则返回null。避免undefine的出现
const normalizeKey = ({ key }: VNodeProps): VNode['key'] =>
  key != null ? key : null

const normalizeRef = ({
  ref,
  ref_key,
  ref_for
}: VNodeProps): VNodeNormalizedRefAtom | null => {
  // ref数字转字符串
  if (typeof ref === 'number') {
    ref = '' + ref
  }
  return (
    ref != null
      ? isString(ref) || isRef(ref) || isFunction(ref)
        ? { i: currentRenderingInstance, r: ref, k: ref_key, f: !!ref_for } // 将ref_for转换为布尔值
        : ref
      : null
  ) as any
}
// 创建基本虚拟结点
/**
type：VNode的类型，可以是字符串（HTML标签名），类组件或动态组件的特殊值。
props：VNode的属性，可以包括数据和VNode属性。
children：VNode的子节点。
patchFlag：一个标志，指示需要对VNode进行哪种类型的修改。
dynamicProps：一个动态属性的数组。
shapeFlag：一个标志，指示VNode的形状，例如元素、组件或片段。
isBlockNode：一个布尔标志，指示VNode是否是块节点。
needFullChildrenNormalization：一个布尔标志，指示是否需要对VNode的子节点进行完全规范化。
 */
function createBaseVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag = 0,
  dynamicProps: string[] | null = null,
  shapeFlag = type === Fragment ? 0 : ShapeFlags.ELEMENT,
  isBlockNode = false,
  needFullChildrenNormalization = false
) {
  const vnode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    slotScopeIds: null,
    children,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null,
    ctx: currentRenderingInstance
  } as VNode
  // 如果needFullChildrenNormalization为真，那么会对vnode的子节点进行规范化操作
  if (needFullChildrenNormalization) {
    normalizeChildren(vnode, children)
    // normalize suspense children
    if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
      ;(type as typeof SuspenseImpl).normalize(vnode)
    }
  } else if (children) {
    // 如果needFullChildrenNormalization为假，
    // 但是children存在，那么说明这是一个已编译的元素VNode，只有可能是字符串或数组类型的子节点。根据children的类型，
    // 分别将vnode的shapeFlag设置为ShapeFlags.TEXT_CHILDREN或ShapeFlags.ARRAY_CHILDREN，以表示其子节点的形式。
    vnode.shapeFlag |= isString(children)
      ? ShapeFlags.TEXT_CHILDREN
      : ShapeFlags.ARRAY_CHILDREN
  }

  // validate key
  // 避免vnode.key值未NaN，因为只有 NaN !== NaN
  if (__DEV__ && vnode.key !== vnode.key) {
    warn(`VNode created with invalid key (NaN). VNode type:`, vnode.type)
  }

  // track vnode for block tree
  if (
    isBlockTreeEnabled > 0 && // 如果当前块
    // avoid a block node from tracking itself
    !isBlockNode &&
    // has current parent block
    currentBlock &&
    // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    (vnode.patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT) &&
    // the EVENTS flag is only for hydration and if it is the only flag, the
    // vnode should not be considered dynamic due to handler caching.
    vnode.patchFlag !== PatchFlags.HYDRATE_EVENTS
  ) {
    currentBlock.push(vnode)
  }

  if (__COMPAT__) {
    convertLegacyVModelProps(vnode)
    defineLegacyVNodeProperties(vnode)
  }

  return vnode
}

export { createBaseVNode as createElementVNode }

export const createVNode = (
  __DEV__ ? createVNodeWithArgsTransform : _createVNode
) as typeof _createVNode

function _createVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag: number = 0,
  dynamicProps: string[] | null = null,
  isBlockNode = false
): VNode {
  if (!type || type === NULL_DYNAMIC_COMPONENT) {
    if (__DEV__ && !type) {
      warn(`Invalid vnode type when creating vnode: ${type}.`)
    }
    type = Comment
  }

  if (isVNode(type)) {
    // createVNode receiving an existing vnode. This happens in cases like
    // <component :is="vnode"/>
    // #2078 make sure to merge refs during the clone instead of overwriting it
    const cloned = cloneVNode(type, props, true /* mergeRef: true */)
    if (children) {
      normalizeChildren(cloned, children)
    }
    if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
      if (cloned.shapeFlag & ShapeFlags.COMPONENT) {
        currentBlock[currentBlock.indexOf(type)] = cloned
      } else {
        currentBlock.push(cloned)
      }
    }
    cloned.patchFlag |= PatchFlags.BAIL
    return cloned
  }

  // class component normalization.
  if (isClassComponent(type)) {
    type = type.__vccOpts
  }

  // 2.x async/functional component compat
  if (__COMPAT__) {
    type = convertLegacyComponent(type, currentRenderingInstance)
  }

  // class & style normalization.
  if (props) {
    // for reactive or proxy objects, we need to clone it to enable mutation.
    props = guardReactiveProps(props)!
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
    if (isObject(style)) {
      // reactive state objects need to be cloned since they are likely to be
      // mutated
      if (isProxy(style) && !isArray(style)) {
        style = extend({}, style)
      }
      props.style = normalizeStyle(style)
    }
  }

  // encode the vnode type information into a bitmap
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : __FEATURE_SUSPENSE__ && isSuspense(type)
    ? ShapeFlags.SUSPENSE
    : isTeleport(type)
    ? ShapeFlags.TELEPORT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : isFunction(type)
    ? ShapeFlags.FUNCTIONAL_COMPONENT
    : 0

  if (__DEV__ && shapeFlag & ShapeFlags.STATEFUL_COMPONENT && isProxy(type)) {
    type = toRaw(type)
    warn(
      `Vue received a Component which was made a reactive object. This can ` +
        `lead to unnecessary performance overhead, and should be avoided by ` +
        `marking the component with \`markRaw\` or using \`shallowRef\` ` +
        `instead of \`ref\`.`,
      `\nComponent that was made reactive: `,
      type
    )
  }

  return createBaseVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    shapeFlag,
    isBlockNode,
    true
  )
}

export function guardReactiveProps(props: (Data & VNodeProps) | null) {
  if (!props) return null
  return isProxy(props) || InternalObjectKey in props
    ? extend({}, props)
    : props
}

export function cloneVNode<T, U>(
  vnode: VNode<T, U>,
  extraProps?: (Data & VNodeProps) | null,
  mergeRef = false
): VNode<T, U> {
  // This is intentionally NOT using spread or extend to avoid the runtime
  // key enumeration cost.
  const { props, ref, patchFlag, children } = vnode
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props
  const cloned: VNode<T, U> = {
    __v_isVNode: true,
    __v_skip: true,
    type: vnode.type,
    props: mergedProps,
    key: mergedProps && normalizeKey(mergedProps),
    ref:
      extraProps && extraProps.ref
        ? // #2078 in the case of <component :is="vnode" ref="extra"/>
          // if the vnode itself already has a ref, cloneVNode will need to merge
          // the refs so the single vnode can be set on multiple refs
          mergeRef && ref
          ? isArray(ref)
            ? ref.concat(normalizeRef(extraProps)!)
            : [ref, normalizeRef(extraProps)!]
          : normalizeRef(extraProps)
        : ref,
    scopeId: vnode.scopeId,
    slotScopeIds: vnode.slotScopeIds,
    children:
      __DEV__ && patchFlag === PatchFlags.HOISTED && isArray(children)
        ? (children as VNode[]).map(deepCloneVNode)
        : children,
    target: vnode.target,
    targetAnchor: vnode.targetAnchor,
    staticCount: vnode.staticCount,
    shapeFlag: vnode.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag:
      extraProps && vnode.type !== Fragment
        ? patchFlag === -1 // hoisted node
          ? PatchFlags.FULL_PROPS
          : patchFlag | PatchFlags.FULL_PROPS
        : patchFlag,
    dynamicProps: vnode.dynamicProps,
    dynamicChildren: vnode.dynamicChildren,
    appContext: vnode.appContext,
    dirs: vnode.dirs,
    transition: vnode.transition,

    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: vnode.component,
    suspense: vnode.suspense,
    ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
    ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
    el: vnode.el,
    anchor: vnode.anchor,
    ctx: vnode.ctx,
    ce: vnode.ce
  }
  if (__COMPAT__) {
    defineLegacyVNodeProperties(cloned as VNode)
  }
  return cloned
}

/**
 * Dev only, for HMR of hoisted vnodes reused in v-for
 * https://github.com/vitejs/vite/issues/2022
 */
function deepCloneVNode(vnode: VNode): VNode {
  const cloned = cloneVNode(vnode)
  if (isArray(vnode.children)) {
    cloned.children = (vnode.children as VNode[]).map(deepCloneVNode)
  }
  return cloned
}

/**
 * @private
 */
export function createTextVNode(text: string = ' ', flag: number = 0): VNode {
  return createVNode(Text, null, text, flag)
}

/**
 * @private
 */
export function createStaticVNode(
  content: string,
  numberOfNodes: number
): VNode {
  // A static vnode can contain multiple stringified elements, and the number
  // of elements is necessary for hydration.
  const vnode = createVNode(Static, null, content)
  vnode.staticCount = numberOfNodes
  return vnode
}

/**
 * @private
 */
export function createCommentVNode(
  text: string = '',
  // when used as the v-else branch, the comment node must be created as a
  // block to ensure correct updates.
  asBlock: boolean = false
): VNode {
  return asBlock
    ? (openBlock(), createBlock(Comment, null, text))
    : createVNode(Comment, null, text)
}

export function normalizeVNode(child: VNodeChild): VNode {
  if (child == null || typeof child === 'boolean') {
    // empty placeholder
    return createVNode(Comment)
  } else if (isArray(child)) {
    // fragment
    return createVNode(
      Fragment,
      null,
      // #3666, avoid reference pollution when reusing vnode
      child.slice()
    )
  } else if (typeof child === 'object') {
    // already vnode, this should be the most common since compiled templates
    // always produce all-vnode children arrays
    return cloneIfMounted(child)
  } else {
    // strings and numbers
    return createVNode(Text, null, String(child))
  }
}

// optimized normalization for template-compiled render fns
export function cloneIfMounted(child: VNode): VNode {
  return (child.el === null && child.patchFlag !== PatchFlags.HOISTED) ||
    child.memo
    ? child
    : cloneVNode(child)
}

export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  const { shapeFlag } = vnode
  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
    if (shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.TELEPORT)) {
      // Normalize slot to plain children for plain element and Teleport
      const slot = (children as any).default
      if (slot) {
        // _c marker is added by withCtx() indicating this is a compiled slot
        slot._c && (slot._d = false)
        normalizeChildren(vnode, slot())
        slot._c && (slot._d = true)
      }
      return
    } else {
      type = ShapeFlags.SLOTS_CHILDREN
      const slotFlag = (children as RawSlots)._
      if (!slotFlag && !(InternalObjectKey in children!)) {
        // if slots are not normalized, attach context instance
        // (compiled / normalized slots already have context)
        ;(children as RawSlots)._ctx = currentRenderingInstance
      } else if (slotFlag === SlotFlags.FORWARDED && currentRenderingInstance) {
        // a child component receives forwarded slots from the parent.
        // its slot type is determined by its parent's slot type.
        if (
          (currentRenderingInstance.slots as RawSlots)._ === SlotFlags.STABLE
        ) {
          ;(children as RawSlots)._ = SlotFlags.STABLE
        } else {
          ;(children as RawSlots)._ = SlotFlags.DYNAMIC
          vnode.patchFlag |= PatchFlags.DYNAMIC_SLOTS
        }
      }
    }
  } else if (isFunction(children)) {
    children = { default: children, _ctx: currentRenderingInstance }
    type = ShapeFlags.SLOTS_CHILDREN
  } else {
    children = String(children)
    // force teleport children to array so it can be moved around
    if (shapeFlag & ShapeFlags.TELEPORT) {
      type = ShapeFlags.ARRAY_CHILDREN
      children = [createTextVNode(children as string)]
    } else {
      type = ShapeFlags.TEXT_CHILDREN
    }
  }
  vnode.children = children as VNodeNormalizedChildren
  vnode.shapeFlag |= type
}

export function mergeProps(...args: (Data & VNodeProps)[]) {
  const ret: Data = {}
  for (let i = 0; i < args.length; i++) {
    const toMerge = args[i]
    for (const key in toMerge) {
      if (key === 'class') {
        if (ret.class !== toMerge.class) {
          ret.class = normalizeClass([ret.class, toMerge.class])
        }
      } else if (key === 'style') {
        ret.style = normalizeStyle([ret.style, toMerge.style])
      } else if (isOn(key)) {
        const existing = ret[key]
        const incoming = toMerge[key]
        if (
          incoming &&
          existing !== incoming &&
          !(isArray(existing) && existing.includes(incoming))
        ) {
          ret[key] = existing
            ? [].concat(existing as any, incoming as any)
            : incoming
        }
      } else if (key !== '') {
        ret[key] = toMerge[key]
      }
    }
  }
  return ret
}

export function invokeVNodeHook(
  hook: VNodeHook,
  instance: ComponentInternalInstance | null,
  vnode: VNode,
  prevVNode: VNode | null = null
) {
  callWithAsyncErrorHandling(hook, instance, ErrorCodes.VNODE_HOOK, [
    vnode,
    prevVNode
  ])
}
