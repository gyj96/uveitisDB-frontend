<script setup lang="ts">
import {reactive, ref} from 'vue';
import {api} from '@/store/auth';
import {ElMessage, ElMessageBox, FormInstance, FormRules} from 'element-plus';

const fieldTypes = [
  {value: 'text', label: '文本（备注、姓名等）'},
  {value: 'integer', label: '整数（计数、年龄等）'},
  {value: 'number', label: '小数（身高、体重等）'},
  {value: 'date', label: '日期/时间'},
  {value: 'boolean', label: '是/否'},
];

const formRef = ref<FormInstance>();
const editFormRef = ref<FormInstance>();

const form = reactive({
  name: '',
  display_name: '',
  description: '',
  fields: [
    {name: 'patient_name', labels: ['姓名'], type_hint: 'text', allow_null: true},
    {name: 'gender', labels: ['性别'], type_hint: 'text', allow_null: true},
  ] as any[],
});

const loading = ref(false);
const tables = ref<any[]>([]);

const rules: FormRules = {
  name: [
    {required: true, message: '请输入表英文名', trigger: 'blur'},
    {pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: '仅支持字母、数字、下划线，且不能以数字开头', trigger: 'blur'},
  ],
};

const selectedTables = ref<any[]>([]);
const editDialog = reactive({
  visible: false,
  loading: false,
  originalName: '',
  form: {
    name: '',
    display_name: '',
    description: '',
    fields: [] as any[],
  },
});

function handleTableSelectionChange(selection: any[]) {
  selectedTables.value = selection;
}

async function batchDropTables() {
  if (!selectedTables.value.length) return;

  await ElMessageBox.confirm(
      `确认删除选中的 ${selectedTables.value.length} 张表？操作不可恢复`,
      '提示',
      {type: 'warning'},
  );

  const failed: string[] = [];
  const names = selectedTables.value.map((t) => t.name);
  for (const name of names) {
    try {
      await api.delete(`/tables/${encodeURIComponent(name)}`);
    } catch (e: any) {
      failed.push(name);
    }
  }

  if (failed.length) {
    ElMessage.error(`以下表删除失败：${failed.join('、')}`);
  } else {
    ElMessage.success(`已删除 ${names.length} 张表`);
  }
  selectedTables.value = [];
  fetchTables();
}

async function submit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  // 逐字段英文名校验
  const invalid = form.fields.find((f) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(f.name || ''));
  if (invalid) {
    ElMessage.error(`字段 ${invalid.name || '(空)'} 仅支持字母、数字、下划线，且不能以数字开头`);
    return;
  }
  loading.value = true;
  try {
    await api.post('/tables', {
      name: form.name.trim(),
      display_name: (form.display_name || form.name).trim(),
      description: form.description,
      fields: form.fields.map((f) => ({
        name: f.name.trim(),
        labels: (f.labels || []).map((s: string) => s.trim()).filter(Boolean),
        type_hint: f.type_hint,
        allow_null: f.allow_null !== false, // 默认非必填
      })),
    });
    ElMessage.success('表创建成功');
    form.name = '';
    form.display_name = '';
    form.description = '';
    form.fields = [
      {name: 'patient_name', labels: ['姓名', '名字'], type_hint: 'text', allow_null: true},
      {name: 'gender', labels: ['性别'], type_hint: 'text', allow_null: true},
    ];
    await fetchTables();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '创建失败');
  } finally {
    loading.value = false;
  }
}

function addField() {
  form.fields.push({name: '', labels: [], type_hint: 'text', allow_null: true});
}

function removeField(index: number) {
  form.fields.splice(index, 1);
}

function openEditTable(table: any) {
  editDialog.originalName = table.name;
  editDialog.form.name = table.name;
  editDialog.form.display_name = table.display_name || '';
  editDialog.form.description = table.description || '';
  editDialog.form.fields = (table.fields || []).map((f: any) => ({
    name: f.name,
    old_name: f.name,
    labels: [...(f.labels || [])],
    type_hint: f.type_hint,
    allow_null: f.allow_null !== false,
  }));
  editDialog.visible = true;
}

function addEditField() {
  editDialog.form.fields.push({
    name: '',
    old_name: '',
    labels: [],
    type_hint: 'text',
    allow_null: true,
  });
}

function removeEditField(index: number) {
  editDialog.form.fields.splice(index, 1);
}

