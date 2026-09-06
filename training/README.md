# 双 LoRA 训练复现

本目录只保存本项目的训练策略与命令，不复制 DiffSynth Studio、diffusion-pipe、基础模型、数据集或训练输出。

## 环境

先按仓库根目录 [INSTALL.md](../INSTALL.md) 安装依赖。Linux 训练后端使用官方 [DiffSynth Studio](https://github.com/modelscope/DiffSynth-Studio)，并固定到安装文档中的提交。

## 数据格式

准备视频数据目录与 `metadata.csv`。CSV 至少包含视频路径和文本描述，具体字段遵循 DiffSynth Studio 的 [Wan 训练文档](https://github.com/modelscope/DiffSynth-Studio/blob/main/docs/en/Model_Details/Wan.md)。数据、缓存和中间特征不要提交到 Git。

## 双噪声区间训练

编辑 `run_dual_lora.sh` 顶部的路径和训练参数，然后执行：

```bash
bash training/run_dual_lora.sh
```

脚本分别生成：

- `wan22_high_noise_lora`：面向全局姿态与远景运动；
- `wan22_low_noise_lora`：面向二维角色面部和局部细节。

两个任务应使用相同数据划分与基础模型版本，分别评估后再决定推理权重。训练输出默认在 `outputs/`，已被 `.gitignore` 排除。

> DiffSynth Studio 对 Wan2.2 高/低噪声模型的边界解释依赖其内部时间步映射；脚本中的参数沿用上游 Wan2.2 I2V LoRA 示例。升级上游版本时应重新核对参数语义。
