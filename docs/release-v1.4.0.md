## 飞盘动作实验室 · 握持、摩擦与滑移

现在可以把「能不能握住」加入动作实验：调整握力、摩擦系数和手指位置，观察飞盘何时开始滑动、是否提前脱手，以及实际出手速度、自旋和飞行轨迹的变化。

### 这一版增加了什么

- **真实握盘开关**：开启后逐点检查静摩擦能力，超限后计算滑移与相对转动；全部接触点滑出盘缘时提前释放。关闭后保留原有动作，反算所需摩擦力和握力。
- **接触点编辑窗口**：在二维飞盘俯视图中拖动拇指、食指和中指，也可输入位置与受力权重。支持鼠标、触控和键盘微调。
- **握盘接触分析**：显示握力需求曲线、各点受力与能力、首次滑动时刻、相对位移和转角；可导出握盘 CSV 与完整模拟 JSON。
- **开放接口**：配置新增可选 `grip` 字段，增加 `analyzeGrip()` 与 `sampleState()`，可继续接入参数扫描和新的接触模型。
- **开发者发布包**：包含可编辑 TypeScript 源码、依赖锁文件、构建方法、模型说明、测试、示例配置和 MIT 许可证。

三维场景、正反手与左右手、动作预设、多轨时序、参考叠加、气动飞行、原有参数与数据导出继续保留。「真实握盘」默认关闭，旧配置导入后使用理想握持。

### 下载与使用

| 文件 | 用途 |
| --- | --- |
| [disc-motion-lab-offline-v1.4.0.html](https://github.com/345989/disc-motion-lab/releases/download/v1.4.0/disc-motion-lab-offline-v1.4.0.html) | 飞盘爱好者直接用浏览器打开，断网运行 |
| [disc-motion-lab-developer-kit-v1.4.0.zip](https://github.com/345989/disc-motion-lab/releases/download/v1.4.0/disc-motion-lab-developer-kit-v1.4.0.zip) | 希望共同开发的程序员获取源码与构建资料 |
| [SHA256SUMS.txt](https://github.com/345989/disc-motion-lab/releases/download/v1.4.0/SHA256SUMS.txt) | 校验上述两个文件的完整性 |

打开 HTML，在「握持与摩擦」中开启「真实握盘」，再点击「编辑手指接触位置」。也可导入开发者包的 `sample-configs/backhand-grip-slip.json` 或 `forehand-grip-slip.json` 开始对比。

### 模型与验证

本版采用平面有限摩擦模型：计算盘内滑移和相对转动，法向支撑、俯仰和滚转由手部理想引导。总法向力 20 N、静／动摩擦系数 0.6／0.5 为参考文献量级选择的可调初值。反算同时满足平动力和转矩，输出当前受力分配所需的握力。公式和资料见 [握持模型说明](https://github.com/345989/disc-motion-lab/blob/v1.4.0/source/GRIP_MODEL.md)。

通过 21 项模型测试及 TypeScript 检查。关闭真实握盘时，56 组配置的释放结果、指标与完整飞行数据和 v1.3.1 一致。浏览器检查覆盖接触点编辑、配置往返、旧配置导入、多轨时序、握盘 CSV、WebGL／Canvas 和桌面／手机宽度，运行时没有 HTTP 请求。详见 [验证记录](https://github.com/345989/disc-motion-lab/blob/v1.4.0/docs/validation-v1.4.0.md)。

项目继续采用 MIT 许可证。欢迎使用、分享，也欢迎带着实验数据和想法一起改进。
