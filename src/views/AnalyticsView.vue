<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { ElMessage } from 'element-plus';
import { api } from '@/store/auth';

const tables = ref<any[]>([]);
const currentTable = ref<any>(null);
const numericField = ref('');
const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
const stats = ref<Record<string, number>>({});

async function fetchTables() {
  const res = await api.get('/tables');
  tables.value = res.data.items || [];
  if (tables.value.length) {
    currentTable.value = tables.value[0];
    pickNumberField();
    await refresh();
  }
}

function pickNumberField() {
  const target = currentTable.value?.fields?.find((f: any) => ['integer', 'number'].includes(f.type_hint));
  numericField.value = target?.name || currentTable.value?.fields?.[0]?.name || '';
}

async function refresh() {
  if (!currentTable.value || !numericField.value) return;
  try {
    const res = await api.get(`/tables/${currentTable.value.name}/summary`, { params: { column: numericField.value } });
    stats.value = res.data.summary || {};
    renderChart();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '统计失败，请确认字段为数字类型');
  }
}

function renderChart() {
  if (!chartRef.value) return;
  if (!chart) {
    chart = echarts.init(chartRef.value);
  }
  chart.setOption({
    backgroundColor: '#fff',
    grid: { left: 40, right: 20, bottom: 40, top: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: Object.keys(stats.value) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: Object.values(stats.value),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#60a5fa' },
            { offset: 1, color: '#a5b4fc' },
          ]),
        },
      },
    ],
  });
}

function exportChart(format: 'png' | 'svg') {
  if (!chart) return;
  const url = chart.getDataURL({ type: format, pixelRatio: 2, backgroundColor: '#fff' });
  const a = document.createElement('a');
  a.href = url;
  a.download = `analytics-${format}.${format === 'png' ? 'png' : 'svg'}`;
  a.click();
}

watch([currentTable, numericField], () => refresh());
onMounted(fetchTables);
</script>

<template>
  <div class="page">
    <div class="card">
      <header class="section-title">
        <div>
          <h3>统计分析</h3>
          <p>常用Excel公式（SUM/AVERAGE/MAX/MIN/COUNT/STD）一键出结果，自动生成科研常用柱状图。</p>
        </div>
        <div class="actions">
          <el-button @click="exportChart('png')" plain>导出PNG</el-button>
          <el-button @click="exportChart('svg')" plain>导出SVG</el-button>
        </div>
      </header>
      <div class="filters">
        <el-select
          v-model="currentTable"
          value-key="name"
          placeholder="选择表"
          style="width: 260px"
          @change="pickNumberField"
        >
          <el-option v-for="item in tables" :key="item.name" :value="item" :label="item.display_name || item.name" />
        </el-select>
        <el-select v-model="numericField" placeholder="选择数值字段" style="width: 220px" @change="refresh">
          <el-option
            v-for="f in currentTable?.fields || []"
            :key="f.name"
            :label="f.name"
            :value="f.name"
          />
        </el-select>
      </div>

      <div class="stats-grid">
        <div class="pill" v-for="(val, key) in stats" :key="key">
          <div class="label">{{ key.toUpperCase() }}</div>
          <div class="value">{{ val.toFixed ? val.toFixed(2) : val }}</div>
        </div>
      </div>

      <div ref="chartRef" class="chart"></div>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.filters {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.pill {
  background: #f5f7ff;
  border: 1px solid #e4e7f3;
  border-radius: 12px;
  padding: 12px;
}
.label {
  color: #475569;
  font-size: 12px;
}
.value {
  font-size: 20px;
  font-weight: 700;
}
.chart {
  width: 100%;
  height: 340px;
}
.actions {
  display: flex;
  gap: 8px;
}
</style>
