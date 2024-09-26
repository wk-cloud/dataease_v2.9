import { S2Event, S2Options, TableColCell, TableDataCell, TableSheet, ViewMeta } from '@antv/s2'
import { formatterItem, valueFormatter } from '../../../formatter'
import { parseJson } from '../../../util'
import { S2ChartView, S2DrawOptions } from '../../types/impl/s2'
import { TABLE_EDITOR_PROPERTY, TABLE_EDITOR_PROPERTY_INNER } from './common'
import { useI18n } from '@/hooks/web/useI18n'
import { isNumber } from 'lodash-es'
import { copyContent, SortTooltip } from '@/views/chart/components/js/panel/common/common_table'

const { t } = useI18n()
class ImageCell extends TableDataCell {
  protected drawTextShape(): void {
    const img = new Image()
    const { x, y, width, height, fieldValue } = this.meta
    img.src = fieldValue as string
    img.setAttribute('crossOrigin', 'anonymous')
    img.onload = () => {
      !this.cfg.children && (this.cfg.children = [])
      const { width: imgWidth, height: imgHeight } = img
      const ratio = Math.max(imgWidth / width, imgHeight / height)
      // 不铺满，部分留白
      const imgShowWidth = (imgWidth / ratio) * 0.8
      const imgShowHeight = (imgHeight / ratio) * 0.8
      this.textShape = this.addShape('image', {
        attrs: {
          x: x + (imgShowWidth < width ? (width - imgShowWidth) / 2 : 0),
          y: y + (imgShowHeight < height ? (height - imgShowHeight) / 2 : 0),
          width: imgShowWidth,
          height: imgShowHeight,
          img
        }
      })
    }
  }
}
/**
 * 明细表
 */
export class TableInfo extends S2ChartView<TableSheet> {
  properties = TABLE_EDITOR_PROPERTY
  propertyInner = {
    ...TABLE_EDITOR_PROPERTY_INNER,
    'table-header-selector': [
      ...TABLE_EDITOR_PROPERTY_INNER['table-header-selector'],
      'tableHeaderSort',
      'showTableHeader'
    ],
    'basic-style-selector': [
      'tableColumnMode',
      'tableBorderColor',
      'tableScrollBarColor',
      'alpha',
      'tablePageMode'
    ]
  }
  axis: AxisType[] = ['xAxis', 'filter', 'drill']
  axisConfig: AxisConfig = {
    xAxis: {
      name: `${t('chart.drag_block_table_data_column')} / ${t('chart.dimension_or_quota')}`
    }
  }

