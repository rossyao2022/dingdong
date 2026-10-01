# 发布缓存与页面启动契约

## 1. Scope / Trigger

家长原生JS在生产反向代理下升级；旧用户缓存仍新鲜时，不能让新版app引用旧版ca-link并因缺少export停在初始loading。全新Chrome上下文通过不能替代旧缓存升级验收。2026-10-01实际用户浏览器复现，v0.3.23修复。

## 2. Signatures

- VERSION与frontend/package.json/package-lock版本一致。
- index.html及七旧HTML内全部JS/CSS引用：文件名?v=<VERSION>。
- bootstrap动态import和整个静态/嵌套import图采用同一版本，包括api/ca-link/ui-components与报告依赖。
- bootstrap.startApp({load,onFailure,setTimer,clearTimer,timeout=20000})；app导出appReady=boot()，等待真实首次读取/渲染。
- startup入口失败及超时只显示手动重新加载，不自动刷新或重试业务请求。

## 3. Contracts

生产Web nginx对可变资源返回Cache-Control: no-store, max-age=0，保留既有安全头与全部Django代理前缀，不改外部CDN、存储或账号配置。HTML的独立守卫覆盖bootstrap本身无法加载；bootstrap守卫覆盖app/module导入或启动失败。正常app接管后取消入口计时，避免成功页面被兜底覆盖。新增bootstrap须进入server白名单、check和全部正式/离线Web Docker COPY清单。NFC参数只由原app boot读取清理，不为缓存修复存凭据或先丢URL。

发布成功须以容器实际镜像/APP_VERSION、迁移状态、公网version.txt和模块摘要为证据，不能仅凭部署脚本的完成文案。复制旧脚本后如保留旧版本日志标记，记录并解释该差异，保留原始日志，使用上述独立检查确认实际版本；不为修正文案重复迁移或重启已健康的服务。

## 4. Validation & Error Matrix

| 场景 | 预期 |
| --- | --- |
| 旧unversioned ca-link仍缓存，新版入口加载 | 所有新执行文件用统一版本，普通reload进入登录或已有儿童页 |
| app依赖缺少export/资源失败 | 明确加载失败和手动按钮，隐藏连接中，不泄露异常技术文字 |
| bootstrap自身404或一直未执行 | HTML独立兜底显示，不永久loading |
| 首次API读取正常或明确失败 | appReady接管，展示登录/页面或白话重试；不发送新短信 |
| NFC URL遇入口失败 | 重试仍可由原boot处理，不写本地凭据，不自动重绑 |
| 页面已正常显示 | 后续计时器不覆盖正常视图，不新增业务写入 |

## 5. Good / Base / Bad Cases

Good：真实Chrome先存旧脚本缓存，同origin切换当前静态源码，普通reload后完整版本图加载成功。

Base：新匿名Chrome看到登录，390px无横向溢出、无代码异常，预期refresh401独立记录。

Bad：只在app.js加版本而嵌套依赖未加；只给新响应加no-store却继续引用旧缓存URL；仅提供清空浏览器数据作为修复；入口自身失败时只依赖该入口的catch。

## 6. Tests Required

版本单测递归遍历HTML和真实JS依赖图并断言VERSION；检查新loader实际能随全部Docker入口发布。真实HTTP静态测试fixture允许模拟旧JS缓存与资源错误，但不得伪造业务API/登录/报告响应。浏览器必须复现旧export错误及普通reload绿色，另外验入口/app故障手动重试、NFC参数、计时器和移动布局。公网核对实际HTML、各tagged资源头和哈希，最后原受影响用户标签页普通刷新验收。

## 7. Wrong vs Correct

Wrong：全新浏览器加载成功，就声称升级后的老用户一定正常。

Correct：分别记录新上下文、真实旧缓存升级与原受影响用户标签页结果；保留原RED错误，最终版本和服务器头实际验证后才核销。
