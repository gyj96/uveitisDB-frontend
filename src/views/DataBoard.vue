<script setup lang="ts">
import {computed, onMounted, reactive, ref} from 'vue';
import {ElMessage, ElMessageBox, UploadRequestOptions, FormInstance, FormRules} from 'element-plus';
import {api} from '@/store/auth';
import type {UploadRawFile} from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';

const tables = ref<any[]>([]);
const currentTable = ref<any>(null);
const loading = ref(false);
const dataRows = ref<any[]>([]);
const total = ref(0);
const pagination = reactive({page: 1, size: 20, search: '', sort_by: '', desc: false});

const columnSettings = reactive<
    { key: string; visible: boolean; width?: number; type?: string; required?: boolean; labels?: string[] }[]
>([]);

const editDialog = reactive({visible: false, record: {} as any});
const editFormRef = ref<FormInstance>();

const showTips = ref(true);
const tipFields = ref<string[]>([]);

const errorText = ref('');
const importFix = reactive({
  visible: false,
  uploading: false,
  file: null as UploadRawFile | null,
  unknown: [] as {
    name: string;
    action: 'create' | 'map' | 'ignore';
    target: string;
    newField: {name: string; labels: string[]; type: string; required: boolean};
  }[],
});
const hasImportFixError = computed(() =>
    importFix.unknown.some((item) => item.action === 'create' && !!newFieldNameError(item))
);
const pendingUploadOptions = ref<UploadRequestOptions | null>(null);

const fieldDialog = reactive({visible: false, name: '', labels: [] as string[], type: 'text', required: false});
const fieldFormRef = ref<FormInstance>();

const deleteFields = ref<string[]>([]);

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

const tableMinWidth = computed(() => {
  // selection + operations take ~240px, allocate ~140px per data column
  const colsWidth = displayColumns.value.length * 140;
  return Math.max(800, colsWidth + 240);
});

const selectedIds = ref<number[]>([]);

function typeLabel(type?: string) {
  switch (type) {
    case 'integer':
      return '整数';
    case 'number':
      return '数值';
    case 'date':
      return '日期/时间';
    case 'boolean':
      return '是/否';
    default:
      return '文本';
  }
}

function getFieldTitle(key: string) {
  const col = columnSettings.find((c) => c.key === key);
  if (!col) return key;
  const alias = col.labels && col.labels.length ? col.labels[0] : '';
  return alias ? `${alias} (${key})` : key;
}

function formatFieldLabel(col: { key: string; labels?: string[]; type?: string; required?: boolean }) {
  const aliases = col.labels && col.labels.length ? `（${col.labels.join(' / ')}）` : '';
  const t = typeLabel(col.type);
  const mark = col.required ? ' *' : '';
  return `${col.key}${aliases} 【${t}】${mark}`;
}

function getFieldPlaceholder(col: { type?: string }) {
  switch (col.type) {
    case 'integer':
      return '请输入整数';
    case 'number':
      return '请输入数值';
    case 'boolean':
      return '请输入 是/否 或 true/false/1/0';
    case 'date':
      return '例如：2024-01-01';
    default:
      return '请输入';
  }
}

function getEditRules(col: { key: string; type?: string; required?: boolean }) {
  const rules: any[] = [];
  if (col.required) {
    rules.push({
      required: true,
      message: `${getFieldTitle(col.key)} 为必填`,
      trigger: ['blur', 'change'],
    });
  }

  if (col.type === 'integer') {
    rules.push({
      validator: (_rule: any, value: any, callback: (err?: Error) => void) => {
        if (value === '' || value === undefined || value === null) return callback();
        if (!Number.isInteger(Number(value))) return callback(new Error('请输入整数'));
        callback();
      },
      trigger: ['blur', 'change'],
    });
  } else if (col.type === 'number') {
    rules.push({
      validator: (_rule: any, value: any, callback: (err?: Error) => void) => {
        if (value === '' || value === undefined || value === null) return callback();
        if (isNaN(Number(value))) return callback(new Error('请输入数值'));
        callback();
      },
      trigger: ['blur', 'change'],
    });
  } else if (col.type === 'boolean') {
    rules.push({
      validator: (_rule: any, value: any, callback: (err?: Error) => void) => {
        if (value === '' || value === undefined || value === null) return callback();
        const v = String(value).toLowerCase();
        const ok = ['1', '0', 'true', 'false', '是', '否'].includes(v);
        if (!ok) return callback(new Error('请输入 是/否 或 true/false/1/0'));
        callback();
      },
      trigger: ['blur', 'change'],
    });
  } else if (col.type === 'date') {
    rules.push({
      validator: (_rule: any, value: any, callback: (err?: Error) => void) => {
        if (!value) return callback();
        if (isNaN(Date.parse(String(value)))) return callback(new Error('请输入有效日期，如 2024-01-01'));
        callback();
      },
      trigger: ['blur', 'change'],
    });
  }

  return rules;
}

