print("启动中...")
import os
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
RUNDIR = os.path.dirname(os.path.abspath(__file__)) + "/"
# 设置环境变量
os.environ["HUGGINGFACE_HUB_BASE_URL"] = "https://hf-mirror.com"
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

os.environ["TEMP"] = f"{RUNDIR}temp"
os.environ["TMP"] = f"{RUNDIR}temp"
os.environ["TORCH_HOME"] = f"{RUNDIR}torch"
os.environ["MODELSCOPE_CACHE"] = f"{RUNDIR}modelscope"

os.environ["NLTK_DATA"] = f"{RUNDIR}nltk_data"

import torch
from PIL import Image
from diffsynth import save_video, VideoData, load_state_dict
from diffsynth.pipelines.wan_video_new import WanVideoPipeline, ModelConfig
from modelscope import snapshot_download
from pathlib import Path
import cv2

# 设置PATH
python_paths = [
    f"{RUNDIR}py310",
    f"{RUNDIR}py310/Scripts",
    os.environ.get("PATH", "")
]
os.environ["PATH"] = ";".join(python_paths)

# 设置PYTHONPATH
python_paths = [
    f"{RUNDIR}py310",
    os.environ.get("PYTHONPATH", "")
]
os.environ["PYTHONPATH"] = ";".join(python_paths)

import sys
import uuid
import shutil
import time
import subprocess
import argparse
import tempfile
import gradio as gr
from pathlib import Path
from datetime import datetime
from moviepy import *

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))



#合成最终视频
def DiffSynth_generate_video(mode,inputimage,animateposevideo,animatefacevideo,animate_inpaint_video,animate_mask_video,num_frames,height,width,inference_step,final_video_path,final_fps):
        
    pipe = WanVideoPipeline.from_pretrained(
        torch_dtype=torch.bfloat16,
        device="cuda",
        model_configs=[
            ModelConfig(path=[
            "./Wan2.2-Animate-14B/diffusion_pytorch_model-00001-of-00004.safetensors",
            "./Wan2.2-Animate-14B/diffusion_pytorch_model-00002-of-00004.safetensors",
            "./Wan2.2-Animate-14B/diffusion_pytorch_model-00003-of-00004.safetensors",
            "./Wan2.2-Animate-14B/diffusion_pytorch_model-00004-of-00004.safetensors",            
            ], offload_device="cpu"),
            ModelConfig(path="./Wan2.2-Animate-14B/models_t5_umt5-xxl-enc-bf16.pth", offload_device="cpu"),
            ModelConfig(path="./Wan2.2-Animate-14B/Wan2.1_VAE.pth", offload_device="cpu"),
            ModelConfig(path="./Wan2.2-Animate-14B/models_clip_open-clip-xlm-roberta-large-vit-huge-14.pth", offload_device="cpu"),
            
        ],
    )
    pipe.enable_vram_management()
    a=num_frames-4
    input_image = Image.open(inputimage)
    if mode=="animate":
        # Animate
        
        #animate_pose_video = VideoData("data/examples/wan/animate/animate_pose_video.mp4").raw_data()[:81-4]
        #animate_face_video = VideoData("data/examples/wan/animate/animate_face_video.mp4").raw_data()[:81-4]
        
        animate_pose_video = VideoData(animateposevideo).raw_data()[:a]
        animate_face_video = VideoData(animatefacevideo).raw_data()[:a]
        video = pipe(
            prompt="视频中的人在做动作",
            seed=0, tiled=True,
            input_image=input_image,
            animate_pose_video=animate_pose_video,
            animate_face_video=animate_face_video,
            num_frames=num_frames, height=height, width=width,
            num_inference_steps=inference_step, cfg_scale=1,
        )
        save_video(video,final_video_path, fps=final_fps, quality=5)              
    
    else:
        # Replace 人物替换模式
        lora_state_dict = load_state_dict("./Wan2.2-Animate-14B/relighting_lora.ckpt", torch_dtype=torch.float32, device="cuda")["state_dict"]
        pipe.load_lora(pipe.dit, state_dict=lora_state_dict)
        #input_image = Image.open(inputimage)
        animate_pose_video = VideoData(animateposevideo).raw_data()[:a]
        animate_face_video = VideoData(animatefacevideo).raw_data()[:a]
        animate_inpaint_video = VideoData(animate_inpaint_video).raw_data()[:a]
        animate_mask_video = VideoData(animate_mask_video).raw_data()[:a]
        video = pipe(
            prompt="视频中的人在做动作",
            seed=0, tiled=True,
            input_image=input_image,
            animate_pose_video=animate_pose_video,
            animate_face_video=animate_face_video,
            animate_inpaint_video=animate_inpaint_video,
            animate_mask_video=animate_mask_video,
            num_frames=num_frames, height=height, width=width,
            num_inference_steps=inference_step, cfg_scale=1,
        )
        save_video(video, final_video_path, fps=final_fps, quality=5)
        
        
    # 查找生成的视频文件
    file_path = Path(final_video_path)
    if file_path.is_file():
        return True, final_video_path
    else:
        return False, "Generated video not found"
        