  public drawChart(drawOption: S2DrawOptions<TableSheet>): TableSheet {
    const { container, chart, pageInfo, action, resizeAction } = drawOption
    const containerDom = document.getElementById(container)

    // fields
    let fields = chart.data.fields
    const columns = []
    const meta = []
    const axisMap = chart.xAxis.reduce((pre, cur) => {
      pre[cur.dataeaseName] = cur
      return pre
    }, {})
    if (chart.drill) {
      // 下钻过滤字段
      const filterFields = chart.drillFilters.map(i => i.fieldId)
      // 下钻入口的字段下标
      const drillFieldId = chart.drillFields[0].id
      const drillFieldIndex = chart.xAxis.findIndex(ele => ele.id === drillFieldId)
      // 当前下钻字段
      const curDrillFieldId = chart.drillFields[filterFields.length].id
      const curDrillField = fields.filter(ele => ele.id === curDrillFieldId)
      filterFields.push(curDrillFieldId)
      // 移除下钻字段，把当前下钻字段插入到下钻入口位置
      fields = fields.filter(ele => {
        return !filterFields.includes(ele.id)
      })
      fields.splice(drillFieldIndex, 0, ...curDrillField)
    }
    fields.forEach(ele => {
      const f = axisMap[ele.dataeaseName]
      columns.push(ele.dataeaseName)
      meta.push({
        field: ele.dataeaseName,
        name: ele.chartShowName ?? ele.name,
        formatter: function (value) {
          if (!f) {
            return value
          }
          if (value === null || value === undefined) {
            return value
          }
          if (![2, 3].includes(f.deType) || !isNumber(value)) {
            return value
          }
          let formatCfg = f.formatterCfg
          if (!formatCfg) {
            formatCfg = formatterItem
          }
          return valueFormatter(value, formatCfg)
        }
      })
    })
    // 空值处理
    const newData = this.configEmptyDataStrategy(chart)
    // data config
    const s2DataConfig = {
      fields: {
        columns: columns
      },
      meta: meta,
      data: newData
    }

    const customAttr = parseJson(chart.customAttr)
    const style = this.configStyle(chart)
    // 自适应列宽模式下，URL 字段的宽度固定为 120
    if (customAttr.basicStyle.tableColumnMode === 'adapt') {
      const urlFields = fields.filter(field => field.deType === 7)
      style.colCfg.widthByFieldValue = urlFields?.reduce((p, n) => {
        p[n.chartShowName ?? n.name] = 120
        return p
      }, {})
    }
    // options
    const s2Options: S2Options = {
      width: containerDom.offsetWidth,
      height: containerDom.offsetHeight,
      showSeriesNumber: customAttr.tableHeader.showIndex,
      style,
      conditions: this.configConditions(chart),
      tooltip: {
        getContainer: () => containerDom,
        renderTooltip: sheet => new SortTooltip(sheet)
      }
    }
    // 开启序号之后，第一列就是序号列，修改 label 即可
    if (s2Options.showSeriesNumber) {
      s2Options.colCell = (node, sheet, config) => {
        if (node.colIndex === 0) {
          let indexLabel = customAttr.tableHeader.indexLabel
          if (!indexLabel) {
            indexLabel = ''
          }
          const cell = new TableColCell(node, sheet, config)
          const shape = cell.getTextShape() as any
          shape.attrs.text = indexLabel
          return cell
        }
        return new TableColCell(node, sheet, config)
      }
    }
    s2Options.dataCell = viewMeta => {
      const field = fields.filter(f => f.dataeaseName === viewMeta.valueField)?.[0]
      if (field?.deType === 7 && chart.showPosition !== 'dialog') {
        return new ImageCell(viewMeta, viewMeta?.spreadsheet)
      }
      if (viewMeta.colIndex === 0 && s2Options.showSeriesNumber) {
        viewMeta.fieldValue = pageInfo.pageSize * (pageInfo.currentPage - 1) + viewMeta.rowIndex + 1
      }
      return new TableDataCell(viewMeta, viewMeta?.spreadsheet)
    }
    // tooltip
    this.configTooltip(chart, s2Options)
    // 隐藏表头，保留顶部的分割线, 禁用表头横向 resize
    if (customAttr.tableHeader.showTableHeader === false) {
      s2Options.style.colCfg.height = 1
      s2Options.interaction = {
        resize: {
          colCellVertical: false
        }
      }
      s2Options.colCell = (node, sheet, config) => {
        node.label = ' '
        return new TableColCell(node, sheet, config)
      }
    } else {
      // header interaction
      this.configHeaderInteraction(chart, s2Options)
    }
    // 开始渲染
    const newChart = new TableSheet(containerDom, s2DataConfig, s2Options)

    // click
    newChart.on(S2Event.DATA_CELL_CLICK, ev => {
      const cell = newChart.getCell(ev.target)
      const meta = cell.getMeta() as ViewMeta
      const nameIdMap = fields.reduce((pre, next) => {
        pre[next['dataeaseName']] = next['id']
        return pre
      }, {})

      const rowData = newChart.dataSet.getRowData(meta)
      const dimensionList = []
      for (const key in rowData) {
        if (nameIdMap[key]) {
          dimensionList.push({ id: nameIdMap[key], value: rowData[key] })
        }
      }
      const param = {
        x: ev.x,
        y: ev.y,
        data: {
          dimensionList,
          name: nameIdMap[meta.valueField],
          sourceType: 'table-info',
          quotaList: []
        }
      }
      action(param)
    })
    // tooltip
    const { show } = customAttr.tooltip
    if (show) {
      newChart.on(S2Event.COL_CELL_HOVER, event => this.showTooltip(newChart, event, meta))
      newChart.on(S2Event.DATA_CELL_HOVER, event => this.showTooltip(newChart, event, meta))
    }
    // header resize
    newChart.on(S2Event.LAYOUT_RESIZE_COL_WIDTH, ev => resizeAction(ev))
    // right click
    newChart.on(S2Event.GLOBAL_CONTEXT_MENU, event => copyContent(newChart, event, meta))
    // theme
    const customTheme = this.configTheme(chart)
    newChart.setThemeCfg({ theme: customTheme })

    return newChart
  }

  constructor() {
    super('table-info', [])
  }
}
