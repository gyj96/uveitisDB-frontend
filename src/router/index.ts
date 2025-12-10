import { createRouter, createWebHashHistory } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import LoginView from '@/views/LoginView.vue';
import DashboardView from '@/views/DashboardView.vue';
import TableDesigner from '@/views/TableDesigner.vue';
import DataBoard from '@/views/DataBoard.vue';
import AnalyticsView from '@/views/AnalyticsView.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/',
      redirect: '/dashboard',
      component: () => import('@/views/ShellView.vue'),
      children: [
        { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true } },
        { path: '/tables', name: 'tables', component: TableDesigner, meta: { requiresAuth: true } },
        { path: '/data', name: 'data', component: DataBoard, meta: { requiresAuth: true } },
        { path: '/analytics', name: 'analytics', component: AnalyticsView, meta: { requiresAuth: true } },
      ],
    },
  ],
});

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthed) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }
  if (to.name === 'login' && auth.isAuthed) {
    next({ name: 'dashboard' });
    return;
  }
  next();
});

export default router;
