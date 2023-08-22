/**
 * import { h } from 'vue'
 * 上述不同类型的shapeFlag举例子说明：
 * 1.element:
 *  h('div')
 * 2.函数式组件：
 *  h(MyComponent)
 * 3.文本子结点
 *  h('text', 'some text')
 * 4.静态结点：
 *  h('p', {staticStyle: 'color: red'}, 'static text')
 * 5.注释结点：
 *  h('comment', 'some comment')
 * 6.片段结点：
 *  h('fragment', [
 *    h('p', 'hello'),
 *    h('p', 'world')
 *  ])
 * 7.动态组件结点：
 * h('component', {
 *  is: dynamicComponent
 * })
 * 8.传送门组件，可以将内容传送到指定的元素位置
 * 9.SUSPENSE组件，例子：
 * <suspense>
 *  <AsyncComp> // 异步组件，如果还未加载成功，自动展示下面的插槽内容
 *  <template #default>
 *   <p>Loading...</p>
 *  </template>
 * </suspense>
 */
export const enum ShapeFlags {
  ELEMENT = 1, // 元素节点
  FUNCTIONAL_COMPONENT = 1 << 1, // 函数式组件节点
  STATEFUL_COMPONENT = 1 << 2, // 状态组件节点
  TEXT_CHILDREN = 1 << 3, // 文本子节点
  ARRAY_CHILDREN = 1 << 4, // 数组子节点
  SLOTS_CHILDREN = 1 << 5, // 插槽子节点
  TELEPORT = 1 << 6, // 传送门组件
  SUSPENSE = 1 << 7, // Suspense组件
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // 组件应该被keep-alive缓存
  COMPONENT_KEPT_ALIVE = 1 << 9, // 组件被keep-alive缓存
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT // 组件类型
}