async function saveEditTable() {
  if (!editDialog.originalName) return;
  if (!editFormRef.value) return;
  const valid = await editFormRef.value.validate().catch(() => false);
  if (!valid) return;

  const duplicate = new Set<string>();
  for (const f of editDialog.form.fields) {
    const name = (f.name || '').trim();
    if (!name) {
      ElMessage.error('字段英文名不能为空');
      return;
    }
    if (duplicate.has(name)) {
      ElMessage.error(`字段英文名重复：${name}`);
      return;
    }
    duplicate.add(name);
  }

  const payload = {
    name: editDialog.form.name.trim(),
    display_name: (editDialog.form.display_name || editDialog.form.name).trim(),
    description: editDialog.form.description,
    fields: editDialog.form.fields.map((f: any) => ({
      name: (f.name || '').trim(),
      old_name: (f.old_name || '').trim(),
      labels: (f.labels || []).map((s: string) => s.trim()).filter(Boolean),
      type_hint: f.type_hint,
      allow_null: f.allow_null !== false,
    })),
  };

  editDialog.loading = true;
  try {
    await api.put(`/tables/${editDialog.originalName}`, payload);
    ElMessage.success('表结构已更新');
    editDialog.visible = false;
    await fetchTables();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '更新失败');
  } finally {
    editDialog.loading = false;
  }
}

async function fetchTables() {
  const res = await api.get('/tables');
  tables.value = res.data.items || [];
}

async function dropTable(name: string) {
  await ElMessageBox.confirm('确认删除该表？操作不可恢复', '提示', {type: 'warning'});
  await api.delete(`/tables/${name}`);
  ElMessage.success('表已删除');
  fetchTables();
}

async function clearTable(name: string) {
  await ElMessageBox.confirm('确认清空表内数据？', '提示', {type: 'warning'});
  await api.post(`/tables/${name}/clear`);
  ElMessage.success('数据已清空');
}

fetchTables();
</script>