function handleSelectionChange(rows: any[]) {
  selectedIds.value = rows.map((r) => r.id);
}

function slugifyFieldName(input: string) {
  let name = (input || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  name = name.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!name) name = 'col';
  if (!/^[a-z_]/.test(name)) {
    name = `col_${name}`;
  }
  if (name.length > 48) {
    name = name.slice(0, 48);
  }
  let idx = 1;
  const exists = (n: string) => columnSettings.some((c) => c.key === n);
  while (exists(name)) {
    name = `${name}_${idx++}`;
  }
  return name;
}

function newFieldNameError(item: any) {
  if (item.action !== 'create') return '';
  const name = (item.newField?.name || '').trim();
  if (!name) return '字段英文名不能为空';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return '仅支持字母/数字/下划线，且不能以数字开头';
  }
  return '';
}

async function batchDelete() {
  if (!currentTable.value || !selectedIds.value.length) return;

  try {
    await ElMessageBox.confirm(
        `确认删除选中的 ${selectedIds.value.length} 条记录吗？此操作不可恢复。`,
        '批量删除警告',
        {type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消'}
    );

    // 调用后端接口
    await api.post(`/tables/${currentTable.value.name}/data/batch-delete`, {
      ids: selectedIds.value
    });

    ElMessage.success('批量删除成功');
    // 清空选中并刷新
    selectedIds.value = [];
    await fetchData();
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.response?.data?.error || '删除失败');
    }
  }
}

async function fetchTables() {
  errorText.value = '';
  const res = await api.get('/tables');
  tables.value = res.data.items || [];
  if (!currentTable.value && tables.value.length) {
    await selectTable(tables.value[0]);
  } else if (currentTable.value) {
    const updated = tables.value.find((t) => t.name === currentTable.value.name);
    if (updated) await selectTable(updated);
  }
}

