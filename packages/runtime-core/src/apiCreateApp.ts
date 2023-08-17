import {
  ConcreteComponent,
  Data,
  validateComponentName,
  Component,
  ComponentInternalInstance,
  getExposeProxy
} from './component'
import {
  ComponentOptions,
  MergedComponentOptions,
  RuntimeCompilerOptions
} from './componentOptions'
import {
  ComponentCustomProperties,
  ComponentPublicInstance
} from './componentPublicInstance'
import { Directive, validateDirectiveName } from './directives'
import { RootRenderFunction } from './renderer'
import { InjectionKey } from './apiInject'
import { warn } from './warning'
import { createVNode, cloneVNode, VNode } from './vnode'
import { RootHydrateFunction } from './hydration'
import { devtoolsInitApp, devtoolsUnmountApp } from './devtools'
import { isFunction, NO, isObject, extend } from '@vue/shared'
import { version } from '.'
import { installAppCompatProperties } from './compat/global'
import { NormalizedPropsOptions } from './componentProps'
import { ObjectEmitsOptions } from './componentEmits'

/**
 * @update 2023.08.17
 * @version 3.3
 */
export interface App<HostElement = any> {
  version: string // 版本
  config: AppConfig // 配置

  use<Options extends unknown[]>( // 插件接口
    plugin: Plugin<Options>, // 插件可以是对象或函数，可接受一个数组参数，且具有install属性方法
    ...options: Options // 插件的可选配置展开式
  ): this // 链式调用
  use<Options>(plugin: Plugin<Options>, options: Options): this // 插件的可选配置对象

  mixin(mixin: ComponentOptions): this // 使用混入属性，将共享的属性和方法混入到多个组件中，以实现代码的复用和组件的扩展
  component(name: string): Component | undefined // 获取组件
  component(name: string, component: Component): this // 注册组件
  directive(name: string): Directive | undefined // 获取指令
  directive(name: string, directive: Directive): this // 注册指令
  mount( // 挂载方法
    rootContainer: HostElement | string, // 指定挂载的根元素容器
    isHydrate?: boolean, // 混合渲染，是否将服务器渲染的静态 HTML 与客户端渲染的动态交互结合在一起
    isSVG?: boolean // 挂载容器是否为svg元素
  ): ComponentPublicInstance // 返回组件实例
  unmount(): void // 卸载组件
  provide<T>(key: InjectionKey<T> | string, value: T): this // 在组件树中向下传递数据，接受一个键值对

  /**
   * Runs a function with the app as active instance. This allows using of `inject()` within the function to get access
   * to variables provided via `app.provide()`.
   * 接受一个函数 fn 作为参数，并在该函数的执行过程中将当前的应用实例设置为活动实例（active instance）。
   * 这样，就可以在函数内部使用 inject() 方法来获取通过 app.provide() 提供的变量
   * @param fn - function to run with the app as active instance
   */
  runWithContext<T>(fn: () => T): T

  // internal, but we need to expose these for the server-renderer and devtools
  // 组件实例的内部属性，但需要对外部进行暴露，以便在服务器渲染器和开发工具中使用
  _uid: number // 组件实例的唯一标识符
  _component: ConcreteComponent // 组件实例所属具体组件
  _props: Data | null // 组件实例的属性数据
  _container: HostElement | null // 组件实例所挂载的实例元素
  _context: AppContext // 组件实例所在的应用上下文
  _instance: ComponentInternalInstance | null // 组件实例的内部实例

  /**
   * v2 compat only
   */ // 兼容vue2中的过滤器
  filter?(name: string): Function | undefined // 获取指定过滤器
  filter?(name: string, filter: Function): this // 注册一个过滤器

  /**
   * @internal v3 compat only
   */ // 创建根组件实例，是组件树的根节点
  _createRoot?(options: ComponentOptions): ComponentPublicInstance
}
// 选项合并函数
export type OptionMergeFunction = (to: unknown, from: unknown) => any

export interface AppConfig {
  // vue应用配置接口
  // @private                                     // 私有方法
  readonly isNativeTag?: (tag: string) => boolean // 判断一个标签是原生标签还是vue组件标签

