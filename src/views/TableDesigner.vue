<script setup lang="ts">
import { reactive, ref } from 'vue';
import { api } from '@/store/auth';
import { ElMessage, FormInstance, FormRules } from 'element-plus';

const fieldTypes = [
  { value: 'text', label: '文本（备注、姓名等）' },
  { value: 'integer', label: '整数（计数、年龄等）' },
  { value: 'number', label: '小数（身高、体重等）' },
  { value: 'date', label: '日期/时间' },
  { value: 'boolean', label: '是/否' },
];

const formRef = ref<FormInstance>();

const form = reactive({
  name: '',
  display_name: '',
  description: '',
  fields: [
    { name: 'patient_name', labels: ['姓名', '名字'], type_hint: 'text' },
    { name: 'gender', labels: ['性别'], type_hint: 'text' },
  ] as any[],
});

const loading = ref(false);
const tables = ref<any[]>([]);

const rules: FormRules = {
  name: [
    { required: true, message: '请输入表英文名', trigger: 'blur' },
    { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: '仅支持字母、数字、下划线，且不能以数字开头', trigger: 'blur' },
  ],
};

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
      })),
    });
    ElMessage.success('表创建成功');
    await fetchTables();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '创建失败');
  } finally {
    loading.value = false;
  }
}

function addField() {
  form.fields.push({ name: '', labels: [], type_hint: 'text' });
}

function removeField(index: number) {
  form.fields.splice(index, 1);
}

async function fetchTables() {
  const res = await api.get('/tables');
  tables.value = res.data.items || [];
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
          <el-input v-model="form.name" placeholder="patients" />
        </el-form-item>
        <el-form-item label="表中文名">
          <el-input v-model="form.display_name" placeholder="患者信息表" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" rows="2" placeholder="用于记录患者基本信息" />
        </el-form-item>
      </el-form>

      <div class="field-header">
        <h4>字段设置</h4>
        <el-button text @click="addField">添加字段</el-button>
      </div>
      <el-table :data="form.fields" border stripe>
        <el-table-column type="index" label="#" width="50" />
        <el-table-column label="字段英文名" width="200">
          <template #default="{ row }">
            <el-input v-model="row.name" placeholder="例如 patient_name" />
          </template>
        </el-table-column>
        <el-table-column label="中文名称/别名">
          <template #default="{ row }">
            <el-select
              v-model="row.labels"
              multiple
              filterable
              allow-create
              default-first-option
              collapse-tags
              placeholder="输入后回车生成标签"
            />
          </template>
        </el-table-column>
        <el-table-column label="字段类型" width="220">
          <template #default="{ row }">
            <el-select v-model="row.type_hint" placeholder="类型">
              <el-option v-for="t in fieldTypes" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
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
        <el-button text size="small" @click="fetchTables">刷新</el-button>
      </header>
      <el-table :data="tables" border>
        <el-table-column prop="display_name" label="表名" />
        <el-table-column prop="name" label="英文标识" width="200" />
        <el-table-column label="字段数" width="100">
          <template #default="{ row }">
            {{ row.fields?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
      </el-table>
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
.field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0;
}
</style>
