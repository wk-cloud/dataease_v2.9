<script setup lang="ts">
import { getCanvasStyle, getShapeItemStyle } from '@/utils/style'
import ComponentWrapper from './ComponentWrapper.vue'
import { changeStyleWithScale } from '@/utils/translate'
import { computed, nextTick, ref, toRefs, watch, onBeforeUnmount, onMounted } from 'vue'
import { changeRefComponentsSizeWithScalePoint } from '@/utils/changeComponentsSizeWithScale'
import { dvMainStoreWithOut } from '@/store/modules/data-visualization/dvMain'
import { storeToRefs } from 'pinia'
import elementResizeDetectorMaker from 'element-resize-detector'
import UserViewEnlarge from '@/components/visualization/UserViewEnlarge.vue'
import CanvasOptBar from '@/components/visualization/CanvasOptBar.vue'
import { isDashboard, isMainCanvas, refreshOtherComponent } from '@/utils/canvasUtils'
import { activeWatermarkCheckUser } from '@/components/watermark/watermark'
import router from '@/router'
import { XpackComponent } from '@/components/plugin'
import PopArea from '@/custom-component/pop-area/Component.vue'
import CanvasFilterBtn from '@/custom-component/canvas-filter-btn/Component.vue'
import { useEmitt } from '@/hooks/web/useEmitt'
import DatasetParamsComponent from '@/components/visualization/DatasetParamsComponent.vue'
const dvMainStore = dvMainStoreWithOut()
const { pcMatrixCount, curComponent, mobileInPc, canvasState } = storeToRefs(dvMainStore)
const openHandler = ref(null)
const customDatasetParamsRef = ref(null)
const emits = defineEmits(['onResetLayout'])

const props = defineProps({
  canvasStyleData: {
    type: Object,
    required: true
  },
  componentData: {
    type: Object,
    required: true
  },
  canvasViewInfo: {
    type: Object,
    required: true
  },
  dvInfo: {
    type: Object,
    required: true
  },
  canvasId: {
    type: String,
    required: false,
    default: 'canvas-main'
  },
  showPosition: {
    required: false,
    type: String,
    default: 'preview'
  },
  previewActive: {
    type: Boolean,
    default: true
  },
  downloadStatus: {
    type: Boolean,
    default: false
  },
  userId: {
    type: String,
    require: false
  },
  outerScale: {
    type: Number,
    required: false,
    default: 1
  },
  isSelector: {
    type: Boolean,
    default: false
  }
})

const {
  canvasStyleData,
  componentData,
  dvInfo,
  canvasId,
  canvasViewInfo,
  showPosition,
  previewActive,
  downloadStatus,
  outerScale
} = toRefs(props)
const domId = 'preview-' + canvasId.value
const scaleWidthPoint = ref(100)
const scaleHeightPoint = ref(100)
const scaleMin = ref(100)
const previewCanvas = ref(null)
const cellWidth = ref(10)
const cellHeight = ref(10)
const userViewEnlargeRef = ref(null)
const searchCount = ref(0)
const refreshTimer = ref(null)
const renderReady = ref(false)
const dashboardActive = computed(() => {
  return dvInfo.value.type === 'dashboard'
})

// 大屏是否保持宽高比例 非全屏 full 都需要保持宽高比例
const dataVKeepRadio = computed(() => {
  return canvasStyleData.value?.screenAdaptor !== 'full'
})
const isReport = computed(() => {
  return !!router.currentRoute.value.query?.report
})

const popComponentData = computed(() =>
  componentData.value.filter(ele => ele.category && ele.category === 'hidden')
)

const baseComponentData = computed(() =>
  componentData.value.filter(ele => ele.category !== 'hidden' && ele.component !== 'GroupArea')
)
const canvasStyle = computed(() => {
  let style = {}
  if (canvasStyleData.value && canvasStyleData.value.width && isMainCanvas(canvasId.value)) {
    style = {
      ...getCanvasStyle(canvasStyleData.value),
      height: dashboardActive.value
        ? downloadStatus.value
          ? getDownloadStatusMainHeight()
          : '100%'
        : !canvasStyleData.value?.screenAdaptor ||
          canvasStyleData.value?.screenAdaptor === 'widthFirst'
        ? changeStyleWithScale(canvasStyleData.value?.height, scaleMin.value) + 'px'
        : '100%'
    }
    style['width'] =
      !dashboardActive.value && canvasStyleData.value?.screenAdaptor === 'heightFirst'
        ? changeStyleWithScale(canvasStyleData.value?.width, scaleHeightPoint.value) + 'px'
        : '100%'
  }
  if (!dashboardActive.value) {
    style['overflow-y'] = 'hidden'
  }
  return style
})