  performance: boolean // 是否启用性能优化
  optionMergeStrategies: Record<string, OptionMergeFunction> // 选项合并策略，键值对注册合并方式
  // 通过设置 globalProperties 属性，可以将全局属性和方法添加到所有组件实例中，
  // 使得它们可以在组件中直接访问和使用
  // ComponentCustomProperties：向所有组件提供了$router以访问路由
  // Record: 定义了泛型键的属性对类型，例子如下：
  // type PersonRecord = Record<"john" | "jane", Person>;
  // const people: PersonRecord = {
  //   john: { name: "John", age: 30 },
  //   jane: { name: "Jane", age: 25 }
  // };
  globalProperties: ComponentCustomProperties & Record<string, any>
  // 错误处理函数
  errorHandler?: (
    err: unknown, // 错误对象
    instance: ComponentPublicInstance | null, // 组件实例或null
    info: string // 附加信息
  ) => void
  // 警告处理函数
  warnHandler?: (
    msg: string, // 警告消息
    instance: ComponentPublicInstance | null, // 组件实例或null
    trace: string // 警告跟踪信息
  ) => void
  /**
   * Options to pass to `@vue/compiler-dom`.
   * Only supported in runtime compiler build.
   */
  // 编译选项，包含
  // isCustomElement：是否是自定义标签的判别函数
  // whitespace：模板中的空白字符的处理方式，保留或压缩
  // comments：是否保留模板中的注释
  // delimiters：模板中的文本插值的分隔符，比如{{ xxx }}
  compilerOptions: RuntimeCompilerOptions

  /**
   * @deprecated use config.compilerOptions.isCustomElement
   * 已经被弃用，建议使用 compilerOptions.isCustomElement 来代替
   */
  isCustomElement?: (tag: string) => boolean

  // TODO remove in 3.4
  /**
   * Temporary config for opt-in to unwrap injected refs.
   * @deprecated this no longer has effect. 3.3 always unwraps injected refs.
   * 已经被弃用，选择是否要解包注入的引用。3.3开始，永远会解包注入的引用。
   */
  unwrapInjectedRef?: boolean
}

export interface AppContext {
  app: App // for devtools                // 提供给devtools的app实例
  config: AppConfig // 用于配置应用程序的全局配置
  mixins: ComponentOptions[] // 组件选项的混入
  components: Record<string, Component> // 存储注册的组件，子节点（父结点则通过原型链来访问）
  directives: Record<string, Directive> // 存储注册的指令
  provides: Record<string | symbol, any> // 存储提供的数据

  /**
   * Cache for merged/normalized component options
   * Each app instance has its own cache because app-level global mixins and
   * optionMergeStrategies can affect merge behavior.
   * @internal
   * 组件选项合并和规范化后，选项被缓存于此，避免重复合并计算
   */
  optionsCache: WeakMap<ComponentOptions, MergedComponentOptions>
  /**
   * Cache for normalized props options
   * @internal
   * 组件属性选项规范化后，选项被缓存于此，避免重复合并计算
   */
  propsCache: WeakMap<ConcreteComponent, NormalizedPropsOptions>
  /**
   * Cache for normalized emits options
   * @internal
   * 存储规范化后的emits选项
   */
  emitsCache: WeakMap<ConcreteComponent, ObjectEmitsOptions | null>
  /**
   * HMR only
   * @internal
   * 用于在热模块替换（Hot Module Replacement，HMR）时重新加载组件
   */
  reload?: () => void
  /**
   * v2 compat only
   * @internal
   * 兼容vue2的过滤器
   */
  filters?: Record<string, Function>
}

// 如果传入选项是一个数组，则安装函数接受一个App实例以及一个或多个选项
// 否则，安装函数接收一个App实例以及一个选项
type PluginInstallFunction<Options> = Options extends unknown[]
  ? (app: App, ...options: Options) => any
  : (app: App, options: Options) => any

// 插件可以是一个函数，比如：
/**
 * function plugin(app, options){
 *    ...
 * }
 * // 可选的方式
 * plugin.install = (app, options) => {
 *    ...
 * }
 */
// 插件也可以是一个对象，比如：
/**
 * const plugin = {
 *  install: (app, options)=>{
 *    ...
 *  }
 * }
 */
export type Plugin<Options = any[]> =
  | (PluginInstallFunction<Options> & {
      install?: PluginInstallFunction<Options>
    })
  | {
      install: PluginInstallFunction<Options>
    }

