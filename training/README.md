# Dual-LoRA Training

This directory contains executable training code for the project's two noise-specialized LoRAs. It depends on the official [DiffSynth Studio](https://github.com/modelscope/DiffSynth-Studio) package instead of vendoring that repository.

## Files

- `train_wan22_lora.py`: the project-owned training entry point. It builds the dataset, configures the Wan pipeline, injects LoRA layers, validates the selected noise branch, and launches training.
- `run_dual_lora.sh`: launches the high-noise and low-noise jobs sequentially with matching hyperparameters.
- `metadata.example.csv`: a minimal dataset metadata example.

## Setup

Follow [`../INSTALL.md`](../INSTALL.md) first. The pinned DiffSynth Studio checkout must be installed into the active Python environment:

```bash
pip install -e third_party/DiffSynth-Studio
```

Place training videos under one dataset directory and create a metadata CSV. Paths in the CSV are relative to `--dataset_base_path`.

```csv
video,prompt
videos/clip_001.mp4,"A full-body character walks across a wide shot."
```

## Train both branches

```bash
export DATASET_BASE=/data/wan22
export DATASET_METADATA=/data/wan22/metadata.csv
bash training/run_dual_lora.sh
```

The launcher creates:

- `outputs/wan22_high_noise_lora`: high-noise branch for global pose and long-range motion.
- `outputs/wan22_low_noise_lora`: low-noise branch for faces and local details.

Override any path without editing the script:

```bash
DIFFSYNTH_ROOT=/opt/DiffSynth-Studio \
OUTPUT_ROOT=/data/experiments \
bash training/run_dual_lora.sh
```

## Train one branch

The Python entry point can be called directly:

```bash
accelerate launch training/train_wan22_lora.py \
  --noise_branch high \
  --dataset_base_path /data/wan22 \
  --dataset_metadata_path /data/wan22/metadata.csv \
  --model_id_with_origin_paths "Wan-AI/Wan2.2-I2V-A14B:high_noise_model/diffusion_pytorch_model*.safetensors,Wan-AI/Wan2.2-I2V-A14B:models_t5_umt5-xxl-enc-bf16.pth,Wan-AI/Wan2.2-I2V-A14B:Wan2.1_VAE.pth" \
  --output_path outputs/wan22_high_noise_lora \
  --height 480 --width 832 --num_frames 49 \
  --lora_base_model dit --lora_rank 32 \
  --extra_inputs input_image
```

`--noise_branch` sets and validates the correct model half and timestep interval:

| Branch | Model directory | Boundary interval | Research target |
| --- | --- | --- | --- |
| `high` | `high_noise_model` | `[0.000, 0.358]` | global motion and distant poses |
| `low` | `low_noise_model` | `[0.358, 1.000]` | facial and local-detail stability |

These normalized boundaries follow DiffSynth Studio's Wan2.2 I2V example and its internal timestep mapping. Re-check them before upgrading the pinned upstream revision.

## Reproducibility notes

- Keep the dataset split, base-model revision, resolution, frame count, LoRA rank, and optimizer settings identical between branches.
- Use `--seed` to record the experiment seed. GPU kernels can still introduce nondeterminism.
- Checkpoints, cached latents, downloaded models, and outputs are intentionally ignored by Git.
- Run `python training/train_wan22_lora.py --help` to inspect all upstream and project-specific options.