const getDownloadStatusMainHeight = () => {
  if (!previewCanvas.value?.childNodes) {
    nextTick(() => {
      canvasStyle.value.height = getDownloadStatusMainHeight()
    })
    return '100%'
  }
  const children = previewCanvas.value.childNodes
  let maxHeight = 0

  children.forEach(child => {
    const height = (child.offsetHeight || 0) + (child.offsetTop || 0)
    if (height > maxHeight) {
      maxHeight = height
    }
  })
  return `${maxHeight}px!important`
}

watch(
  () => previewActive.value,
  () => {
    if (previewActive.value) {
      restore()
    }
  }
)

useEmitt({
  name: 'tabCanvasChange-' + canvasId.value,
  callback: function () {
    restore()
  }
})

useEmitt({
  name: 'componentRefresh',
  callback: function () {
    if (isMainCanvas(canvasId.value)) {
      refreshDataV()
    }
  }
})

const resetLayout = () => {
  if (downloadStatus.value) {
    return
  }
  nextTick(() => {
    if (previewCanvas.value) {
      //div容器获取tableBox.value.clientWidth
      let canvasWidth = previewCanvas.value.clientWidth
      let canvasHeight = previewCanvas.value.clientHeight
      scaleWidthPoint.value = (canvasWidth * 100) / canvasStyleData.value.width
      scaleHeightPoint.value = (canvasHeight * 100) / canvasStyleData.value.height
      scaleMin.value = isDashboard()
        ? Math.floor(Math.min(scaleWidthPoint.value, scaleHeightPoint.value))
        : scaleWidthPoint.value
      if (dashboardActive.value) {
        cellWidth.value = canvasWidth / pcMatrixCount.value.x
        cellHeight.value = canvasHeight / pcMatrixCount.value.y
        scaleMin.value = isMainCanvas(canvasId.value)
          ? scaleMin.value * 1.2
          : outerScale.value * 100
      } else {
        // 需要保持宽高比例时 高度伸缩和宽度伸缩保持一致 否则 高度伸缩单独计算
        // tip 当当前画布是tab时 使用的事 outerScale.value 因为 canvasStyleData.value为 {} 此处取数逻辑需进一步优化
        const scaleMinHeight = dataVKeepRadio.value ? scaleMin.value : scaleHeightPoint.value
        changeRefComponentsSizeWithScalePoint(
          baseComponentData.value,
          canvasStyleData.value,
          scaleMin.value || outerScale.value * 100,
          scaleMinHeight || outerScale.value * 100
        )
        scaleMin.value = isMainCanvas(canvasId.value) ? scaleMin.value : outerScale.value * 100
      }
      renderReady.value = true
      emits('onResetLayout')
    }
  })
}
const restore = () => {
  if (isReport.value) {
    return
  }
  resetLayout()
}

const getShapeItemShowStyle = item => {
  return getShapeItemStyle(item, {
    dvModel: dvInfo.value.type,
    cellWidth: cellWidth.value,
    cellHeight: cellHeight.value,
    curGap: curGap.value
  })
}

const curGap = computed(() => {
  // return dashboardActive.value && canvasStyleData.value.dashboard.gap === 'yes'
  //   ? canvasStyleData.value.dashboard.gapSize
  //   : 0
  return dashboardActive.value && canvasStyleData.value?.dashboard?.gap === 'yes'
    ? canvasStyleData.value?.dashboard?.gapSize
    : 0
})

const initRefreshTimer = () => {
  // 数据刷新计时器 (仪表开启刷新并且是预览状态才启动刷新)
  if (canvasStyleData.value.refreshViewEnable && showPosition.value === 'preview') {
    searchCount.value = 0
    refreshTimer.value && clearInterval(refreshTimer.value)
    let refreshTime = 300000
    if (canvasStyleData.value.refreshTime && canvasStyleData.value.refreshTime > 0) {
      if (canvasStyleData.value.refreshUnit === 'second') {
        refreshTime = canvasStyleData.value.refreshTime * 1000
      } else {
        refreshTime = canvasStyleData.value.refreshTime * 60000
      }
    }
    refreshTimer.value = setInterval(() => {
      refreshDataV()
    }, refreshTime)
  }
}

const refreshDataV = () => {
  searchCount.value++
  if (isMainCanvas(canvasId.value)) {
    refreshOtherComponent(dvInfo.value.id, dvInfo.value.type)
  }
}

const initWatermark = (waterDomId = 'preview-canvas-main') => {
  if (dvInfo.value.watermarkInfo && isMainCanvas(canvasId.value)) {
    activeWatermarkCheckUser(waterDomId, canvasId.value, scaleMin.value / 100)
  }
}

// 目标校验： 需要校验targetSourceId 是否是当前可视化资源ID
const winMsgHandle = event => {
  const msgInfo = event.data
  // 校验targetSourceId
  if (
    msgInfo &&
    msgInfo.type === 'attachParams' &&
    msgInfo.targetSourceId === dvInfo.value.id + ''
  ) {
    const attachParams = msgInfo.params
    if (attachParams) {
      dvMainStore.addOuterParamsFilter(attachParams, baseComponentData.value, 'outer')
    }
  }
}

