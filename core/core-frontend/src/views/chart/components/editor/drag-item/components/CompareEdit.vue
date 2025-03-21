<script lang="tsx" setup>
import { useI18n } from '@/hooks/web/useI18n'
import { computed, reactive, toRefs, watch } from 'vue'
import {
  compareYearList,
  compareMonthList,
  compareDayList
} from '@/views/chart/components/editor/drag-item/components/compare'

const { t } = useI18n()

const props = defineProps({
  compareItem: {
    type: Object,
    required: true
  },
  chart: {
    type: Object,
    required: true
  },
  dimensionData: {
    type: Array,
    required: false
  },
  quotaData: {
    type: Array,
    required: false
  }
})

const { compareItem, chart } = toRefs(props)

const state = reactive({
  fieldList: [],
  compareList: []
})

watch(
  () => props.chart,
  () => {
    initFieldList()
    initCompareType()
  },
  { deep: true }
)

const isIndicator = computed(() => {
  return chart.value.type === 'indicator'
})

// 过滤xaxis，extStack所有日期字段
const initFieldList = () => {
  let xAxis = null
  if (Object.prototype.toString.call(chart.value.xAxis) === '[object Array]') {
    xAxis = JSON.parse(JSON.stringify(chart.value.xAxis))
  } else {
    xAxis = JSON.parse(chart.value.xAxis)
  }
  const t1 = xAxis.filter(ele => {
    return ele.deType === 1
  })

  if (chart.value.type === 'table-pivot') {
    let xAxisExt = null
    if (Object.prototype.toString.call(chart.value.xAxisExt) === '[object Array]') {
      xAxisExt = JSON.parse(JSON.stringify(chart.value.xAxisExt))
    } else {
      xAxisExt = JSON.parse(chart.value.xAxisExt)
    }
    const t2 = xAxisExt.filter(ele => {
      return ele.deType === 1
    })

    t1.push(...t2)
  }
  if (isIndicator.value) {
    t1.length = 0
    t1.push(...props.dimensionData.filter(ele => ele.deType === 1))
    t1.push(...props.quotaData.filter(ele => ele.deType === 1))
  }

  state.fieldList = t1
  // 如果没有选中字段，则默认选中第一个
  if (
    (!compareItem.value.compareCalc.field || compareItem.value.compareCalc.field === '') &&
    state.fieldList.length > 0
  ) {
    compareItem.value.compareCalc.field = state.fieldList[0].id
  }
}

// 获得不同字段格式对应能计算的同环比列表
const initCompareType = () => {
  const checkedField = state.fieldList.filter(ele => ele.id === compareItem.value.compareCalc.field)
  if (checkedField && checkedField.length > 0) {
    switch (checkedField[0].dateStyle) {
      case 'y':
        state.compareList = compareYearList
        break
      case 'y_M':
        state.compareList = compareMonthList
        break
      case 'y_M_d':
        state.compareList = compareDayList
        break
      default:
        break
    }
  } else {
    state.compareList = []
  }
  if (isIndicator.value) {
    state.compareList = [
      { name: 'day_mom', value: 'day_mom' },
      { name: 'month_mom', value: 'month_mom' },
      { name: 'year_mom', value: 'year_mom' },
      { name: 'month_yoy', value: 'month_yoy' },
      { name: 'year_yoy', value: 'year_yoy' }
    ]
  }
  // 如果没有选中一个同环比类型，则默认选中第一个
  if (
    (!compareItem.value.compareCalc.type ||
      compareItem.value.compareCalc.type === '' ||
      compareItem.value.compareCalc.type === 'none') &&
    state.compareList.length > 0
  ) {
    compareItem.value.compareCalc.type = state.compareList[0].value
  }
}

const fieldFormatter = field => {
  if (isIndicator.value) {
    return field.name
  } else {
    return field.name + '(' + t('chart.' + field.dateStyle) + ')'
  }
}

initFieldList()
initCompareType()
</script>

<template>
  <div>
    <el-form ref="form" :model="compareItem.compareCalc" label-width="80px" class="compare-form">
      <el-form-item :label="t('chart.compare_date')">
        <el-select
          v-model="compareItem.compareCalc.field"
          :placeholder="t('chart.pls_select_field')"
          @change="initCompareType"
        >
          <el-option
            v-for="field in state.fieldList"
            :key="field.id"
            :label="fieldFormatter(field)"
            :value="field.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('chart.compare_type')">
        <el-radio-group v-model="compareItem.compareCalc.type">
          <el-radio v-for="radio in state.compareList" :key="radio.value" :label="radio.value">{{
            t('chart.' + radio.value)
          }}</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item :label="t('chart.compare_data')">
        <el-radio-group v-model="compareItem.compareCalc.resultData">
          <el-radio label="sub">{{ t('chart.data_sub') }}</el-radio>
          <el-radio label="percent">{{ t('chart.data_percent') }}</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item :label="t('chart.compare_calc_expression')">
        <span v-if="compareItem.compareCalc.resultData === 'sub'" class="exp-style"
          >本期数据 - 上期数据</span
        >
        <span v-else-if="compareItem.compareCalc.resultData === 'percent'" class="exp-style"
          >(本期数据 / |上期数据| - 1) * 100%</span
        >
      </el-form-item>

      <el-form-item :label="t('chart.tip')">
        <span class="exp-style" style="padding-top: 2px">
          当对比日期需要过滤时，请使用过滤组件实现过滤；使用图表过滤器，仪表板下钻和联动等功能，会导致结果不一致
        </span>
      </el-form-item>
    </el-form>
  </div>
</template>

<style lang="less" scoped>
.ed-form-item {
  margin-bottom: 10px !important;
}
.compare-form :deep(.ed-form-item__label) {
  font-size: 12px !important;
  font-weight: 400 !important;
  padding-top: 8px !important;
}
.compare-form :deep(.ed-radio__label) {
  font-size: 12px !important;
  font-weight: 400 !important;
}
.el-select-dropdown__item :deep(span) {
  font-size: 12px !important;
}
.exp-style {
  color: #c0c4cc;
  font-size: 12px;
}
</style>