#获取有效帧数字
def adjust_fps_number(n):
    return n if n % 4 == 1 else n - (n % 4 - 1) % 4
    
    
class WanAnimateApp:
    def __init__(self, ckpt_dir="./Wan2.2-Animate-14B"):
        self.ckpt_dir = ckpt_dir
        self.process_checkpoint = os.path.join(ckpt_dir, "process_checkpoint")
        
        # 创建必要的目录，输出目录
        os.makedirs("./output/process_results/animate", exist_ok=True)
        os.makedirs("./output/process_results/replace", exist_ok=True)
        
    def preprocess_data(self, video_path, refer_path, mode, resolution_area, 
                       use_flux=False, iterations=3, k=7, w_len=1, h_len=1):
        """
        预处理数据
        """
        try:
            # 根据模式确定保存路径
            if mode == "animate":
                save_path = "./output/process_results/animate"
                replace_flag = False
                retarget_flag = True
            else:  # replace mode
                save_path = "./output/process_results/replace"
                replace_flag = True
                retarget_flag = False
            
            # 构建预处理命令
            cmd = [
                "python", "./wan/modules/animate/preprocess/preprocess_data.py",
                "--ckpt_path", self.process_checkpoint,
                "--video_path", video_path,
                "--refer_path", refer_path,
                "--save_path", save_path,
                "--resolution_area", str(resolution_area[0]), str(resolution_area[1])
            ]
            
            # 添加模式特定的参数
            if mode == "animate":
                if retarget_flag:
                    cmd.append("--retarget_flag")
                if use_flux:
                    cmd.append("--use_flux")
            else:  # replace mode
                if replace_flag:
                    cmd.append("--replace_flag")
                cmd.extend(["--iterations", str(iterations)])
                cmd.extend(["--k", str(k)])
                cmd.extend(["--w_len", str(w_len)])
                cmd.extend(["--h_len", str(h_len)])
            
            # 运行预处理
            #print(f"Running preprocessing command: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                return False, f"Preprocessing failed: {result.stderr}"
            
            return True, save_path
            
        except Exception as e:
            return False, f"Preprocessing error: {str(e)}"    
  
    
    def process_and_generate(self, ref_img, video, mode, resolution_width, resolution_height,
                           use_flux, iterations, k, w_len, h_len, refert_num, use_relighting_lora):
        """
        完整的处理流程：预处理 + 生成
        """
        try:
            # 创建临时文件
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_ref:
                # 保存参考图像
                if hasattr(ref_img, 'save'):
                    ref_img.save(tmp_ref.name)
                else:
                    shutil.copy(ref_img, tmp_ref.name)
                ref_path = tmp_ref.name
            
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_vid:
                # 保存视频
                shutil.copy(video, tmp_vid.name)
                vid_path = tmp_vid.name
            
            # 步骤1: 预处理
            yield "开始预处理...", None
            resolution_area = [resolution_width, resolution_height]
            success, preprocess_result = self.preprocess_data(
                vid_path, ref_path, mode, resolution_area, use_flux, 
                iterations, k, w_len, h_len
            )
            
            if not success:
                yield f"预处理失败: {preprocess_result}", None
                return
            
            yield "第一步预处理完成，开始提取驱动视频参数...", None
            
            # 步骤2: 生成视频
            #确定预处理后的文件路径
            inputimage=preprocess_result+"/src_ref.png"
            animateposevideo=preprocess_result+"/src_pose.mp4"
            animatefacevideo=preprocess_result+"/src_face.mp4"
            animate_inpaint_video=preprocess_result+"/src_bg.mp4"
            animate_mask_video=preprocess_result+"/src_mask.mp4"
            #获取最终合成的视频帧数
            cap = cv2.VideoCapture(animateposevideo)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))            
            num_frames=adjust_fps_number(frame_count)
            height=resolution_height
            width=resolution_width
            inference_step=20
            current_time = datetime.now().strftime("%Y%m%d%H%M%S")
            final_video_path="./output/"+current_time+".mp4"
            #获取视频帧率
            final_fps=cap.get(cv2.CAP_PROP_FPS)
            yield "驱动视频参数提取完成，开始生成模仿视频...", None
            success, generation_result = DiffSynth_generate_video(mode,inputimage,animateposevideo,animatefacevideo,animate_inpaint_video,animate_mask_video,num_frames,height,width,inference_step,final_video_path,final_fps)
            #DiffSynth_generate_video(mode,inputimage,animateposevideo,animatefacevideo,animate_inpaint_video,animate_mask_video,num_frames,height,width,inference_step,final_video_path,final_fps):
            # success, generation_result = self.generate_video(
            #     preprocess_result, mode, refert_num, use_relighting_lora
            # )
            
            if not success:
                yield f"生成失败: {generation_result}", None
                return
            yield "模仿视频生成完成，开始处理音频!", None
            #提取原驱动视频中的音频
            #base_name = os.path.splitext(vid_path)[0]
            audio_output_path ="./output/"+ current_time+"_audio.mp3"
            
            # 加载视频并提取音频
            video = VideoFileClip(vid_path)
            audio = video.audio
            
            # 保存音频
            audio.write_audiofile(audio_output_path)
            
            # 释放资源
            video.close()
            audio.close()

            if os.path.exists(audio_output_path):
                output_path = "./output/"+current_time+"_final.mp4"
                
                # 加载视频和音频
                video = VideoFileClip(generation_result)
                audio = AudioFileClip(audio_output_path)
                            
                # 设置视频的音频      
                new_audioclip = CompositeAudioClip([audio])
                video.audio = new_audioclip 
                
                # 保存合并后的视频
                video.write_videofile(
                    output_path,
                    codec='libx264',
                    audio_codec='aac'
                )
                generation_result=output_path        
        
                
            
            yield "视频生成完成!", generation_result
            
            # 清理临时文件
            os.unlink(ref_path)
            os.unlink(vid_path)
            
        except Exception as e:
            yield f"处理过程中发生错误: {str(e)}", None

