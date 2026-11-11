# 飞盘动作实验室 / Disc Motion Lab

面向 175 g 极限飞盘的浏览器三维教学实验台。包含正反手、左右手镜像、基础与错误动作预设、可编辑关节关键帧、受约束手持阶段和自由飞行阶段。所有数值计算在客户端执行。

## 使用

- 选择正手或反手，播放、暂停、拖动时间轴。
- 自由 / 俯视 / 侧视 / 目标 / 轨迹 / 握盘六种相机视角。
- “完整轨迹”显示动作加全部飞行，其余视角聚焦动作。
- 参数面板调整时序、各关节角偏置、连杆长度、质量惯量、握盘变换、环境与气动参数。
- 运动指令面板编辑 `t/value` 关键帧；相位 `1` 是参考释放点。
- JSON 保存或导入完整配置，CSV 导出飞行轨迹。
- 浏览器控制台开放 `window.DiscLab`：`getConfig()`、`setConfig(config)`、`getSchema()`、`samplePose(phase)`、`simulate(config?)`。

## 坐标与单位

右手世界坐标：X 目标方向，Y 竖直向上，Z 右侧。长度 m、时间 s、质量 kg、输入角度 degree、角速度 rad/s。四元数 [x,y,z,w]。

骨盆固定位置，骨盆/胸廓分别可绕 Y 转动；肩横向与抬升、肘屈曲、前臂轴向旋转、腕出盘转轴与屈伸构成连杆链。转轴随父连杆改变。左右手采用几何镜像，轴矢量用 det(M)M 转换。

正反手盘缘到盘心的固定局部变换分别定义。始终满足 `C = G + R*r`，`|C-G| = radius`，`vC = vG + omega × (C-G)`。盘面俯仰/滚转/偏航可以独立修改。手部用接触标记表达上下关系，不模拟手指变形和接触摩擦。

## 模型层次

1. **手持：位置伺服运动学。** C1 Hermite 关键帧驱动。忽略气动力。人体质量不反过来改变已规定的轨迹。肩/肘/腕视为无质量转轴；上臂/前臂/手按 2.71%/1.62%/0.61% 体重，采用细杆转动惯量；躯干含头按 50.4% 体重合并为椭圆柱估计 yaw 惯量。这些是成人男性样本比例的教学模板，不是适用于每位混合组运动员的统一人体标准。
2. **释放：连续继承。** 用中心差分求线速度，四元数差求世界角速度；无隐藏额外自旋或方向修正。每类基准朝向只在默认参考条件校准一次，错误预设和后续修改不会自动瞄准。
3. **飞行：六自由度刚体。** 用世界角动量、单位四元数、二阶中点积分，固定步长 1/480 s。升力垂直相对气流，阻力与相对气流相反。力矩自然产生进动。关闭空气后保留重力和自由刚体转动。

气动 CL/CD/CM 采用 Hummel 2003 附录转录的 Potts/Crowther 数据，线性插值。迎角范围 −10°～30°，超范围系数截断，并在结果中提示。阻尼采用正文/作者实验室一致的 QAd 归一化形式；论文附录的自旋阻尼表达存在差异，参数仅作可调近似。省略静态自旋相关滚转力矩、马格努斯侧力、失速模型、地效、湍流、流固耦合与滚地。盘缘触地停止，最长飞行 8 秒。

基础与错误动作的角度和时间曲线均为教学构造，不是 motion capture 数据。不能从动画诊断核心力量、肌肉激活或关节负担。正常转体有助于传力，错误预设旨在比较关节参与方式。某些“抬鼻”设置可能增加位移，结果没有按好坏标签预制。

## 文件

- `lib/disc/engine.ts` — 运动学、气动、刚体积分、配置校验、序列化。
- `components/disc/Scene.tsx` — Three.js 连杆/转轴/盘面、相机与轨迹。
- `app/page.tsx` — 参数、关键帧编辑器、数据接口、图表与说明。
- `tests/physics.test.ts` — 物理不变量、镜像、释放连续、步长收敛与配置校验。

## 开发与再构建

直接运行成品只需打开 HTML 文件，不需要以下开发步骤。
修改源码后可在本目录执行 `npm install` 与 `npm run build` 重新生成单文件版本。
运行 `npm test` 验证物理不变量；`npm run typecheck` 做类型检查。
依赖均在生成时打包到文件中，运行时无 CDN、无服务器、无登录。
WebGL 无法使用时自动切换 Canvas 三维投影绘制；两种绘制模式共享同一套物理计算。

## 原始来源

- USA Ultimate, Skills and Drills, pp.5–8: https://usaultimate.org/wp-content/uploads/2020/09/Skills-and-Drills-manual_revised2019.pdf
- UC Davis Biosport 作者实验室: https://research.engineering.ucdavis.edu/biosport/sample-page/test-page-1/frisbee-flight-simulation-and-throw-biomechanics/
- Hummel, S.A. (2003), *Frisbee Flight Simulation and Throw Biomechanics*, Appendix A, pp.81–83: https://morleyfielddgc.wordpress.com/wp-content/uploads/2009/04/hummelthesis.pdf
- Potts & Crowther (2002), *Frisbee Aerodynamics*: https://doi.org/10.2514/6.2002-3150
- de Leva (1996), *Adjustments to Zatsiorsky-Seluyanov’s segment inertia parameters*: https://pubmed.ncbi.nlm.nih.gov/8872282/
- Sasakawa & Sakurai (2013), *The temporal sequence of joint kinematics in a sidearm throw of a flying disc for distance*: https://ojs.ub.uni-konstanz.de/cpa/article/view/5613/5107

这些资料支持模型结构与教学原则，不验证本产品每一组人工关键帧或完整落点预测。
