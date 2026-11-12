# 开发飞盘动作实验室

这里是生成离线 HTML 的可编辑源码。普通使用者可直接打开发布页中的 HTML；参与开发从本目录开始。

## 获取和构建

可克隆仓库，也可下载 `disc-motion-lab-developer-kit-v1.4.0.zip` 并解压。保留根目录的 `LICENSE` 与 `source/` 的相对位置，构建时会将项目许可证嵌入 HTML。

使用 **Node.js 22.18+**。在 `source/` 目录执行：

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
```

发布构建使用 pnpm 11.25.0。`pnpm-lock.yaml` 固定依赖图，便于复现；`pnpm-workspace.yaml` 已允许构建工具 esbuild 的安装脚本。也可使用 `npm install`、`npm run typecheck`、`npm test`、`npm run build`；npm 安装不会读取 pnpm 锁文件。

生成文件：

```text
source/dist/disc-motion-lab-offline-v1.4.0.html
source/dist/build-audit.json
```

用浏览器直接打开生成的 HTML 即可查看修改。版本号来自 `package.json`，可用 `node build.mjs <输出目录>` 指定生成位置。构建会检查外部 JavaScript 导入和 CSS 网络资源，并嵌入第三方许可。首次安装开发依赖需要联网；生成的 HTML 在运行时不需要联网、服务器或 CDN。

## 依赖

| 包 | 版本 | 用途 |
| --- | --- | --- |
| React / React DOM | 19.2.6 | 参数面板、图表和交互状态 |
| Three.js | 0.180.0 | 三维数学、WebGL 场景、相机控制 |
| lucide-react | 1.31.0 | 界面图标 |
| esbuild | 0.28.0 | 将 TypeScript、React 和依赖打包成单文件 |
| TypeScript | 5.9.3 | 静态类型检查 |

类型声明包的版本见 `package.json`；完整传递依赖见锁文件。没有新增运行时依赖来实现握持模型。依赖许可证与源码链接见 [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt) 和 [MODEL.md](MODEL.md#开发与再构建)。

## 从哪里修改

| 文件 | 职责 |
| --- | --- |
| `lib/disc/engine.ts` | 三维关节链、动作预设、释放、气动、刚体飞行、配置校验 |
| `lib/disc/grip.ts` | 接触布局、反算受力、有限摩擦、滑移、脱手 |
| `lib/disc/timing.ts` | 各关节轨道的相对时序变换 |
| `components/disc/Scene.tsx` | WebGL 视图 |
| `components/disc/canvas-renderer.ts` | Canvas 三维兼容绘制 |
| `components/disc/GripPanel.tsx` | 握盘参数、接触点弹窗、分析图表 |
| `components/disc/MotionEditor.tsx` | 多轨拖动、缩放及数值编辑 |
| `app/page.tsx` | 页面组合、公共 API、数据导入导出 |
| `app/*.css` | 页面与各编辑器样式 |
| `tests/physics.test.ts` / `tests/grip.test.ts` | 物理性质与兼容性测试 |
| `build.mjs` | 单文件构建和依赖审计 |

两种渲染器共享同一份模拟结果。修改飞盘实际运动显示时，两边都使用 `discStateAt()`；手臂仍由 `samplePose()` 驱动。地址后加 `?renderer=canvas` 可直接检查兼容视图。

## 在浏览器中做参数实验

```js
const c = DiscLab.getConfig();
c.grip.enabled = true;
c.grip.normalForce = 25;
c.grip.staticFriction = 0.6;
c.grip.kineticFriction = 0.5;
c.grip.contacts[1].v = 0.2;
DiscLab.setConfig(c);

const result = DiscLab.simulate();
console.log(result.grip.firstSlipTime, result.releaseTime);
console.table(result.grip.samples);
console.log(DiscLab.sampleState(0.5));
```

`getSchema()` 返回参数范围。`samplePose(phase)` 是预定动作，`sampleState(seconds)` 是实际飞盘状态；两者在发生滑动后有意不同。完整坐标、方程、默认参数来源和导出字段语义见 [握持模型](GRIP_MODEL.md)；运动学和飞行见 [整体模型](MODEL.md)。

## 一起开发

欢迎通过 [Issues](https://github.com/345989/disc-motion-lab/issues) 分享配置、现象和想法，或提交 Pull Request。讨论模拟结果时，附上配置 JSON、版本号和观察时刻最容易复现。

修改模型后运行类型检查和测试；修改交互后检查 WebGL、Canvas、手机宽度以及本地文件断网使用。新增配置字段应兼容缺少该字段的旧 JSON。新增物理机制建议用解析案例、守恒或耗散性质、步长收敛检验。

发布时一起提供 HTML、包含源码与构建资料的开发者 ZIP、更新说明和 `SHA256SUMS.txt`。仓库根目录只保留当前 HTML；各历史版本由对应 Git 标签和 Release 保存。

项目采用 [MIT 许可证](../LICENSE)，欢迎使用、修改、分享和参与开发。
