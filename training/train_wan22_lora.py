"""Train one noise-specialized LoRA for Wan2.2 I2V.

The pipeline integration follows DiffSynth Studio's Wan training example. This
entry point adds explicit branch selection, model/interval validation, and seed
handling for the dual-LoRA experiments in this repository.
"""

from __future__ import annotations

import os
import random
from dataclasses import dataclass

import torch
from diffsynth.pipelines.wan_video_new import ModelConfig, WanVideoPipeline
from diffsynth.trainers.unified_dataset import (
    ImageCropAndResize,
    LoadAudio,
    LoadVideo,
    ToAbsolutePath,
    UnifiedDataset,
)
from diffsynth.trainers.utils import (
    DiffusionTrainingModule,
    ModelLogger,
    launch_training_task,
    wan_parser,
)

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


@dataclass(frozen=True)
class NoiseBranch:
    model_directory: str
    min_boundary: float
    max_boundary: float


NOISE_BRANCHES = {
    "high": NoiseBranch("high_noise_model", 0.0, 0.358),
    "low": NoiseBranch("low_noise_model", 0.358, 1.0),
}


def set_experiment_seed(seed: int) -> None:
    """Seed Python and PyTorch without claiming full GPU determinism."""
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def validate_branch_configuration(args) -> NoiseBranch:
    """Resolve the branch and reject a mismatched Wan2.2 model half."""
    branch = NOISE_BRANCHES[args.noise_branch]
    model_spec = args.model_id_with_origin_paths or ""
    if model_spec and branch.model_directory not in model_spec:
        raise ValueError(
            f"The {args.noise_branch!r} branch requires model files from "
            f"{branch.model_directory!r}, but --model_id_with_origin_paths "
            "points somewhere else."
        )
    if not 0.0 <= branch.min_boundary < branch.max_boundary <= 1.0:
        raise ValueError(f"Invalid normalized timestep interval: {branch}")
    return branch


class WanDualLoraTrainingModule(DiffusionTrainingModule):
    """DiffSynth training module with an explicit normalized noise interval."""

    def __init__(
        self,
        *,
        model_paths=None,
        model_id_with_origin_paths=None,
        audio_processor_config=None,
        trainable_models=None,
        lora_base_model=None,
        lora_target_modules="q,k,v,o,ffn.0,ffn.2",
        lora_rank=32,
        lora_checkpoint=None,
        use_gradient_checkpointing=True,
        use_gradient_checkpointing_offload=False,
        extra_inputs=None,
        min_timestep_boundary=0.0,
        max_timestep_boundary=1.0,
    ):
        super().__init__()
        model_configs = self.parse_model_configs(
            model_paths,
            model_id_with_origin_paths,
            enable_fp8_training=False,
        )
        if audio_processor_config is not None:
            model_id, origin_pattern = audio_processor_config.split(":", 1)
            audio_processor_config = ModelConfig(
                model_id=model_id,
                origin_file_pattern=origin_pattern,
            )

        self.pipe = WanVideoPipeline.from_pretrained(
            torch_dtype=torch.bfloat16,
            device="cpu",
            model_configs=model_configs,
            audio_processor_config=audio_processor_config,
        )
        self.switch_pipe_to_training_mode(
            self.pipe,
            trainable_models,
            lora_base_model,
            lora_target_modules,
            lora_rank,
            lora_checkpoint=lora_checkpoint,
            enable_fp8_training=False,
        )
        self.use_gradient_checkpointing = use_gradient_checkpointing
        self.use_gradient_checkpointing_offload = use_gradient_checkpointing_offload
        self.extra_inputs = extra_inputs.split(",") if extra_inputs else []
        self.min_timestep_boundary = min_timestep_boundary
        self.max_timestep_boundary = max_timestep_boundary

    def forward_preprocess(self, data):
        inputs_positive = {"prompt": data["prompt"]}
        inputs_negative = {}
        inputs_shared = {
            "input_video": data["video"],
            "height": data["video"][0].size[1],
            "width": data["video"][0].size[0],
            "num_frames": len(data["video"]),
            "cfg_scale": 1,
            "tiled": False,
            "rand_device": self.pipe.device,
            "use_gradient_checkpointing": self.use_gradient_checkpointing,
            "use_gradient_checkpointing_offload": self.use_gradient_checkpointing_offload,
            "cfg_merge": False,
            "vace_scale": 1,
            "min_timestep_boundary": self.min_timestep_boundary,
            "max_timestep_boundary": self.max_timestep_boundary,
        }

        for key in self.extra_inputs:
            if key == "input_image":
                inputs_shared[key] = data["video"][0]
            elif key == "end_image":
                inputs_shared[key] = data["video"][-1]
            elif key in {"reference_image", "vace_reference_image"}:
                inputs_shared[key] = data[key][0]
            else:
                inputs_shared[key] = data[key]

        for unit in self.pipe.units:
            inputs_shared, inputs_positive, inputs_negative = self.pipe.unit_runner(
                unit,
                self.pipe,
                inputs_shared,
                inputs_positive,
                inputs_negative,
            )
        return {**inputs_shared, **inputs_positive}

    def forward(self, data, inputs=None):
        if inputs is None:
            inputs = self.forward_preprocess(data)
        models = {
            name: getattr(self.pipe, name) for name in self.pipe.in_iteration_models
        }
        return self.pipe.training_loss(**models, **inputs)


