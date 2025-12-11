<script setup lang="ts">
import { onMounted, ref, watch, computed, nextTick } from 'vue';
import * as echarts from 'echarts';
import { ElMessage } from 'element-plus';
import { api } from '@/store/auth';

const tables = ref<any[]>([]);
const currentTable = ref<any>(null);
const allowedNumericFields = ref<string[]>([]);
const numericField = ref('');

// 图表引用
const barChartRef = ref<HTMLDivElement | null>(null);
const boxChartRef = ref<HTMLDivElement | null>(null);
let barChart: echarts.ECharts | null = null;
let boxChart: echarts.ECharts | null = null;

const stats = ref<Record<string, number>>({});
const rawValues = ref<number[]>([]); // 存储原始数据用于箱型图

async function fetchTables() {
  try {
    const res = await api.get('/tables');
    tables.value = res.data.items || [];
    if (tables.value.length) {
      currentTable.value = tables.value[0];
      allowedNumericFields.value = [];
      numericField.value = '';
    }
  } catch (e) {
    ElMessage.error('获取表格列表失败');
  }
}

const allFields = computed(() => currentTable.value?.fields || []);

async function refresh() {
  if (!currentTable.value || !numericField.value) return;

  try {
    // 获取全量数据
    const res = await api.get(`/tables/${currentTable.value.name}/data`, {
      params: { page: 1, size: 10000 }
    });
    const rows = res.data.items || [];

    // 计算统计量和原始数据
    const { summary, values } = calculateLocalStats(rows, numericField.value);
    stats.value = summary;
    rawValues.value = values;

    // 渲染图表
    await nextTick();
    renderBarChart();
    renderBoxChart();

    ElMessage.success('计算完成');
  } catch (e: any) {
    console.error(e);
    ElMessage.error(e.message || '统计失败');
    stats.value = {};
    rawValues.value = [];
    disposeCharts();
  }
}

function calculateLocalStats(rows: any[], fieldName: string) {
  const values: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rawVal = rows[i][fieldName];
    if (rawVal === null || rawVal === undefined || rawVal === '') continue;
    const numVal = Number(rawVal);
    if (isNaN(numVal)) {
      throw new Error(`无法计算：第 ${i + 1} 行字段 "${fieldName}" 的值 "${rawVal}" 不是有效数字。`);
    }
    values.push(numVal);
  }

  if (values.length === 0) {
    throw new Error('该列没有有效数据');
  }

  // 排序，为中位数和箱型图做准备
  values.sort((a, b) => a - b);

  const sum = values.reduce((a, b) => a + b, 0);
  const count = values.length;
  const avg = sum / count;
  const max = values[values.length - 1];
  const min = values[0];

  const squareDiffs = values.map(val => Math.pow(val - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / count;
  const std = Math.sqrt(avgSquareDiff);

  return {
    summary: { sum, average: avg, max, min, count, std },
    values
  };
}

// 辅助函数：计算分位数
function getQuantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
    return sorted[base];
  }
}

function renderBarChart() {
  if (!barChartRef.value) return;
  if (barChart) barChart.dispose();
  barChart = echarts.init(barChartRef.value);

  // 按照科研论文习惯，柱状图主要展示均值
  // 为了提供上下文，我们保留 Max 和 Min，但去掉 Sum/Count（量纲不同）和 Std（应为误差棒）
  // 这里我们只展示 Average, Max, Min
  const targetKeys = ['AVERAGE', 'MAX', 'MIN'];
  const data = targetKeys.map(k => stats.value[k.toLowerCase()] || 0);

  barChart.setOption({
    title: { text: '数值概览', left: 'center', textStyle: { fontSize: 14 } },
    backgroundColor: '#fff',
    grid: { left: 50, right: 30, bottom: 30, top: 50 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const val = params[0].value;
        return `${params[0].name}: ${val.toFixed(2)}`;
      }
    },
    xAxis: {
      type: 'category',
      data: targetKeys,
      axisLabel: { fontWeight: 'bold' }
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: data,
        barWidth: '50%',
        itemStyle: {
          color: (params: any) => {
            // 给不同柱子不同颜色
            const colors = ['#3b82f6', '#10b981', '#f59e0b'];
            return colors[params.dataIndex] || '#3b82f6';
          },
          borderRadius: [4, 4, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          formatter: ({ value }: any) => value.toFixed(2)
        }
      },
    ],
  });
}