// 创建一个app实例的上下文，内部属性初始化
export function createAppContext(): AppContext {
  return {
    app: null as any,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap()
  }
}

// 创建app的函数的类型定义，需要传入根组件和根组件属性
export type CreateAppFunction<HostElement> = (
  rootComponent: Component,
  rootProps?: Data | null
) => App<HostElement>

// 一个自增的uid用于分配给每一个组件
let uid = 0

// 创建app实例的接口，内部包含创建app实例的createApp方法
export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
  hydrate?: RootHydrateFunction
): CreateAppFunction<HostElement> {
  // rootComponent表示根组件，通常为App.vue组件
  return function createApp(rootComponent, rootProps = null) {
    // 如果是选项式组件，则根组件传入为一个对象
    if (!isFunction(rootComponent)) {
      // TODO:意义不明？
      rootComponent = extend({}, rootComponent)
    }
    // 根属性为对象
    if (rootProps != null && !isObject(rootProps)) {
      __DEV__ && warn(`root props passed to app.mount() must be an object.`)
      rootProps = null
    }
    // 创建一个上下文
    const context = createAppContext()

    // TODO remove in 3.4
    // 后续将被移除的解包配置
    if (__DEV__) {
      Object.defineProperty(context.config, 'unwrapInjectedRef', {
        get() {
          return true
        },
        set() {
          warn(
            `app.config.unwrapInjectedRef has been deprecated. ` +
              `3.3 now always unwraps injected refs in Options API.`
          )
        }
      })
    }
    // 初始化插件容器，存放所有插件
    const installedPlugins = new Set()
    // 初始化应用挂载状态
    let isMounted = false
    // 真正开始创建一个App实例
    const app: App = (context.app = {
      _uid: uid++, // 分配uid
      _component: rootComponent as ConcreteComponent, // 设置所挂载的根组件
      _props: rootProps, // 设置根组件属性
      _container: null, // 初始化容器
      _context: context, // 初始化上下文
      _instance: null, // 初始化实例

      version,

      get config() {
        return context.config
      },

      set config(v) {
        if (__DEV__) {
          // 开发环境下
          warn(
            `app.config cannot be replaced. Modify individual options instead.`
          )
        }
      },
      // use将插件注册到插件集合中
      use(plugin: Plugin, ...options: any[]) {
        // 如果已经注册过，则发出警告提示
        if (installedPlugins.has(plugin)) {
          __DEV__ && warn(`Plugin has already been applied to target app.`)
        } // 如果插件具备一个安装函数属性，则允许插件注册
        else if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin)
          // 插件注册入集合后，开始安装到app实例上
          plugin.install(app, ...options)
        } // 如果插件本身就是一个函数，则允许注册
        else if (isFunction(plugin)) {
          installedPlugins.add(plugin)
          // 开始安装插件到app上
          plugin(app, ...options)
        } else if (__DEV__) {
          warn(
            `A plugin must either be a function or an object with an "install" ` +
              `function.`
          )
        }
        return app
      },
      // 混入组件选项
      mixin(mixin: ComponentOptions) {
        // 如果支持选项式API，才能使用mixin。在组合式API中，mixin被弃用
        if (__FEATURE_OPTIONS_API__) {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin)
          } else if (__DEV__) {
            warn(
              'Mixin has already been applied to target app' +
                (mixin.name ? `: ${mixin.name}` : '')
            )
          }
        } else if (__DEV__) {
          warn('Mixins are only available in builds supporting Options API')
        }
        return app
      },
      // 注册组件
      component(name: string, component?: Component): any {
        if (__DEV__) {
          // 验证组件的名字是否使用了原生的标签名
          validateComponentName(name, context.config)
        }
        if (!component) {
          // 组件为空，则表示获取组件
          return context.components[name]
        }
        // 避免组件重复注册
        if (__DEV__ && context.components[name]) {
          warn(`Component "${name}" has already been registered in target app.`)
        }
        // 将组件注册到上下文中，成为当前结点的子结点
        context.components[name] = component
        return app
      },
      // 注册指令
      directive(name: string, directive?: Directive) {
        if (__DEV__) {
          // 验证指令是否与原生标签的属性名冲突
          validateDirectiveName(name)
        }
        // 指令为空，表示获取指令
        if (!directive) {
          return context.directives[name] as any
        }
        // 避免指令重复注册
        if (__DEV__ && context.directives[name]) {
          warn(`Directive "${name}" has already been registered in target app.`)
        }
        // 注册指令
        context.directives[name] = directive
        return app
      },
      // 挂载函数
      mount(
        rootContainer: HostElement, // 指定挂载的容器
        isHydrate?: boolean, // 是否混合渲染，服务端渲染时才会使用
        isSVG?: boolean // 挂载容器是否为svg标签
      ): any {
        if (!isMounted) {
          // 如果当前实例没有挂载
          // #5571                  // 如果此容器已经挂载了一个app实例
          if (__DEV__ && (rootContainer as any).__vue_app__) {
            warn(
              `There is already an app instance mounted on the host container.\n` +
                ` If you want to mount another app on the same host container,` +
                ` you need to unmount the previous app by calling \`app.unmount()\` first.`
            )
          }
          // 创建一个虚拟结点
          const vnode = createVNode(rootComponent, rootProps)
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          // 将当前的上下文给虚拟结点
          vnode.appContext = context

          // HMR root reload
          // 如果是开发环境下，则添加一个reload方法以支持启动热加载
          if (__DEV__) {
            context.reload = () => {
              render(cloneVNode(vnode), rootContainer, isSVG)
            }
          }
          // 如何开启混合渲染，则使用hydrate方法渲染，否则使用render方法渲染
          if (isHydrate && hydrate) {
            hydrate(vnode as VNode<Node, Element>, rootContainer as any)
          } else {
            render(vnode, rootContainer, isSVG)
          }
          // 执行到此，挂载已完成
          isMounted = true
          // 将根组件保存到实例中
          app._container = rootContainer
          // for devtools and telemetry
          // 在根组件中也创建实例的引用，已提供给devtools使用
          // 为了便于通过容器快速拿到实例
          ;(rootContainer as any).__vue_app__ = app
          // 如果是开发环境下且启用了生产环境开发工具
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            // 实例中保存虚拟结点的组件，以支持devtools跟踪和调试
            app._instance = vnode.component
            // 初始化应用实例，并连接devtools
            devtoolsInitApp(app, version)
          }
          // 获取组件实例的代理对象，此处明确component不为空
          return getExposeProxy(vnode.component!) || vnode.component!.proxy
        } else if (__DEV__) {
          warn(
            `App has already been mounted.\n` +
              `If you want to remount the same app, move your app creation logic ` +
              `into a factory function and create fresh app instances for each ` +
              `mount - e.g. \`const createMyApp = () => createApp(App)\``
          )
        }
      },
      // 卸载实例
      unmount() {
        // 如果已被挂载，则执行卸载
        if (isMounted) {
          // 在容器中渲染空实例
          render(null, app._container)
          // 如果是生产开发环境或启用了生产开发工具
          if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            // 将应用的实例置空，外部是通过观察_instance来获取应用的状态的
            app._instance = null
            // 从开发工具中卸载app实例
            devtoolsUnmountApp(app)
          }
          // 这里将完全断开循环引用，避免内存泄露。从容器中删除app实例，断开引用
          delete app._container.__vue_app__
        } else if (__DEV__) {
          warn(`Cannot unmount an app that is not mounted.`)
        }
      },
      // 向整个组件树提供值
      provide(key, value) {
        // 如果已经提供了
        if (__DEV__ && (key as string | symbol) in context.provides) {
          warn(
            `App already provides property with key "${String(key)}". ` +
              `It will be overwritten with the new value.`
          )
        }
        // 将值保存到上下文，子组件可以从中获取
        context.provides[key as string | symbol] = value
        // 链式调用，返回自身
        return app
      },
      // 确保在操作期间，可以访问到正确的应用程序实例，进而获取到上下文
      runWithContext(fn) {
        currentApp = app
        try {
          return fn()
        } finally {
          currentApp = null
        }
      }
    })
    // 是否启用兼容性模式
    if (__COMPAT__) {
      installAppCompatProperties(app, context, render)
    }

    return app
  }
}

/**
 * @internal Used to identify the current app when using `inject()` within
 * `app.runWithContext()`.
 */
export let currentApp: App<unknown> | null = null
