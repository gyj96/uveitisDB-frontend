<template>
  <router-view />
  <div class="gradient-blob blob-1"></div>
  <div class="gradient-blob blob-2"></div>
</template>

<style scoped>
.gradient-blob {
  position: fixed;
  filter: blur(90px);
  opacity: 0.6;
  z-index: -1;
}
.blob-1 {
  width: 320px;
  height: 320px;
  background: #b1c8ff;
  top: 40px;
  left: 30px;
}
.blob-2 {
  width: 360px;
  height: 360px;
  background: #fdd7a1;
  bottom: 40px;
  right: 80px;
}
</style>
