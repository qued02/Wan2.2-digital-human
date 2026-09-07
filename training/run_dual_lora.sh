#!/usr/bin/env bash
set -euo pipefail

# Edit these values for your environment.
DIFFSYNTH_ROOT="${DIFFSYNTH_ROOT:-third_party/DiffSynth-Studio}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAIN_ENTRY="$SCRIPT_DIR/train_wan22_lora.py"
export PYTHONPATH="$DIFFSYNTH_ROOT${PYTHONPATH:+:$PYTHONPATH}"
DATASET_BASE="${DATASET_BASE:-/path/to/dataset}"
DATASET_METADATA="${DATASET_METADATA:-/path/to/dataset/metadata.csv}"
OUTPUT_ROOT="${OUTPUT_ROOT:-outputs}"
HIGH_MODEL_SPECS="${HIGH_MODEL_SPECS:-Wan-AI/Wan2.2-I2V-A14B:high_noise_model/diffusion_pytorch_model*.safetensors,Wan-AI/Wan2.2-I2V-A14B:models_t5_umt5-xxl-enc-bf16.pth,Wan-AI/Wan2.2-I2V-A14B:Wan2.1_VAE.pth}"
LOW_MODEL_SPECS="${LOW_MODEL_SPECS:-Wan-AI/Wan2.2-I2V-A14B:low_noise_model/diffusion_pytorch_model*.safetensors,Wan-AI/Wan2.2-I2V-A14B:models_t5_umt5-xxl-enc-bf16.pth,Wan-AI/Wan2.2-I2V-A14B:Wan2.1_VAE.pth}"

COMMON_ARGS=(
  --dataset_base_path "$DATASET_BASE"
  --dataset_metadata_path "$DATASET_METADATA"
  --height 480
  --width 832
  --num_frames 49
  --dataset_repeat 100
  --learning_rate 1e-4
  --num_epochs 5
  --remove_prefix_in_ckpt "pipe.dit."
  --lora_base_model "dit"
  --lora_target_modules "q,k,v,o,ffn.0,ffn.2"
  --lora_rank 32
  --extra_inputs "input_image"
)

# High-noise branch: global pose and long-range motion.
accelerate launch "$TRAIN_ENTRY" \
  "${COMMON_ARGS[@]}" \
  --noise_branch high \
  --model_id_with_origin_paths "$HIGH_MODEL_SPECS" \
  --output_path "$OUTPUT_ROOT/wan22_high_noise_lora" \
  --seed 42

# Low-noise branch: facial and local-detail preservation.
accelerate launch "$TRAIN_ENTRY" \
  "${COMMON_ARGS[@]}" \
  --noise_branch low \
  --model_id_with_origin_paths "$LOW_MODEL_SPECS" \
  --output_path "$OUTPUT_ROOT/wan22_low_noise_lora" \
  --seed 42