async function selectTable(table: any) {
  currentTable.value = table;
  pagination.page = 1;
  columnSettings.splice(0);
  (table.fields || []).forEach((f: any) => {
    columnSettings.push({
      key: f.name,
      visible: true,
      type: f.type_hint,
      required: f.allow_null === false,
      labels: f.labels || [],
    });
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
  editDialog.record = {...row};
  editDialog.visible = true;
}

function openFieldDialog() {
  fieldDialog.visible = true;
  fieldDialog.name = '';
  fieldDialog.labels = [];
  fieldDialog.type = 'text';
  fieldDialog.required = false;
}

function fieldNameExists(name: string) {
  return columnSettings.some((c) => c.key === name);
}

const fieldRules: FormRules = {
  name: [
    {required: true, message: '请输入字段英文名', trigger: 'blur'},
    {
      validator: (_rule, value, callback) => {
        const v = (value || '').trim();
        if (!v) return callback();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) {
          return callback(new Error('仅支持字母/数字/下划线，且不能以数字开头'));
        }
        if (fieldNameExists(v)) {
          return callback(new Error('字段英文名已存在'));
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
};

async function saveField() {
  if (!currentTable.value || !fieldFormRef.value) return;

  const ok = await fieldFormRef.value.validate().catch(() => false);
  if (!ok) return;

  const name = fieldDialog.name.trim();

  try {
    await api.post(`/tables/${currentTable.value.name}/columns`, {
      fields: [
        {
          name,
          labels: (fieldDialog.labels || []).map((s) => s.trim()).filter(Boolean),
          type_hint: fieldDialog.type,
          allow_null: !fieldDialog.required,
        },
      ],
    });
    ElMessage.success('字段已添加');
    fieldDialog.visible = false;
    await fetchTables();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '添加字段失败');
  }
}

async function dropSelectedFields() {
  if (!currentTable.value || !deleteFields.value.length) return;
  await ElMessageBox.confirm('确认删除选中的字段吗？', '提示', {type: 'warning'});
  await api.delete(`/tables/${currentTable.value.name}/columns`, {data: {columns: deleteFields.value}});
  ElMessage.success('字段已删除');
  deleteFields.value = [];
  await fetchTables();
}

function castValue(type: string | undefined, v: any) {
  if (!type) return v;
  const val = typeof v === 'string' ? v.trim() : v;
  switch (type) {
    case 'integer':
      if (val === '') return '';
      return Number(val);
    case 'number':
      if (val === '') return '';
      return Number(val);
    case 'boolean':
      if (typeof val === 'boolean') return val;
      if (val === '1' || val === 1 || String(val).toLowerCase() === 'true' || String(val).toLowerCase() === '是') return true;
      if (val === '0' || val === 0 || String(val).toLowerCase() === 'false' || String(val).toLowerCase() === '否') return false;
      return val;
    default:
      return v;
  }
}

async function saveRecord() {
  if (!currentTable.value) return;
  if (editFormRef.value) {
    const valid = await editFormRef.value.validate().catch(() => false);
    if (!valid) return;
  }
  try {
    const payload: any = {};
    for (const col of columnSettings) {
      const raw = editDialog.record[col.key];
      if (raw === '' || raw === undefined || raw === null) continue;
      payload[col.key] = castValue(col.type, raw);
    }
    if (editDialog.record.id) {
      await api.put(`/tables/${currentTable.value.name}/data/${editDialog.record.id}`, payload);
    } else {
      await api.post(`/tables/${currentTable.value.name}/data`, payload);
    }
    ElMessage.success('已保存');
    editDialog.visible = false;
    await fetchData();
  } catch (e: any) {
    ElMessage.error(e?.message || e?.response?.data?.error || '保存失败');
  }
}

async function remove(row: any) {
  if (!currentTable.value) return;
  await ElMessageBox.confirm('确认删除这条记录吗？', '提示', {type: 'warning'});
  await api.delete(`/tables/${currentTable.value.name}/data/${row.id}`);
  ElMessage.success('已删除');
  await fetchData();
}

async function handleUpload(options: UploadRequestOptions) {
  if (!currentTable.value) return;
  pendingUploadOptions.value = options;
  const formData = new FormData();
  formData.append('file', options.file);
  try {
    await api.post(`/tables/${currentTable.value.name}/import`, formData, {
      headers: {'Content-Type': 'multipart/form-data'},
    });
    ElMessage.success('导入成功');
    await fetchData();
    options.onSuccess && options.onSuccess({});
    pendingUploadOptions.value = null;
  } catch (e: any) {
    const unknown = e?.response?.data?.unknown_columns;
    if (unknown && Array.isArray(unknown) && unknown.length) {
      importFix.visible = true;
      importFix.file = options.file;
      importFix.unknown = (unknown as string[]).map((name: string) => ({
        name,
        action: 'ignore',
        target: '',
        newField: {
          name: slugifyFieldName(name),
          labels: [name],
          type: 'text',
          required: false,
        },
      }));
      ElMessage.warning('存在未识别列，请为它们选择映射或忽略后继续');
      return;
    }
    options.onError && options.onError(e);
    pendingUploadOptions.value = null;
    ElMessage.error(e?.response?.data?.error || '导入失败，请检查列名或补充字段后重试');
  }
}

function cancelImportFix() {
  importFix.visible = false;
  importFix.file = null;
  importFix.unknown = [];
  if (pendingUploadOptions.value) {
    pendingUploadOptions.value.onError && pendingUploadOptions.value.onError(new Error('cancel') as any);
  }
  pendingUploadOptions.value = null;
}

async function confirmImportFix() {
  if (!currentTable.value || !importFix.file) return;
  importFix.uploading = true;
  try {
    const aliases: Record<string, string> = {};
    const newFields: any[] = [];
    const exists = new Set(columnSettings.map((c) => c.key));
    const pattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

    for (const item of importFix.unknown) {
      if (item.action === 'map') {
        if (!item.target) {
          ElMessage.error(`请为列 ${item.name} 选择映射字段或改为忽略/新增`);
          importFix.uploading = false;
          return;
        }
        aliases[item.name] = item.target;
        continue;
      }
      if (item.action === 'create') {
        let newName = item.newField.name ? item.newField.name.trim() : '';
        if (!newName) newName = slugifyFieldName(item.name);
        if (!pattern.test(newName)) {
          ElMessage.error(`新增字段 ${newName} 仅支持字母/数字/下划线，且不能以数字开头`);
          importFix.uploading = false;
          return;
        }
        if (exists.has(newName)) {
          ElMessage.error(`字段名重复：${newName}`);
          importFix.uploading = false;
          return;
        }
        exists.add(newName);
        aliases[item.name] = newName;
        newFields.push({
          name: newName,
          labels: (item.newField.labels || []).map((s) => s.trim()).filter(Boolean),
          type_hint: item.newField.type || 'text',
          allow_null: !item.newField.required,
        });
      }
    }

    if (newFields.length) {
      await api.post(`/tables/${currentTable.value.name}/columns`, {fields: newFields});
      await fetchTables();
    }

    const formData = new FormData();
    formData.append('file', importFix.file);
    formData.append('allow_unknown', '1');
    if (Object.keys(aliases).length) {
      formData.append('column_aliases', JSON.stringify(aliases));
    }
    await api.post(`/tables/${currentTable.value.name}/import`, formData, {
      headers: {'Content-Type': 'multipart/form-data'},
    });
    ElMessage.success('导入成功');
    importFix.visible = false;
    importFix.file = null;
    importFix.unknown = [];
    pendingUploadOptions.value?.onSuccess && pendingUploadOptions.value?.onSuccess({});
    pendingUploadOptions.value = null;
    fetchTables();
    fetchData();
  } catch (e: any) {
    pendingUploadOptions.value?.onError && pendingUploadOptions.value?.onError(e);
    ElMessage.error(e?.response?.data?.error || '导入失败，请检查列名或补充字段后重试');
  } finally {
    importFix.uploading = false;
  }
}

function formatTimestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function resolveFilename(fallbackBase: string) {
  return `${fallbackBase}_${formatTimestamp()}.xlsx`;
}

function parseFilename(header?: string) {
  if (!header) return '';
  const matchEncoded = /filename\\*=\"?UTF-8''([^\";]+)/i.exec(header);
  if (matchEncoded) {
    try {
      return decodeURIComponent(matchEncoded[1]);
    } catch (e) {
      return matchEncoded[1];
    }
  }
  const matchPlain = /filename=\"?([^\";]+)/i.exec(header);
  return matchPlain ? matchPlain[1] : '';
}

async function exportData(exportAll: boolean) {
  if (!currentTable.value) return;
  const payload: any = {
    search: pagination.search,
    sort_by: pagination.sort_by,
    desc: pagination.desc,
    filters: {},
    all: exportAll,
    page: pagination.page,
    size: pagination.size,
  };
  if (selectedIds.value.length) {
    payload.ids = selectedIds.value;
  }
  try {
    const res = await api.post(`/tables/${currentTable.value.name}/export`, payload, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const baseName = currentTable.value.display_name || currentTable.value.name || 'data';
    const filename = parseFilename(res.headers['content-disposition']) || resolveFilename(baseName);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '导出失败，请稍后重试');
  }
}

function onSort({prop, order}: { prop: string; order: 'ascending' | 'descending' | null }) {
  pagination.sort_by = order ? (prop as string) : '';
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
          <el-option v-for="item in tables" :key="item.name" :label="item.display_name || item.name" :value="item"/>
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
        <el-button @click="exportData(false)">导出当前页/筛选</el-button>
        <el-button @click="exportData(true)">导出所有结果</el-button>
        <el-button type="primary" @click="openCreate">手动录入</el-button>
        <el-button plain @click="openFieldDialog" :disabled="!currentTable">新增字段</el-button>
        <el-button plain type="danger" :disabled="!deleteFields.length" @click="dropSelectedFields">删除字段</el-button>
        <el-button type="danger" plain :disabled="selectedIds.length === 0" @click="batchDelete">批量删除
          ({{ selectedIds.length }})
        </el-button>
      </div>
    </div>

    <div class="card data-card">
      <el-alert v-if="errorText" :title="errorText" type="warning" show-icon :closable="false"/>
      <div class="table-actions">
        <div class="columns">
          <span>列可见性：</span>
          <el-checkbox-group v-model="visibleKeys">
            <el-checkbox v-for="col in columnSettings" :key="col.key" :label="col.key"/>
          </el-checkbox-group>
        </div>
        <div class="columns">
          <el-switch v-model="showTips" active-text="悬浮提示"/>
          <el-select
              v-model="tipFields"
              multiple
              collapse-tags
              collapse-tags-tooltip
              placeholder="提示显示哪些字段"
              size="small"
              style="width: 280px"
          >
            <el-option v-for="col in columnSettings" :key="col.key" :label="getFieldTitle(col.key)" :value="col.key"/>
          </el-select>
        </div>
        <div class="columns">
          <span>删除字段：</span>
          <el-select v-model="deleteFields"
                     multiple
                     collapse-tags
                     collapse-tags-tooltip
                     placeholder="选择要删除的字段"
                     style="width: 240px"
          >
            <el-option v-for="col in columnSettings" :key="col.key" :label="col.key" :value="col.key"/>
          </el-select>
        </div>
      </div>

      <div class="table-wrapper">
        <el-table
            class="data-table"
            :style="{ minWidth: tableMinWidth + 'px', width: '100%' }"
            :data="dataRows"
            border
            stripe
            height="560"
            v-loading="loading"
            table-layout="fixed"
            :fit="true"
            @sort-change="onSort"
            @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" align="center" fixed="left"/>
          <el-table-column
              v-for="(col, idx) in displayColumns"
              :key="col.key"
              :prop="col.key"
              :label="getFieldTitle(col.key)"
              :min-width="col.width || 140"
              :fixed="idx === 0 ? 'left' : undefined"
              sortable
          >
            <template #default="{ row }">
              <el-tooltip
                  v-if="showTips && tipFields.length"
                  placement="top"
                  :show-after="200"
                  :hide-after="0"
                  effect="light"
                  popper-class="row-tip-popper"
              >
                <template #content>
                  <div class="row-tip-card">
                    <div class="row-tip-body">
                      <div v-for="key in tipFields" :key="key" class="tip-item">
                        <span class="tip-label">{{ getFieldTitle(key) }}</span>
                        <span class="tip-value">{{ row[key] ?? '' }}</span>
                      </div>
                    </div>
                  </div>
                </template>
                <span class="cell-text">{{ row[col.key] }}</span>
              </el-tooltip>
              <span v-else class="cell-text">{{ row[col.key] }}</span>
            </template>
          </el-table-column>

          <el-table-column label="操作" :width="180" :min-width="180" fixed="right" align="center">
            <template #default="{ row }">
              <div class="ops">
                <el-button text size="small" @click="openEdit(row)">编辑</el-button>
                <el-button text type="danger" size="small" @click="remove(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pager">
        <el-config-provider :locale="zhCn">
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
        </el-config-provider>
      </div>
    </div>

    <el-dialog v-model="editDialog.visible" :title="editDialog.record.id ? '编辑记录' : '新增记录'" width="520px">
      <el-form ref="editFormRef" label-position="top" :model="editDialog.record">
        <el-form-item
            v-for="col in columnSettings"
            :key="col.key"
            v-show="col.visible"
            :label="formatFieldLabel(col)"
            :prop="col.key"
            :rules="getEditRules(col)"
        >
          <el-input
              v-model="editDialog.record[col.key]"
              :placeholder="getFieldPlaceholder(col)"
              clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveRecord">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="fieldDialog.visible" title="新增字段" width="420px">
      <el-form ref="fieldFormRef" :model="fieldDialog" :rules="fieldRules" label-position="top">
        <el-form-item label="字段英文名（字母/数字/下划线，首字母非数字）" prop="name">
          <el-input v-model="fieldDialog.name"/>
        </el-form-item>
        <el-form-item label="中文别名">
          <el-select
              v-model="fieldDialog.labels"
              multiple
              filterable
              allow-create
              :reserve-keyword="false"
              collapse-tags
              placeholder="输入后回车生成标签"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="fieldDialog.type">
            <el-option label="文本" value="text"/>
            <el-option label="整数" value="integer"/>
            <el-option label="数值" value="number"/>
            <el-option label="日期/时间" value="date"/>
            <el-option label="是/否" value="boolean"/>
          </el-select>
        </el-form-item>
        <el-form-item label="必填">
          <el-switch v-model="fieldDialog.required" inline-prompt active-text="必填" inactive-text="选填"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fieldDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveField">保存字段</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importFix.visible" title="处理未识别的列" width="620px" align-center>
      <el-alert
          title="以下列在当前表中找不到对应字段，请选择映射、忽略或直接新增字段后再导入。"
          type="warning"
          show-icon
          :closable="false"
          style="margin-bottom: 12px"
      />
      <div class="unknown-box" v-for="item in importFix.unknown" :key="item.name">
        <header class="unknown-header">
          <span class="unknown-name">{{ item.name }}</span>
          <el-radio-group v-model="item.action" size="small">
            <el-radio-button label="ignore">忽略</el-radio-button>
            <el-radio-button label="create">新增字段</el-radio-button>
            <el-radio-button label="map">映射已有</el-radio-button>
          </el-radio-group>
        </header>

        <div v-if="item.action === 'map'" class="unknown-row">
          <el-select v-model="item.target" placeholder="选择已有字段" filterable clearable style="width: 320px">
            <el-option v-for="col in columnSettings" :key="col.key" :label="formatFieldLabel(col)" :value="col.key"/>
          </el-select>
        </div>

        <div v-else-if="item.action === 'create'" class="unknown-row">
          <el-form label-position="top" style="width: 100%;">
            <div class="unknown-create">
              <el-form-item label="字段英文名">
                <el-input
                    v-model="item.newField.name"
                    :placeholder="slugifyFieldName(item.name)"
                    @blur="item.newField.name = item.newField.name ? item.newField.name.trim() : slugifyFieldName(item.name)"
                />
                <div v-if="newFieldNameError(item)" class="err">
                  {{ newFieldNameError(item) }}
                </div>
              </el-form-item>
              <el-form-item label="中文别名">
                <el-select
                    v-model="item.newField.labels"
                    multiple
                    filterable
                    allow-create
                    collapse-tags
                    collapse-tags-tooltip
                    :reserve-keyword="false"
                    style="width: 100%;"
                    placeholder="输入后回车生成标签"
                />
              </el-form-item>
              <el-form-item label="类型">
                <el-select v-model="item.newField.type" style="width: 160px">
                  <el-option label="文本" value="text"/>
                  <el-option label="整数" value="integer"/>
                  <el-option label="数值" value="number"/>
                  <el-option label="日期/时间" value="date"/>
                  <el-option label="是/否" value="boolean"/>
                </el-select>
              </el-form-item>
              <el-form-item label="必填" style="width: 120px">
                <el-switch
                    v-model="item.newField.required"
                    inline-prompt
                    active-text="必填"
                    inactive-text="选填"
                />
              </el-form-item>
            </div>
          </el-form>
        </div>
        <div v-else class="unknown-row tips">该列将被忽略，不导入。</div>
      </div>
      <template #footer>
        <el-button @click="cancelImportFix">取消</el-button>
        <el-button type="primary" :loading="importFix.uploading" :disabled="hasImportFixError" @click="confirmImportFix">
          继续导入
        </el-button>
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

.table-wrapper {
  width: 100%;
  max-width: 100%;
  overflow: auto;
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

.ops {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.cell-text {
  display: inline-block;
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.el-popper.is-light {
  border: none !important;
}

.row-tip-card {
  min-width: 260px;
  max-width: 340px;
  background: radial-gradient(circle at 0 0, #ecfeff 0, #f9fafb 40%, #f3f4ff 100%);
  border-radius: 14px;
  padding: 10px 12px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18),
  0 0 0 1px rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(10px);
  font-size: 12px;
}

.row-tip-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tip-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
}

.tip-label {
  color: #111827;
  font-weight: 500;
  white-space: nowrap;
}

.tip-value {
  color: #0f172a;
  text-align: right;
  word-break: break-all;
  max-width: 210px;
}

.data-card {
  overflow-x: hidden;
}

.unknown-box {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: #f9fafb;
}
 
.err {
  color: #e11d48;
  font-size: 12px;
  margin-top: 4px;
}

.unknown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.unknown-name {
  font-weight: 600;
  color: #111827;
}

.unknown-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.unknown-create {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px 12px;
}

.tips {
  color: #6b7280;
}
</style>

<style>
.el-popper.is-light.row-tip-popper {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}
</style>
