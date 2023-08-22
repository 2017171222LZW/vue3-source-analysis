import { isArray, isString, isObject, hyphenate } from './general'

export type NormalizedStyle = Record<string, string | number>

// 规范化样式属性
/*
例子：
[
  '{color: "red"}',
  { 
  fontSize: '16px'
  },
  {
  color: 'blue',
  nested: {
    color: 'green'
  }
  }
]
规范化结果：
{
  color: "red",
  fontSize: '16px', 
  color: 'blue',
  nested: {
  color: 'green' 
  }
}
*/
export function normalizeStyle(
  value: unknown
): NormalizedStyle | string | undefined {
  if (isArray(value)) {
    // 样式可能为数组：
    const res: NormalizedStyle = {} // 例如：[{color: red},{fontSize: '16px'},...]
    for (let i = 0; i < value.length; i++) {
      //
      const item = value[i]
      const normalized = isString(item)
        ? parseStringStyle(item) // 如果是字符串，则解析字符串样式成为对象
        : (normalizeStyle(item) as NormalizedStyle) // 如果是对象，则递归去规范化内部内容，并返回对象
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  } else if (isString(value) || isObject(value)) {
    return value
  }
}

/*
;匹配分号
(?![^(]*\))是一个负向前瞻断言
[^(]*匹配不包含左括号的任意字符
\)匹配右括号
*/
const listDelimiterRE = /;(?![^(]*\))/g
const propertyDelimiterRE = /:([^]+)/
const styleCommentRE = /\/\*[^]*?\*\//g

// 将字符串形式的样式，解析为对象
export function parseStringStyle(cssText: string): NormalizedStyle {
  const ret: NormalizedStyle = {}
  cssText
    .replace(styleCommentRE, '') // 移除注释部分
    .split(listDelimiterRE) // 分割;得到样式属性对，但对于value中可能存在的;不进行匹配
    .forEach(item => {
      // 比如 src: url(;)
      if (item) {
        // 对每一个样式对，以:进行分割，将key:value保存到ret
        const tmp = item.split(propertyDelimiterRE)
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim())
      }
    })
  return ret
}

// 将样式对象转换为字符串
export function stringifyStyle(
  styles: NormalizedStyle | string | undefined
): string {
  let ret = ''
  if (!styles || isString(styles)) {
    return ret
  }
  for (const key in styles) {
    const value = styles[key]
    const normalizedKey = key.startsWith(`--`) ? key : hyphenate(key)
    if (isString(value) || typeof value === 'number') {
      // only render valid values
      ret += `${normalizedKey}:${value};`
    }
  }
  return ret
}

// 递归的方式，规范化class属性，统一转化为字符串
// 可能存在的class属性形式，字符串、数组、对象
// [class1, class2, ...]
// {class1: true, class2: false, class3: true, ...}
export function normalizeClass(value: unknown): string {
  let res = ''
  if (isString(value)) {
    // 字符串直接返回
    res = value
  } else if (isArray(value)) {
    // 递归的展开数组并拼接成字符串
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    // 如果是对象，只将对应value为true的key进行拼接
    for (const name in value) {
      // 比如 class: {active: true, wait: false},返回active
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim() // 去掉末尾多余的空格
}

// 规范化属性，包括class属性和style样式属性
export function normalizeProps(props: Record<string, any> | null) {
  if (!props) return null
  let { class: klass, style } = props
  if (klass && !isString(klass)) {
    props.class = normalizeClass(klass)
  }
  if (style) {
    props.style = normalizeStyle(style)
  }
  return props
}
