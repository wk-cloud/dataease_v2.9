import { deepCopy } from './utils'
import { divide, multiply } from 'mathjs'
import { dvMainStoreWithOut } from '@/store/modules/data-visualization/dvMain'
import { storeToRefs } from 'pinia'
import { groupSizeStyleAdaptor } from '@/utils/style'

const dvMainStore = dvMainStoreWithOut()
const { componentData, curComponentIndex, canvasStyleData } = storeToRefs(dvMainStore)

const needToChangeAttrs = ['top', 'left', 'width', 'height', 'fontSize', 'letterSpacing']
const needToChangeDirectionAttrs = {
  width: ['left', 'width', 'fontSize', 'letterSpacing'],
  height: ['top', 'height']
}

export function changeSizeWithScale(scale) {
  return changeComponentsSizeWithScale(scale)
}

export function changeSizeWithDirectionScale(scale, direction) {
  return changeComponentsSizeWithScale(scale, needToChangeDirectionAttrs[direction])
}

export function changeComponentsSizeWithScale(scale, changeAttrs = needToChangeAttrs) {
  const componentDataCopy = deepCopy(componentData.value)
  componentDataCopy.forEach(component => {
    Object.keys(component.style).forEach(key => {
      if (changeAttrs.includes(key)) {
        if (key === 'fontSize' && component.style[key] === '') return
        // 根据原来的比例获取样式原来的尺寸
        // 再用原来的尺寸 * 现在的比例得出新的尺寸
        component.style[key] = format(
          getOriginStyle(component.style[key], canvasStyleData.value.scale),
          scale
        )
      }
    })
    // 如果是分组组件 则要进行分组内部组件groupStyle进行深度计算
    // 计算逻辑 Group 中样式 * groupComponent.groupStyle[sonKey].
    if (['Group', 'DeTabs'].includes(component.component)) {
      try {
        groupSizeStyleAdaptor(component)
      } catch (e) {
        // 旧Group适配
        console.error('group adaptor error:' + e)
      }
    }
  })

  dvMainStore.setComponentData(componentDataCopy)
  // 更新画布数组后，需要重新设置当前组件，否则在改变比例后，直接拖动圆点改变组件大小不会生效
  dvMainStore.setCurComponent({
    component: componentData.value[curComponentIndex.value],
    index: curComponentIndex.value
  })

  // 分开保存初始化宽高比例
  dvMainStore.setCanvasStyle({
    ...canvasStyleData.value,
    scaleWidth: scale,
    scaleHeight: scale,
    scale
  })
}
export function changeRefComponentsSizeWithScale(componentDataRef, canvasStyleDataRef, scale) {
  componentDataRef.forEach(component => {
    Object.keys(component.style).forEach(key => {
      if (needToChangeAttrs.includes(key)) {
        if (key === 'fontSize' && component.style[key] === '') return
        // 根据原来的比例获取样式原来的尺寸
        // 再用原来的尺寸 * 现在的比例得出新的尺寸
        component.style[key] = format(
          getOriginStyle(component.style[key], canvasStyleDataRef.scale),
          scale
        )
      }
    })
  })
  canvasStyleDataRef.scale = scale
}

export function changeRefComponentsSizeWithScalePoint(
  componentDataRef,
  canvasStyleDataRef,
  scaleWidth,
  scaleHeight
) {
  componentDataRef.forEach(component => {
    Object.keys(component.style).forEach(key => {
      if (key === 'fontSize' && component.style[key] === '') return
      if (needToChangeDirectionAttrs.width.includes(key)) {
        // 根据原来的比例获取样式原来的尺寸
        // 再用原来的尺寸 * 现在的比例得出新的尺寸
        component.style[key] = format(
          getOriginStyle(component.style[key], canvasStyleDataRef.scale),
          scaleWidth
        )
      } else if (needToChangeDirectionAttrs.height.includes(key)) {
        // 根据原来的比例获取样式原来的尺寸
        // 再用原来的尺寸 * 现在的比例得出新的尺寸
        component.style[key] = format(
          getOriginStyle(component.style[key], canvasStyleDataRef.scaleHeight),
          scaleHeight
        )
      }
    })
  })
  canvasStyleDataRef.scale = scaleWidth
  canvasStyleDataRef.scaleWidth = scaleWidth
  canvasStyleDataRef.scaleHeight = scaleHeight
}

const needToChangeAttrs2 = ['width', 'height', 'fontSize']
export function changeComponentSizeWithScale(component, scale = canvasStyleData.value.scale) {
  Object.keys(component.style).forEach(key => {
    if (needToChangeAttrs2.includes(key)) {
      if (key === 'fontSize' && component.style[key] === '') return
      component.style[key] = format(component.style[key], scale)
    }
  })
}

function format(value, scale) {
  return multiply(value, divide(parseFloat(scale), 100))
}

function getOriginStyle(value = 0, scale) {
  if (!value) {
    value = 0
  }
  return divide(value, divide(parseFloat(scale), 100))
}