def create_gradio_interface():
    """创建Gradio界面"""
    
    # 初始化应用
    app = WanAnimateApp()
    
    with gr.Blocks(title="Wan2.2-Animate 视频生成工具", theme=gr.themes.Ocean()) as demo:
        gr.Markdown("# 🎬 Wan2.2-Animate-14B 动作模仿及人物替换视频生成工具")
        gr.Markdown("### 数字人 made by Shihan Qu")
        with gr.Tabs():
            with gr.TabItem("动画模式"):
                with gr.Row():
                    with gr.Column():
                        gr.Markdown("### 动画模式配置")
                        animate_ref_img = gr.Image(
                            label="参考图像 (Reference Image)",
                            type="filepath",
                            sources=["upload"],
                            height=200
                        )
                        animate_video = gr.Video(
                            label="驱动视频 (Driving Video)",
                            sources=["upload"],
                            height=200
                        )
                        
                        with gr.Row():
                            animate_res_width = gr.Number(
                                label="分辨率宽度", value=1280, precision=0
                            )
                            animate_res_height = gr.Number(
                                label="分辨率高度", value=720, precision=0
                            )
                        
                        animate_use_flux = gr.Checkbox(
                            label="使用FLUX图像编辑",
                            value=False,
                            info="推荐在参考图像或驱动视频第一帧不是标准正面姿势时使用"
                        )
                        
                        animate_refert_num = gr.Number(
                            label="时序引导帧数", value=1, precision=0,
                            info="用于时序引导的帧数，推荐1或5"
                        )
                        
                        animate_run_btn = gr.Button("🚀 开始生成动画", variant="primary")
                    
                    with gr.Column():
                        gr.Markdown("### 输出结果")
                        animate_output_video = gr.Video(label="生成的动画视频")
                        animate_status = gr.Textbox(label="处理状态", interactive=False,lines=5)
            
            with gr.TabItem("替换模式"):
                with gr.Row():
                    with gr.Column():
                        gr.Markdown("### 替换模式配置")
                        replace_ref_img = gr.Image(
                            label="参考图像 (Reference Image)",
                            type="filepath",
                            sources=["upload"],
                            height=200
                        )
                        replace_video = gr.Video(
                            label="源视频 (Source Video)",
                            sources=["upload"],
                            height=200
                        )
                        
                        with gr.Row():
                            replace_res_width = gr.Number(
                                label="分辨率宽度", value=1280, precision=0
                            )
                            replace_res_height = gr.Number(
                                label="分辨率高度", value=720, precision=0
                            )
                        
                        gr.Markdown("#### 掩码策略参数")
                        with gr.Row():
                            replace_iterations = gr.Number(
                                label="迭代次数", value=3, precision=0,
                                info="掩码膨胀的迭代次数"
                            )
                            replace_k = gr.Number(
                                label="核大小", value=7, precision=0,
                                info="掩码膨胀的核大小"
                            )
                        
                        with gr.Row():
                            replace_w_len = gr.Number(
                                label="W维度细分", value=1, precision=0,
                                info="沿W维度的细分数量，值越高轮廓越详细"
                            )
                            replace_h_len = gr.Number(
                                label="H维度细分", value=1, precision=0,
                                info="沿H维度的细分数量，值越高轮廓越详细"
                            )
                        
                        replace_use_relighting_lora = gr.Checkbox(
                            label="使用重光照LoRA",
                            value=False
                        )
                        
                        replace_refert_num = gr.Number(
                            label="时序引导帧数", value=1, precision=0,
                            info="用于时序引导的帧数，推荐1或5"
                        )
                        
                        replace_run_btn = gr.Button("🚀 开始角色替换", variant="primary")
                    
                    with gr.Column():
                        gr.Markdown("### 输出结果")
                        replace_output_video = gr.Video(label="替换后的视频")
                        replace_status = gr.Textbox(label="处理状态", interactive=False,lines=5)
        
        # 动画模式的事件处理
        animate_run_btn.click(
            fn=app.process_and_generate,
            inputs=[
                animate_ref_img,
                animate_video,
                gr.Text("animate", visible=False),
                animate_res_width,
                animate_res_height,
                animate_use_flux,
                gr.Number(3, visible=False),  # iterations
                gr.Number(7, visible=False),  # k
                gr.Number(1, visible=False),  # w_len
                gr.Number(1, visible=False),  # h_len
                animate_refert_num,
                gr.Checkbox(False, visible=False),  # use_relighting_lora
            ],
            outputs=[animate_status, animate_output_video]
        )
        
        # 替换模式的事件处理
        replace_run_btn.click(
            fn=app.process_and_generate,
            inputs=[
                replace_ref_img,
                replace_video,
                gr.Text("replace", visible=False),
                replace_res_width,
                replace_res_height,
                gr.Checkbox(False, visible=False),  # use_flux
                replace_iterations,
                replace_k,
                replace_w_len,
                replace_h_len,
                replace_refert_num,
                replace_use_relighting_lora,
            ],
            outputs=[replace_status, replace_output_video]
        )                    
    return demo

#def start_app():
def main():
    """启动应用"""
    parser = argparse.ArgumentParser(description="Wan2.2-Animate Gradio应用")
    parser.add_argument("--server_name", type=str, default="0.0.0.0",
                       help="服务器地址")
    parser.add_argument("--server_port", type=int, default=7861,
                       help="服务器端口")
    
    args = parser.parse_args()
    
    
    # 创建并启动Gradio应用
    demo = create_gradio_interface()
    
    demo.launch(
        server_name=args.server_name,
        server_port=args.server_port,
        inbrowser=True
    )

if __name__ == "__main__":
    try:
    #start_app()
        main()
    except Exception as e:
        with open("error.log", "w") as f:
            f.write(traceback.format_exc())
        print("程序崩溃，错误信息已保存到error.log")
        # 也可以选择将错误打印出来
        traceback.print_exc(file=sys.stdout)
        sys.exit(1)