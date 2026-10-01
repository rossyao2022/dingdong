import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmDialogMarkup } from "../ui-components.js";

test("确认组件使用安全焦点与独立动作，不借用全局忙碌动作", () => {
  const html = confirmDialogMarkup({
    title: "调整组合？",
    message: "旧回答保留",
    confirmLabel: "开始新的探索",
  });
  assert.match(html, /data-confirm-choice="cancel" autofocus/);
  assert.match(html, /data-confirm-choice="accept"/);
  assert.doesNotMatch(html, /data-action=/);
  assert.match(html, /role="alertdialog"/);
});

test("确认组件转义全部外部文案并保留无障碍关联", () => {
  const html = confirmDialogMarkup({
    title: "<img onerror=evil()>",
    message: "<script>evil()</script>",
    confirmLabel: '"accept"',
    cancelLabel: "<cancel>",
  });
  assert.doesNotMatch(html, /<img|<script>|<cancel>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /aria-labelledby="component-confirm-title"/);
  assert.match(html, /aria-describedby="component-confirm-message"/);
});