def build_dataset(args) -> UnifiedDataset:
    return UnifiedDataset(
        base_path=args.dataset_base_path,
        metadata_path=args.dataset_metadata_path,
        repeat=args.dataset_repeat,
        data_file_keys=args.data_file_keys.split(","),
        main_data_operator=UnifiedDataset.default_video_operator(
            base_path=args.dataset_base_path,
            max_pixels=args.max_pixels,
            height=args.height,
            width=args.width,
            height_division_factor=16,
            width_division_factor=16,
            num_frames=args.num_frames,
            time_division_factor=4,
            time_division_remainder=1,
        ),
        special_operator_map={
            "animate_face_video": ToAbsolutePath(args.dataset_base_path)
            >> LoadVideo(
                args.num_frames,
                4,
                1,
                frame_processor=ImageCropAndResize(512, 512, None, 16, 16),
            ),
            "input_audio": ToAbsolutePath(args.dataset_base_path)
            >> LoadAudio(sr=16000),
        },
    )


def build_parser():
    parser = wan_parser()
    parser.description = "Train a noise-specialized Wan2.2 I2V LoRA."
    parser.add_argument(
        "--noise_branch",
        choices=tuple(NOISE_BRANCHES),
        required=True,
        help="Select the high-noise or low-noise Wan2.2 model branch.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Experiment seed recorded for reproducibility.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    branch = validate_branch_configuration(args)
    args.min_timestep_boundary = branch.min_boundary
    args.max_timestep_boundary = branch.max_boundary
    set_experiment_seed(args.seed)

    dataset = build_dataset(args)
    model = WanDualLoraTrainingModule(
        model_paths=args.model_paths,
        model_id_with_origin_paths=args.model_id_with_origin_paths,
        audio_processor_config=args.audio_processor_config,
        trainable_models=args.trainable_models,
        lora_base_model=args.lora_base_model,
        lora_target_modules=args.lora_target_modules,
        lora_rank=args.lora_rank,
        lora_checkpoint=args.lora_checkpoint,
        use_gradient_checkpointing_offload=args.use_gradient_checkpointing_offload,
        extra_inputs=args.extra_inputs,
        min_timestep_boundary=branch.min_boundary,
        max_timestep_boundary=branch.max_boundary,
    )
    model_logger = ModelLogger(
        args.output_path,
        remove_prefix_in_ckpt=args.remove_prefix_in_ckpt,
    )
    launch_training_task(dataset, model, model_logger, args=args)


if __name__ == "__main__":
    main()
