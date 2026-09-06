# 安装与运行

推荐在 Linux 或 Windows WSL2 中运行；Windows 原生环境也可尝试。建议使用 Python 3.10/3.11、CUDA 12.x，并先按显卡环境安装匹配版本的 PyTorch。

## 1. 创建环境

```bash
python -m venv .venv
source .venv/bin/activate          # Linux / WSL
# .venv\Scripts\Activate.ps1       # Windows PowerShell
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

## 2. 第三方源码依赖

第三方源码放在 `third_party/`，该目录已被 Git 忽略。固定提交用于复现实项目开发时验证过的接口。

### DiffSynth Studio

```bash
git clone https://github.com/modelscope/DiffSynth-Studio.git third_party/DiffSynth-Studio
git -C third_party/DiffSynth-Studio checkout a30ed9093f310d068fcc3265003a2325ed07a09c
pip install -e third_party/DiffSynth-Studio
```

### SAM 2

```bash
git clone https://github.com/facebookresearch/sam2.git third_party/sam2
git -C third_party/sam2 checkout 2b90b9f5ceec907a1c18123530e92e794ad901a4
pip install -e third_party/sam2
```

SAM 2 官方建议 Python 3.10+、PyTorch 2.5.1+；Windows 用户优先使用 WSL2。其 checkpoint 不进入本仓库，由基础模型目录或官方方式下载。

## 3. 基础模型

`start.py` 默认通过 ModelScope 下载：

```text
Wan-AI/Wan2.2-Animate-14B
```

默认保存到 `./Wan2.2-Animate-14B/`。该目录中的模型权重已被 `.gitignore` 排除。若需手动下载：

```bash
modelscope download --model Wan-AI/Wan2.2-Animate-14B --local_dir ./Wan2.2-Animate-14B
```

## 4. 启动

```bash
python start.py
```

Windows 也可双击 `Start.bat`。生成结果写入 `output/`，不会被 Git 跟踪。

## 5. 训练

本仓库只保留本项目双 LoRA 策略所需的命令和配置，不复制完整训练框架。参见 [training/README.md](training/README.md)。

## 常见问题

- 找不到 `diffsynth` 或 `sam2`：确认已在当前虚拟环境执行上面的 `pip install -e`。
- CUDA/编译错误：先安装与驱动匹配的 PyTorch，再安装 SAM 2；不要让 pip 自动替换为不匹配的 CUDA 版本。
- 显存不足：降低分辨率/帧数，使用模型卸载，并避免同时加载无关模型。
