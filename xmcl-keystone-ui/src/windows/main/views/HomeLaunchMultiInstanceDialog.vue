<template>
  <v-dialog
    v-model="isShown"
    :width="500"
    persistent
  >
    <v-alert
      dense
      border="left"
      type="warning"
      prominent
    >
      <v-card
        elevation="0"
        text
        color="transparent"
      >
        <v-card-title>
          {{ t('title') }}
        </v-card-title>
        <v-card-text>
          {{ t('description') }}
        </v-card-text>
        <v-card-actions>
          <v-btn
            text
            @click="isShown = false"
          >
            {{ t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            text
            @click="launch(); isShown = false"
          >
            {{ t('confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-alert>
  </v-dialog>
</template>

<script lang=ts setup>
import { useDialog } from '../composables/dialog'
import { useLaunch } from '../composables/launch'
import { useI18n } from '/@/composables'
const { t } = useI18n()
const { isShown } = useDialog('multi-instance-launch')

const { launch } = useLaunch()
</script>

<i18n locale="en" lang="yaml">
title: Multiple Instances
description: You are launching multiple instances of Minecraft. Are you sure?
confirm: Yes, Launch
</i18n>
<i18n locale="zh-CN" lang="yaml">
title: 多实例启动
description: 你正在尝试启动多个 Minecraft，你确定么？
confirm: 是的，多实例启动
</i18n>
