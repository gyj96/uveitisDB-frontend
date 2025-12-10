<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, UploadRequestOptions } from 'element-plus';
import { api } from '@/store/auth';

const tables = ref<any[]>([]);
const currentTable = ref<any>(null);
const loading = ref(false);
const dataRows = ref<any[]>([]);
const total = ref(0);
const pagination = reactive({ page: 1, size: 20, search: '', sort_by: '', desc: false });

const columnSettings = reactive<{ key: string; visible: boolean; width?: number }[]>([]);
const editDialog = reactive({ visible: false, record: {} as any });
const showTips = ref(true);
const tipFields = ref<string[]>([]);
const errorText = ref('');

const displayColumns = computed(() => columnSettings.filter((c) => c.visible));
const visibleKeys = computed({
  get() {
    return columnSettings.filter((c) => c.visible).map((c) => c.key);
  },
  set(val: string[]) {
    columnSettings.forEach((c) => {
      c.visible = val.includes(c.key);
    });
  },
});

async function fetchTables() {
  errorText.value = '';
  const res = await api.get('/tables');
  tables.value = res.data.items || [];
  if (!currentTable.value && tables.value.length) {
    selectTable(tables.value[0]);
  }
}

async function selectTable(table: any) {
  currentTable.value = table;
  pagination.page = 1;
  columnSettings.splice(0);
  (table.fields || []).forEach((f: any) => {
    columnSettings.push({ key: f.name, visible: true });
  });
  tipFields.value = columnSettings.slice(0, 2).map((c) => c.key);
  await fetchData();
}

async function fetchData() {
  if (!currentTable.value) return;
  loading.value = true;
  try {
    const res = await api.get(`/tables/${currentTable.value.name}/data`, {
      params: {
        page: pagination.page,
        size: pagination.size,
        search: pagination.search,
        sort_by: pagination.sort_by,
        desc: pagination.desc,
      },
    });
    dataRows.value = res.data.items || [];
    total.value = res.data.total || 0;
    errorText.value = '';
  } catch (e: any) {
    errorText.value = e?.response?.data?.error || '加载数据失败，请确认后端已启动';
    ElMessage.error(errorText.value);
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editDialog.record = {};
  editDialog.visible = true;
}

function openEdit(row: any) {
  editDialog.record = { ...row };
  editDialog.visible = true;
}

async function saveRecord() {
  if (!currentTable.value) return;
  try {
    if (editDialog.record.id) {
      await api.put(`/tables/${currentTable.value.name}/data/${editDialog.record.id}`, editDialog.record);
    } else {
      await api.post(`/tables/${currentTable.value.name}/data`, editDialog.record);
    }
    ElMessage.success('已保存');
    editDialog.visible = false;
    await fetchData();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '保存失败');
  }
}

async function remove(row: any) {
  if (!currentTable.value) return;
  await ElMessageBox.confirm('确认删除这条记录吗？', '提示', { type: 'warning' });
  await api.delete(`/tables/${currentTable.value.name}/data/${row.id}`);
  ElMessage.success('已删除');
  fetchData();
}

async function handleUpload(options: UploadRequestOptions) {
  if (!currentTable.value) return;
  const formData = new FormData();
  formData.append('file', options.file);
  try {
    await api.post(`/tables/${currentTable.value.name}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success('导入成功');
    fetchData();
    options.onSuccess && options.onSuccess({}, options.file as any);
  } catch (e: any) {
    options.onError && options.onError(e);
    ElMessage.error(e?.response?.data?.error || '导入失败，请检查列名或补充字段后重试');
  }
}

function exportCSV() {
  if (!dataRows.value.length) {
    ElMessage.info('没有数据可导出');
    return;
  }
  const cols = displayColumns.value.map((c) => c.key);
  const header = cols.join(',');
  const body = dataRows.value
    .map((row) => cols.map((c) => `"${(row[c] ?? '').toString().replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentTable.value.name || 'data'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function onSort({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  pagination.sort_by = order ? prop : '';
  pagination.desc = order === 'descending';
  fetchData();
}

onMounted(fetchTables);
</script>

<template>
  <div class="page">
    <div class="card toolbar">
      <div class="left">
        <el-select
          v-model="currentTable"
          value-key="name"
          placeholder="选择数据表"
          style="width: 260px"
          @change="selectTable"
        >
          <el-option v-for="item in tables" :key="item.name" :label="item.display_name || item.name" :value="item" />
        </el-select>
        <el-input
          v-model="pagination.search"
          placeholder="模糊搜索"
          clearable
          style="width: 200px"
          @change="fetchData"
        />
        <el-button @click="fetchData">查询</el-button>
      </div>
      <div class="right">
        <el-upload :http-request="handleUpload" :show-file-list="false">
          <el-button type="primary" plain>导入Excel/CSV</el-button>
        </el-upload>
        <el-button @click="exportCSV">导出当前结果</el-button>
        <el-button type="primary" @click="openCreate">手动录入</el-button>
      </div>
    </div>

  <div class="card">
      <el-alert v-if="errorText" :title="errorText" type="warning" show-icon :closable="false" />
      <div class="table-actions">
        <div class="columns">
          <span>列可见性：</span>
          <el-checkbox-group v-model="visibleKeys">
            <el-checkbox v-for="col in columnSettings" :key="col.key" :label="col.key" />
          </el-checkbox-group>
        </div>
        <div class="columns">
          <el-switch v-model="showTips" active-text="悬浮提示" />
          <el-select
            v-model="tipFields"
            multiple
            placeholder="提示显示哪些字段"
            size="small"
            style="width: 280px"
          >
            <el-option v-for="col in columnSettings" :key="col.key" :label="col.key" :value="col.key" />
          </el-select>
        </div>
      </div>
      <el-table
        :data="dataRows"
        border
        stripe
        height="560"
        v-loading="loading"
        table-layout="auto"
        @sort-change="onSort"
      >
        <el-table-column v-for="col in displayColumns" :key="col.key" :prop="col.key" :label="col.key" sortable>
          <template #default="{ row }">
            <el-tooltip
              v-if="showTips && tipFields.includes(col.key)"
              effect="light"
              placement="right"
              :content="tipFields.map((k) => `${k}: ${row[k] ?? ''}`).join(' | ')"
            >
              <span>{{ row[col.key] }}</span>
            </el-tooltip>
            <span v-else>{{ row[col.key] }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button text size="small" @click="openEdit(row)">编辑</el-button>
            <el-button text type="danger" size="small" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :page-size="pagination.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          v-model:current-page="pagination.page"
          @current-change="fetchData"
          @size-change="(s:number)=>{pagination.size=s;fetchData();}"
        />
      </div>
    </div>

    <el-dialog v-model="editDialog.visible" :title="editDialog.record.id ? '编辑记录' : '新增记录'" width="520px">
      <el-form label-position="top">
        <el-form-item v-for="col in columnSettings" :key="col.key" :label="col.key" v-show="col.visible">
          <el-input v-model="editDialog.record[col.key]" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveRecord">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}
.toolbar .left,
.toolbar .right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.table-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.columns {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