<template>
  <div class="page">
    <div class="card">
      <header class="section-title">
        <div>
          <h3>表结构设计</h3>
          <p>字段英文名用于数据库兼容，中文别名便于导入Excel时自动对齐。</p>
        </div>
        <el-button type="primary" @click="submit" :loading="loading">保存表</el-button>
      </header>

      <el-form ref="formRef" label-position="top" :rules="rules" :model="form">
        <el-form-item label="表英文名（必填，字母/下划线）" prop="name">
          <el-input v-model="form.name" placeholder="patients"/>
        </el-form-item>
        <el-form-item label="表中文名">
          <el-input v-model="form.display_name" placeholder="患者信息表"/>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
              v-model="form.description"
              type="textarea"
              :rows="2"
              placeholder="用于记录患者基本信息"
          />
        </el-form-item>
      </el-form>

      <div class="field-header">
        <h4>字段设置</h4>
        <el-button text @click="addField">添加字段</el-button>
      </div>
      <el-table :data="form.fields" border stripe>
        <el-table-column type="index" label="#" width="50"/>
        <el-table-column label="字段英文名" width="200">
          <template #default="{ row }">
            <el-input v-model="row.name" placeholder="例如 patient_name"/>
            <div v-if="row.name && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(row.name)" class="err">
              仅限字母/数字/下划线，且首字符不能是数字
            </div>
          </template>
        </el-table-column>
        <el-table-column label="中文名称/别名">
          <template #default="{ row }">
            <el-select
                v-model="row.labels"
                multiple
                filterable
                allow-create
                :reserve-keyword="false"
                placeholder="输入后回车生成标签"
            />
          </template>
        </el-table-column>
        <el-table-column label="字段类型" width="220">
          <template #default="{ row }">
            <el-select v-model="row.type_hint" placeholder="类型">
              <el-option v-for="t in fieldTypes" :key="t.value" :label="t.label" :value="t.value"/>
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="必填" width="90" align="center">
          <template #default="{ row }">
            <el-switch
                v-model="row.allow_null"
                inline-prompt
                active-text="必填"
                inactive-text="选填"
                :active-value="false"
                :inactive-value="true"
            />
          </template>
        </el-table-column>
        <el-table-column width="80" align="center">
          <template #default="{ $index }">
            <el-button type="text" @click="removeField($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="card" style="margin-top: 16px;">
      <header class="section-title">
        <h3>已创建的表</h3>
        <div>
          <el-button
              text
              type="danger"
              size="small"
              :disabled="!selectedTables.length"
              @click="batchDropTables"
          >
            批量删除
          </el-button>
          <el-button text size="small" @click="fetchTables">刷新</el-button>
        </div>
      </header>
      <el-table
          :data="tables"
          border
          :max-height="420"
          @selection-change="handleTableSelectionChange"
      >
        <el-table-column type="selection" width="55"/>
        <el-table-column prop="name" label="表名"/>
        <el-table-column prop="display_name" label="中文名称" width="200"/>
        <el-table-column label="字段数" width="100">
          <template #default="{ row }">
            {{ row.fields?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述"/>
        <el-table-column label="操作" width="220" align="center">
          <template #default="{ row }">
            <div class="table-ops">
              <el-button text size="small" @click="() => openEditTable(row)">编辑结构</el-button>
              <el-button text size="small" type="danger" @click="() => dropTable(row.name)">删除表</el-button>
              <el-button text size="small" @click="() => clearTable(row.name)">清空数据</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>

  <el-dialog
      v-model="editDialog.visible"
      title="编辑表结构"
      width="1000px"
      align-center
      class="edit-table-dialog"
      :close-on-click-modal="true"
      :close-on-press-escape="true"
      append-to-body
  >
    <div class="edit-body">
      <el-form ref="editFormRef" label-position="top" :rules="rules" :model="editDialog.form">
        <el-form-item label="表英文名" prop="name">
          <el-input v-model="editDialog.form.name" placeholder="例如 patients"/>
        </el-form-item>
        <el-form-item label="表中文名">
          <el-input v-model="editDialog.form.display_name" placeholder="例如 患者信息表"/>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editDialog.form.description" type="textarea" :rows="2"/>
        </el-form-item>
      </el-form>

      <div class="field-header">
        <h4>字段</h4>
        <el-button text size="small" @click="addEditField">添加字段</el-button>
      </div>
      <div class="field-table-container">
        <el-table :data="editDialog.form.fields" border stripe class="field-table">
          <el-table-column type="index" label="#" width="50"/>
          <el-table-column label="字段英文名" width="200">
            <template #default="{ row }">
              <el-input v-model="row.name" placeholder="英文名"/>
              <div v-if="row.name && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(row.name)" class="err">
                仅限字母/数字/下划线，且首字符不能是数字
              </div>
            </template>
          </el-table-column>
          <el-table-column label="中文名称/别名" width="240">
            <template #default="{ row }">
              <el-select
                  v-model="row.labels"
                  multiple
                  filterable
                  allow-create
                  :reserve-keyword="false"
                  class="alias-select"
                  style="width: 100%;"
                  placeholder="输入后回车生成标签"
              />
            </template>
          </el-table-column>
          <el-table-column label="字段类型" width="200">
            <template #default="{ row }">
              <el-select v-model="row.type_hint" :disabled="!!row.old_name">
                <el-option label="文本" value="text"/>
                <el-option label="整数" value="integer"/>
                <el-option label="数值" value="number"/>
                <el-option label="日期/时间" value="date"/>
                <el-option label="是/否" value="boolean"/>
              </el-select>
              <div v-if="row.old_name" class="err" style="color: #6b7280;">已有字段类型不可修改</div>
            </template>
          </el-table-column>
          <el-table-column label="必填" width="90" align="center">
            <template #default="{ row }">
              <el-switch
                  v-model="row.allow_null"
                  inline-prompt
                  active-text="必填"
                  inactive-text="选填"
                  :active-value="false"
                  :inactive-value="true"
              />
            </template>
          </el-table-column>
          <el-table-column width="90" align="center">
            <template #default="{ $index }">
              <el-button type="text" @click="removeEditField($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <template #footer>
      <el-button @click="editDialog.visible = false">取消</el-button>
      <el-button type="primary" :loading="editDialog.loading" @click="saveEditTable">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0;
}

.err {
  color: #e11d48;
  font-size: 12px;
  margin-top: 4px;
}

.table-ops {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.table-ops :deep(.el-button) {
  padding: 0 6px;
}

/* 修复弹窗垂直居中问题 */
.edit-table-dialog :deep(.el-overlay) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-table-dialog :deep(.el-dialog) {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  margin: auto !important; /* 确保居中 */
  position: relative !important;
  top: auto !important;
  transform: none !important;
}

.edit-table-dialog :deep(.el-dialog__header) {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  padding-top: 16px;
}

.edit-table-dialog :deep(.el-dialog__body) {
  padding: 0 20px 20px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.edit-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}

.field-table-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.field-table-container :deep(.el-table) {
  height: 100%;
}

.field-table-container :deep(.el-table__body-wrapper) {
  max-height: none;
  overflow-y: auto;
  overflow-x: hidden;
}

.field-table {
  width: 100%;
}

.alias-select :deep(.el-select__tags-text) {
  max-width: 160px;
  display: inline-block;
  white-space: normal;
}

@media (max-height: 800px) {
  .edit-table-dialog :deep(.el-dialog) {
    max-height: 85vh;
  }
}

@media (max-height: 700px) {
  .edit-table-dialog :deep(.el-dialog) {
    max-height: 80vh;
  }
}

@media (max-height: 600px) {
  .edit-table-dialog :deep(.el-dialog) {
    max-height: 75vh;
  }
}

@media (max-width: 1200px) {
  .edit-table-dialog :deep(.el-dialog) {
    width: 95% !important;
    max-width: 95vw !important;
  }
}
</style>