onMounted(() => {
  initRefreshTimer()
  resetLayout()
  window.addEventListener('resize', restore)
  const erd = elementResizeDetectorMaker()
  erd.listenTo(document.getElementById(domId), () => {
    restore()
    initWatermark()
  })
  window.addEventListener('message', winMsgHandle)
})

onBeforeUnmount(() => {
  //初始化隐藏弹框区
  dvMainStore.canvasStateChange({ key: 'curPointArea', value: 'base' })
  clearInterval(refreshTimer.value)
  window.removeEventListener('message', winMsgHandle)
})

const userViewEnlargeOpen = (opt, item) => {
  userViewEnlargeRef.value.dialogInit(
    canvasStyleData.value,
    canvasViewInfo.value[item.id],
    item,
    opt,
    { scale: scaleMin.value / 100 }
  )
}
const handleMouseDown = () => {
  dvMainStore.setCurComponent({ component: null, index: null })
  if (!curComponent.value || (curComponent.value && curComponent.value.category !== 'hidden')) {
    dvMainStore.canvasStateChange({ key: 'curPointArea', value: 'base' })
  }
}

const onPointClick = param => {
  try {
    console.info('de_inner_params send')
    if (window['dataease-embedded-host'] && openHandler?.value) {
      const pm = {
        methodName: 'embeddedInteractive',
        args: {
          eventName: 'de_inner_params',
          args: param
        }
      }
      openHandler.value.invokeMethod(pm)
    } else {
      console.info('de_inner_params send to host')
      const targetPm = {
        type: 'dataease-embedded-interactive',
        eventName: 'de_inner_params',
        args: param
      }
      window.parent.postMessage(targetPm, '*')
    }
  } catch (e) {
    console.warn('de_inner_params send error')
  }
}

// v-if 使用 内容不渲染 默认参数不起用
const popAreaAvailable = computed(
  () => canvasStyleData.value?.popupAvailable && isMainCanvas(canvasId.value)
)

const filterBtnShow = computed(
  () =>
    popAreaAvailable.value &&
    popComponentData.value &&
    popComponentData.value.length > 0 &&
    canvasStyleData.value.popupButtonAvailable
)
const datasetParamsInit = item => {
  customDatasetParamsRef.value?.optInit(item)
}

defineExpose({
  restore
})
</script>

<template>
  <div
    :id="domId"
    class="canvas-container"
    :style="canvasStyle"
    :class="{ 'de-download-custom': downloadStatus }"
    ref="previewCanvas"
    @mousedown="handleMouseDown"
  >
    <!--弹框触发区域-->
    <canvas-filter-btn v-if="filterBtnShow"></canvas-filter-btn>
    <!-- 弹框区域 -->
    <PopArea
      v-if="popAreaAvailable"
      :dv-info="dvInfo"
      :canvas-id="canvasId"
      :canvas-style-data="canvasStyleData"
      :canvasViewInfo="canvasViewInfo"
      :pop-component-data="popComponentData"
      :scale="scaleMin"
      :canvas-state="canvasState"
      :show-position="'preview'"
    ></PopArea>
    <canvas-opt-bar
      :canvas-id="canvasId"
      :canvas-style-data="canvasStyleData"
      :component-data="baseComponentData"
    ></canvas-opt-bar>
    <template v-if="renderReady">
      <ComponentWrapper
        v-for="(item, index) in baseComponentData"
        v-show="item.isShow"
        :active="item.id === (curComponent || {})['id']"
        :canvas-id="canvasId"
        :canvas-style-data="canvasStyleData"
        :dv-info="dvInfo"
        :canvas-view-info="canvasViewInfo"
        :view-info="canvasViewInfo[item.id]"
        :key="index"
        :config="item"
        :style="getShapeItemShowStyle(item)"
        :show-position="showPosition"
        :search-count="searchCount"
        :scale="mobileInPc ? 100 : scaleMin"
        :is-selector="props.isSelector"
        @userViewEnlargeOpen="userViewEnlargeOpen($event, item)"
        @datasetParamsInit="datasetParamsInit(item)"
        @onPointClick="onPointClick"
      />
    </template>
    <user-view-enlarge ref="userViewEnlargeRef"></user-view-enlarge>
  </div>
  <dataset-params-component ref="customDatasetParamsRef"></dataset-params-component>
  <XpackComponent ref="openHandler" jsname="L2NvbXBvbmVudC9lbWJlZGRlZC1pZnJhbWUvT3BlbkhhbmRsZXI=" />
</template>

<style lang="less" scoped>
.canvas-container {
  background-size: 100% 100% !important;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
  div::-webkit-scrollbar {
    width: 0px !important;
    height: 0px !important;
  }
  div {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }
}

.fix-button {
  position: fixed !important;
}
</style>
