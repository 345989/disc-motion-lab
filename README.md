# 飞盘动作实验室 · Disc Motion Lab

用三维连杆拆解 175 g 极限飞盘的正反手平盘出手。从骨盆与胸廓的转动，到大臂挥动、肘部展开与手腕出盘，逐段看动作怎样传到飞盘。定格释放瞬间，还能继续观察盘速、自旋、盘面姿态和飞行轨迹。

面向 7 人制混合极限飞盘的入门教学和动作讨论。场景提供正反手握盘与左右手镜像，方便把身前推盘、躯干主导、翻掌等预设与基础动作放在同一视角对比。

## 开始实验

从 [v1.1.0 Release](https://github.com/345989/disc-motion-lab/releases/tag/v1.1.0) 下载 `disc-motion-lab-offline.html`，保存后用浏览器打开。文件内含界面、渲染和计算代码，可以断网使用。WebGL 不可用时会自动切换到 Canvas 兼容视图。

1. 选择正手或反手，播放「基础平盘参考」。拖动播放条或跳到释放瞬间，切换俯视、侧视和握盘特写。
2. 试试「身前推盘」，打开「叠加参考动作」，比较关节路径、出手速度和自旋。切换「完整轨迹」，接着看离手后的飞行。
3. 调整连杆、关节角、握点、盘面姿态、释放相位或风速。可以编辑各关节的 JSON 关键帧，并导出配置、轨迹 CSV 或完整模拟 JSON。

## 模型与开发

手持阶段用关键帧驱动三维关节链，按正反手各自的盘缘握点约束飞盘。离手时将盘心位置、姿态、线速度和角速度交给六自由度刚体模型。飞行中的升力、阻力和俯仰力矩采用 Hummel 附录收录的 Potts／Crowther 数据近似。内置动作曲线用于教学示意。公式、坐标、单位和研究来源见 [模型说明](source/MODEL.md)。

- [配置示例](sample-configs/)提供正反手参考、反手推盘和正手翻掌。
- [TypeScript 源码](source/)、构建脚本和物理测试随 v1.1 一起提供。在 `source/` 目录使用 Node.js 22.18+ 运行 `npm install` 和 `npm run build`，生成的 HTML 位于 `source/dist/`。
- 浏览器控制台的 `window.DiscLab` 提供 `getConfig()`、`setConfig(config)`、`getSchema()`、`samplePose(phase)`、`simulate(config?)`。

详见 [v1.1 发布说明](docs/release-v1.1.0.md)、[验证记录](docs/v1.1-test-report.txt)和[第三方许可](source/THIRD_PARTY_LICENSES.txt)。
