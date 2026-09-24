<template>
  <q-layout view="lHh Lpr lFf">
    <MainHeader />
    <SpookyEffects />
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import { defineComponent, ref } from "vue";
import MainHeader from "components/MainHeader.vue";
import SpookyEffects from "components/SpookyEffects.vue";

export default defineComponent({
  name: "MainLayout",
  mixins: [windowMixin],
  components: {
    MainHeader,
    SpookyEffects,
  },
});
</script>
