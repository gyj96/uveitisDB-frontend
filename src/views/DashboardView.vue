<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '@/store/auth';

const loading = ref(false);
const tableCount = ref(0);
const recordCount = ref(0);
const summary = ref<any[]>([]);

async function fetchSnapshot() {
  loading.value = true;
  try {
    const res = await api.get('/tables');
    const tables = res.data.items || [];
    tableCount.value = tables.length;
    // quick estimation: count rows for first table
    if (tables[0]) {
      const dataRes = await api.get(`/tables/${tables[0].name}/data`, { params: { page: 1, size: 1 } });
      recordCount.value = dataRes.data.total || 0;
    }
    summary.value = tables.slice(0, 3).map((t: any) => ({
      name: t.display_name || t.name,
      fields: t.fields?.length || 0,
    }));
  } catch (e) {
    // ignore
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchSnapshot();
});
</script>

<template>
  <div class="page">
    <div class="hero card">
      <div>
        <div class="eyebrow">gyj葡萄膜炎临床数据库系统</div>
        <h1>轻松搭建自己的临床数据仓库</h1>
        <p>无需数据库知识，像Excel一样创建表格、导入、统计、导出，一站式完成。</p>
        <div class="actions">
          <el-button type="primary" size="large" @click="$router.push('/tables')">创建数据表</el-button>
          <el-button size="large" @click="$router.push('/data')">浏览数据</el-button>
        </div>
      </div>
      <div class="hero-grid">
        <div class="pill">
          <div class="num">{{ tableCount }}</div>
          <div>已创建表</div>
        </div>
        <div class="pill">
          <div class="num">{{ recordCount }}</div>
          <div>记录数</div>
        </div>
        <div class="pill">
          <div class="num">统计图</div>
          <div>PDF/Word/Excel导出</div>
        </div>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="16">
        <div class="card">
          <header class="section-title">
            <h3>最近表结构</h3>
            <el-button text size="small" @click="$router.push('/tables')">管理表</el-button>
          </header>
          <el-skeleton v-if="loading" :rows="4" animated />
          <el-timeline v-else>
            <el-timeline-item
              v-for="item in summary"
              :key="item.name"
              :timestamp="item.fields + ' 个字段'"
              type="primary"
            >
              {{ item.name }}
            </el-timeline-item>
            <el-empty v-if="!summary.length" description="还没有表，先去创建吧" />
          </el-timeline>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="card">
          <header class="section-title">
            <h3>快速提示</h3>
          </header>
          <ul class="tips">
            <li>字段中文别名越多，导入Excel时自动匹配越准。</li>
            <li>支持按字段筛选、模糊搜索、排序与导出。</li>
            <li>统计分析可以生成常见科研图表并导出。</li>
          </ul>
          <el-button type="primary" plain block @click="$router.push('/analytics')">查看统计分析</el-button>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 18px;
  align-items: center;
  margin-bottom: 18px;
}
.eyebrow {
  color: #6366f1;
  font-weight: 700;
  letter-spacing: 0.6px;
}
h1 {
  margin: 6px 0 10px 0;
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.hero-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.pill {
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(145deg, #f5f7ff, #eef2ff);
  text-align: center;
  border: 1px solid #e2e8f0;
}
.num {
  font-size: 22px;
  font-weight: 700;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.tips {
  list-style: none;
  padding: 0;
  margin: 0 0 16px 0;
  color: #475569;
  line-height: 1.8;
}
@media (max-width: 1080px) {
  .hero {
    grid-template-columns: 1fr;
  }
  .hero-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