function renderBoxChart() {
  if (!boxChartRef.value || rawValues.value.length === 0) return;
  if (boxChart) boxChart.dispose();
  boxChart = echarts.init(boxChartRef.value);

  // 计算箱型图所需的5个数值: [min, Q1, median, Q3, max]
  const sorted = rawValues.value;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const q1 = getQuantile(sorted, 0.25);
  const median = getQuantile(sorted, 0.5);
  const q3 = getQuantile(sorted, 0.75);

  boxChart.setOption({
    title: { text: '数据分布 (Box Plot)', left: 'center', textStyle: { fontSize: 14 } },
    backgroundColor: '#fff',
    tooltip: {
      trigger: 'item',
      formatter: (param: any) => {
        return [
          `Upper: ${param.data[5].toFixed(2)}`,
          `Q3: ${param.data[4].toFixed(2)}`,
          `Median: ${param.data[3].toFixed(2)}`,
          `Q1: ${param.data[2].toFixed(2)}`,
          `Lower: ${param.data[1].toFixed(2)}`
        ].join('<br/>');
      }
    },
    grid: { left: 50, right: 30, bottom: 30, top: 50 },
    xAxis: {
      type: 'category',
      data: [numericField.value],
      boundaryGap: true,
      axisLine: { onZero: false },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      splitArea: { show: true }
    },
    series: [
      {
        name: 'boxplot',
        type: 'boxplot',
        // ECharts boxplot data format: [ [min, Q1, median, Q3, max] ]
        // 注意：ECharts 标准期望顺序是 [min, Q1, median, Q3, max]
        // 但在 data 中如果不使用 layout transform，直接传值即可
        data: [
          [min, q1, median, q3, max]
        ],
        itemStyle: {
          color: '#8b5cf6',
          borderColor: '#5b21b6'
        }
      }
    ]
  });
}

function exportChart(format: 'png' | 'svg') {
  // 导出逻辑稍微复杂一点，因为有两个图。
  // 简单起见，我们优先导出箱型图（通常更有价值），或者 Bar Chart
  // 这里暂时只导出 Bar Chart，实际生产可能需要 html2canvas 截图整个区域
  if (barChart) {
    const url = barChart.getDataURL({ type: format, pixelRatio: 2, backgroundColor: '#fff' });
    downloadLink(url, `bar-chart.${format}`);
  }
  if (boxChart) {
    setTimeout(() => {
      const url = boxChart?.getDataURL({ type: format, pixelRatio: 2, backgroundColor: '#fff' });
      if(url) downloadLink(url, `box-plot.${format}`);
    }, 500);
  }
}

function downloadLink(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

function disposeCharts() {
  if (barChart) { barChart.dispose(); barChart = null; }
  if (boxChart) { boxChart.dispose(); boxChart = null; }
}

watch(currentTable, () => {
  allowedNumericFields.value = [];
  numericField.value = '';
  stats.value = {};
  rawValues.value = [];
  disposeCharts();
});

watch(numericField, () => {
  if (numericField.value) {
    refresh();
  }
});

// 窗口大小变化时重绘
window.addEventListener('resize', () => {
  barChart?.resize();
  boxChart?.resize();
});

onMounted(fetchTables);
</script>

<template>
  <div class="page">
    <div class="card">
      <header class="section-title">
        <div>
          <h3>统计分析</h3>
          <p>选中可计算的列，自动生成统计图表。</p>
        </div>
        <div class="actions">
          <el-button @click="exportChart('png')" plain size="small">导出所有图表 (PNG)</el-button>
        </div>
      </header>

      <div class="control-panel">
        <div class="control-group">
          <span class="label">1. 选择数据表</span>
          <el-select v-model="currentTable" value-key="name" placeholder="请选择表" style="width: 100%">
            <el-option v-for="item in tables" :key="item.name" :value="item" :label="item.display_name || item.name" />
          </el-select>
        </div>
        <div class="control-group">
          <span class="label">2. 勾选数值列 (配置)</span>
          <el-select
              v-model="allowedNumericFields"
              multiple
              collapse-tags
              collapse-tags-tooltip
              placeholder="请勾选包含数字的列"
              style="width: 100%"
          >
            <el-option v-for="f in allFields" :key="f.name" :label="f.name" :value="f.name" />
          </el-select>
        </div>
        <div class="control-group">
          <span class="label">3. 选择分析目标</span>
          <el-select
              v-model="numericField"
              placeholder="选择要计算的列"
              style="width: 100%"
              :disabled="allowedNumericFields.length === 0"
          >
            <el-option v-for="name in allowedNumericFields" :key="name" :label="name" :value="name" />
          </el-select>
        </div>
      </div>

      <div class="stats-grid" v-if="Object.keys(stats).length">
        <div class="pill" v-for="(val, key) in stats" :key="key">
          <div class="pill-label">{{ key.toUpperCase() }}</div>
          <div class="pill-value">{{ val.toFixed ? val.toFixed(2) : val }}</div>
        </div>
      </div>
      <div v-else class="empty-placeholder">
        请在上以步骤中选择列进行计算
      </div>

      <div class="charts-container" v-show="Object.keys(stats).length">
        <div ref="barChartRef" class="chart-item"></div>
        <div ref="boxChartRef" class="chart-item"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 20px;
}
.card {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
}
.section-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 16px;
}
.section-title h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #1e293b;
}
.section-title p {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}
.control-panel {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.control-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.control-group .label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.pill {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.pill-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}
.pill-value {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

/* 新增布局样式 */
.charts-container {
  display: flex;
  gap: 20px;
  height: 400px;
}
.chart-item {
  flex: 1;
  height: 100%;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 10px;
}
.empty-placeholder {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
  font-size: 14px;
  border: 1px dashed #e2e8f0;
  border-radius: 8px;
  margin-bottom: 20px;
}
</style>