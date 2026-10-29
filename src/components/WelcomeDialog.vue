<template>
  <q-dialog
    class="z-top"
    persistent
    v-model="showWelcomeDialog"
    position="top"
    @drop="dragFile"
    @dragover="allowDrop"
    backdrop-filter="blur(2px) brightness(60%)"
  >
    <q-card class="q-pa-lg z-top qcard welcome-card">
      <div class="text-center">
        <div class="welcome-card__emoji" aria-hidden="true">🎃</div>
        <div class="spooky-title welcome-card__title">Snickerbar</div>
        <div class="welcome-card__lead">
          A bitcoin ecash wallet that prints Halloween treats
        </div>
      </div>
      <q-list class="q-mt-md">
        <q-item class="q-px-none">
          <q-item-section avatar class="welcome-card__icon">📲</q-item-section>
          <q-item-section>
            <q-item-label><b>Add it to your home screen</b></q-item-label>
            <q-item-label caption class="welcome-card__caption"
              >Safari: tap Share, then Add to Home Screen. Chrome: tap ⋮, then
              Install app.</q-item-label
            >
          </q-item-section>
        </q-item>
        <q-item class="q-px-none">
          <q-item-section avatar class="welcome-card__icon">🔐</q-item-section>
          <q-item-section>
            <q-item-label><b>Back up your seed phrase</b></q-item-label>
            <q-item-label caption class="welcome-card__caption"
              >Your ecash lives in this browser. If you clear its data without a
              backup, the sats are gone. The backup words are in
              Settings.</q-item-label
            >
          </q-item-section>
        </q-item>
        <q-item class="q-px-none">
          <q-item-section avatar class="welcome-card__icon">⚠️</q-item-section>
          <q-item-section>
            <q-item-label><b>This is beta software</b></q-item-label>
            <q-item-label caption class="welcome-card__caption"
              >Use it at your own risk. It's open source (MIT) and not
              affiliated with any mint.</q-item-label
            >
          </q-item-section>
        </q-item>
      </q-list>
      <!-- wallet backup restore -->
      <input
        type="file"
        id="fileUpload"
        ref="fileUpload"
        v-on:change="onChangeFileUpload()"
      />
      <q-btn
        v-close-popup
        unelevated
        rounded
        color="primary"
        class="full-width q-mt-md welcome-card__go"
        label="Continue"
        @click="setWelcomeDialogSeen()"
      />
      <div class="row justify-center q-mt-sm">
        <q-btn
          flat
          rounded
          size="0.7rem"
          v-if="
            getPwaDisplayMode() == 'browser' && deferredPWAInstallPrompt != null
          "
          color="primary"
          @click="triggerPwaInstall()"
          >Install</q-btn
        >
        <q-btn flat rounded size="0.7rem" @click="copyText(baseURL)"
          >Copy URL</q-btn
        >
        <q-btn
          flat
          rounded
          size="0.7rem"
          color="warning"
          icon="upload_for_offline"
          @click="browseBackupFile"
          >Restore<q-tooltip
            >You can drag &amp; drop the wallet backup here!</q-tooltip
          ></q-btn
        >
      </div>
    </q-card>
  </q-dialog>
</template>
<style scoped>
#fileUpload {
  display: none;
}

.welcome-card__emoji {
  font-size: 3.2rem;
  line-height: 1;
}

.welcome-card__title {
  margin-top: 4px;
  font-size: 2.4rem;
  line-height: 1.1;
}

.welcome-card__lead {
  margin-top: 4px;
  font-size: 1rem;
  opacity: 0.85;
}

.welcome-card__icon {
  font-size: 1.6rem;
  min-width: 44px;
}

.welcome-card__caption {
  font-size: 0.85rem;
  line-height: 1.35;
}

.welcome-card__go {
  min-height: 48px;
  font-size: 1.05rem;
}
</style>
<script>
import { defineComponent } from "vue";
import { mapActions, mapState } from "pinia";
import { useMintsStore } from "stores/mints";
import { useWalletStore } from "src/stores/wallet";
import { useReceiveTokensStore } from "src/stores/receiveTokensStore";

export default defineComponent({
  name: "WelcomeDialog",
  mixins: [windowMixin],
  props: {
    welcomeDialog: Object,
    triggerPwaInstall: Function,
    setTab: Function,
    getPwaDisplayMode: Function,
    setWelcomeDialogSeen: Function,
  },
  data: function () {
    return {
      // someone who opened a treat's claim link gets to claim it first,
      // the welcome shows on their next visit
      showWelcomeDialog:
        localStorage.getItem("cashu.welcomeDialogSeen") != "seen" &&
        !useReceiveTokensStore().fromClaimLink,
      baseURL: location.origin + location.pathname,
      deferredPWAInstallPrompt: null,
    };
  },
  watch: {},
  computed: {
    ...mapState(useWalletStore, ["mnemonic"]),
  },
  methods: {
    ...mapActions(useMintsStore, ["restoreFromBackup"]),
    readFile(file) {
      let reader = new FileReader();
      reader.onload = (f) => {
        let content = f.target.result;
        let backup = JSON.parse(content);

        this.restoreFromBackup(backup);
      };
      reader.readAsText(file);
    },
    dragFile(ev) {
      ev.preventDefault();

      let files = ev.dataTransfer.files;
      let file = files[0];

      this.readFile(file);
    },
    allowDrop(ev) {
      ev.preventDefault();
    },
    onChangeFileUpload() {
      let file = this.$refs.fileUpload.files[0];

      this.readFile(file);
    },
    browseBackupFile() {
      this.$refs.fileUpload.click();
    },
  },
});
</script>
