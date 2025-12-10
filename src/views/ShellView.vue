<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowLeft, ArrowRight, Collection, Grid, Histogram, House } from '@element-plus/icons-vue';
import { useAuthStore } from '@/store/auth';

const collapsed = ref(false);
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const menus = [
  { path: '/dashboard', icon: House, label: '首页总览' },
  { path: '/tables', icon: Collection, label: '表设计' },
  { path: '/data', icon: Grid, label: '数据管理' },
  { path: '/analytics', icon: Histogram, label: '统计分析' },
];

function handleMenu(path: string) {
  router.push(path);
}

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="shell" :style="{ gridTemplateColumns: (collapsed ? '90px' : '260px') + ' 1fr' }">
    <aside :class="['sidebar', { collapsed }]">
      <div class="brand">
        <div class="logo">GYJ</div>
        <div v-if="!collapsed" class="name">葡萄膜炎临床数据库</div>
      </div>
      <el-menu
        :default-active="route.path"
        class="menu"
        :collapse="collapsed"
        @select="handleMenu"
      >
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
      <div class="collapse-btn" @click="collapsed = !collapsed" title="折叠菜单">
        <el-icon><component :is="collapsed ? ArrowRight : ArrowLeft" /></el-icon>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="title">gyj葡萄膜炎临床数据库系统</div>
        <div class="actions">
          <el-tag type="success" effect="plain">本地化部署</el-tag>
          <el-dropdown>
            <span class="user">
              <el-avatar size="small">A</el-avatar>
              <span class="username">{{ auth.username || '管理员' }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <section class="content">
        <router-view />
      </section>
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
}
.sidebar {
  background: linear-gradient(150deg, #e8edfb, #f8fbff);
  color: #1f2937;
  position: relative;
  transition: width 0.2s ease;
  overflow: hidden;
}
.sidebar.collapsed {
  width: 90px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 18px;
}
.logo {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #60a5fa, #4f46e5);
  display: grid;
  place-items: center;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.name {
  font-weight: 600;
}
.menu :deep(.el-menu-item) {
  border-radius: 10px;
  margin: 4px 12px;
}
.menu {
  border: none;
  background: transparent;
  color: #1f2937;
  --el-menu-item-height: 50px;
}
.menu :deep(.el-menu-item.is-active) {
  background: rgba(79, 70, 229, 0.1);
}
.menu :deep(.el-menu-item) {
  border-radius: 12px;
  margin: 6px 12px;
  padding-left: 12px !important;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}
.menu :deep(.el-menu-item .el-tooltip__trigger) {
  width: 100%;
  display: flex;
  align-items: center;
}
.menu :deep(.el-menu-item .el-icon) {
  margin-right: 10px;
}
.sidebar.collapsed .menu :deep(.el-menu-item) {
  justify-content: center;
  padding: 0 !important;
  margin: 8px auto;
  width: 64px;
}
.sidebar.collapsed .menu :deep(.el-menu-item .el-tooltip__trigger) {
  justify-content: center;
  width: 100%;
  display: flex;
}
.sidebar.collapsed .menu :deep(.el-menu-item .el-icon) {
  margin-right: 0;
}
.collapse-btn {
  position: absolute;
  bottom: 16px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}
.main {
  backdrop-filter: blur(6px);
}
.topbar {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid #e5e7eb;
}
.title {
  font-weight: 700;
  letter-spacing: 0.5px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 14px;
}
.user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.content {
  padding: 18px 24px 26px;
}
@media (max-width: 1080px) {
  .shell {
    grid-template-columns: 80px 1fr;
  }
  .sidebar {
    width: 80px;
  }
  .name {
    display: none;
  }
}
</style>
