# 运营后台前端第三方组件（随镜像交付，不依赖公网 CDN）

本目录下的文件是运营后台使用的前端组件库产物，全部随 Docker 镜像静态资源交付。
页面不引用任何公网 CDN，离线环境也能完整渲染。

## 1. Tabler（UI 组件体系）

| 项 | 值 |
| --- | --- |
| 包名 | `@tabler/core` |
| 固定版本 | **1.5.1** |
| 许可 | MIT |
| 上游 | https://tabler.io / https://github.com/tabler/tabler |
| 取包地址 | `https://registry.npmjs.org/@tabler/core/-/core-1.5.1.tgz` |
| 落地文件 | `tabler/tabler.min.css`、`tabler/tabler.min.js` |

`tabler.min.css` 是 Tabler 自行编译的产物，内含其依赖的 Bootstrap 5.3 全部组件样式
（`.btn`、`.card`、`.table`、`.form-control`、`.form-select`、`.alert`、`.badge`、
`.modal`、`.offcanvas`、`.navbar-vertical`、`.page-header`、`.empty`、`.datagrid` 等）。
`tabler.min.js` 是 Tabler 的 JS 产物，已内含 Bootstrap 5.3 的 JS bundle
（dropdown / collapse / modal / offcanvas / tooltip / tab 等组件，依赖 `@popperjs/core`，
该依赖已被打进同一份 bundle，因此无需再单独引入）。

**不要同时再加载 Bootstrap 官方 CSS/JS**：那会与 Tabler 编译产物重复定义同一批类名，
造成样式与事件重复绑定。本项目管理约定见 `ops/README.md`。

许可原文（与 `tabler/tabler.min.css` 首部声明一致）：

```
Tabler v1.5.1 (https://tabler.io)
Copyright 2018-2026 The Tabler Authors
Copyright 2018-2026 codecalm.net Paweł Kuna
Licensed under MIT (https://github.com/tabler/tabler/blob/master/LICENSE)
```

npm 包内未随附独立 LICENSE 文件，MIT 全文见下（标准 MIT 文本）。

## 2. Tabler Icons（图标字体）

| 项 | 值 |
| --- | --- |
| 包名 | `@tabler/icons-webfont` |
| 固定版本 | **3.46.0** |
| 许可 | MIT（原文见 `tabler-icons/LICENSE.txt`） |
| 上游 | https://github.com/tabler/tabler-icons |
| 取包地址 | `https://registry.npmjs.org/@tabler/icons-webfont/-/icons-webfont-3.46.0.tgz` |
| 落地文件 | `tabler-icons/tabler-icons.min.css`、`tabler-icons/fonts/tabler-icons.woff2`、`tabler-icons/fonts/tabler-icons.woff` |

图标以 `<i class="ti ti-<name>">` 使用。字体文件按上游 CSS 的 `./fonts/...` 相对路径放置，
不要移动 `tabler-icons.min.css` 与 `fonts/` 的相对位置，否则图标会静默变成方块。

## MIT License 全文（两个包共用）

```
MIT License

Copyright (c) 2018-2026 The Tabler Authors
Copyright (c) 2020-2026 Paweł Kuna

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
