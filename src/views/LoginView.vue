<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const form = reactive({
  username: 'admin',
  password: 'uveitis',
});
const loading = ref(false);
const error = ref('');

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

async function onSubmit() {
  loading.value = true;
  error.value = '';
  try {
    await auth.login(form.username, form.password);
    router.push((route.query.redirect as string) || '/dashboard');
  } catch (e: any) {
    error.value = e?.response?.data?.error || '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-shell">
    <div class="panel card">
      <header>
        <div class="logo">GYJ</div>
        <div>
          <div class="name">gyj葡萄膜炎临床数据库系统</div>
          <div class="desc">本地化安全部署 · 一键管理数据表与统计分析</div>
        </div>
      </header>

      <el-form label-position="top" @keyup.enter="onSubmit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" autocomplete="current-password" show-password />
        </el-form-item>
        <div class="error" v-if="error">{{ error }}</div>
        <el-button type="primary" size="large" class="full" :loading="loading" @click="onSubmit">
          进入系统
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #eef2ff, #f8fbff);
  padding: 40px 16px;
}
.panel {
  width: min(540px, 96vw);
  padding: 32px;
}
header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.logo {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: linear-gradient(135deg, #60a5fa, #2563eb);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  letter-spacing: 0.8px;
}
.name {
  font-size: 20px;
  font-weight: 700;
}
.desc {
  color: #64748b;
}
.full {
  width: 100%;
}
.error {
  color: #e11d48;
  margin-bottom: 12px;
}
</style>
