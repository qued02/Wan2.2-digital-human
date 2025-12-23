# app.py
import os
import oss2                     # 阿里云对象存储
import sys
import uuid                     # 生成唯一ID
import shutil                   # 文件操作
import time                     # 时间处理，用于轮询等待
import gradio as gr             # 网页界面框架 - 核心依赖2
import requests                 # HTTP请求库，用于调用API - 核心依赖3

import dashscope                # 阿里云AI模型平台
from dashscope.utils.oss_utils import check_and_upload_local        # 上传文件到OSS的工具

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")                  # 从环境变量获取API密钥，这是访问阿里云服务的"通行证"
dashscope.api_key = DASHSCOPE_API_KEY


class WanAnimateApp:
    def __init__(self, url, get_url):
        self.url = url                                     # 任务提交的API地址
        self.get_url = get_url                             # 任务状态查询的API地址

    def predict(                                           # 上传到oss阿里云
        self, 
        ref_img,
        video,
        model_id,
        model,
    ):
        # Upload files to OSS if needed and get URLs
        _, image_url = check_and_upload_local(model_id, ref_img, DASHSCOPE_API_KEY)
        _, video_url = check_and_upload_local(model_id, video, DASHSCOPE_API_KEY)

        # Prepare the request payload           准备请求数据
        payload = {
            "model": model_id,
            "input": {
                "image_url": image_url,
                "video_url": video_url
            },
            "parameters": {
                "check_image": True,
                "mode": model,
            }
        }
        
        # Set up headers                    设置http请求头
        headers = {
            "X-DashScope-Async": "enable",                          # 异步处理
            "X-DashScope-OssResourceResolve": "enable",             # 允许oss读取数据   
            "Authorization": f"Bearer {DASHSCOPE_API_KEY}",         # 身份验证
            "Content-Type": "application/json"                      # 发送json数据
        }
        
        # Make the initial API request      
        url = self.url
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        
        # Check if request was successful
        if response.status_code != 200:
            raise Exception(f"Initial request failed with status code {response.status_code}: {response.text}")
        
        # Get the task ID from response     获取任务ID，阿里给这个任务的ID
        result = response.json()
        task_id = result.get("output", {}).get("task_id")
        if not task_id:
            raise Exception("Failed to get task ID from response")
        
        # Poll for results          轮询任务状态
        get_url = f"{self.get_url}/{task_id}"
        headers = {
            "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
            "Content-Type": "application/json"
        }
        
        while True:             # 无限轮询，直到任务完成或失败
            response = requests.get(get_url, headers=headers, timeout=60)
            if response.status_code != 200:
                raise Exception(f"Failed to get task status: {response.status_code}: {response.text}")
            
            result = response.json()
            print(result)
            task_status = result.get("output", {}).get("task_status")
            
            if task_status == "SUCCEEDED":
                # 任务成功，返回视频URL
                video_url = result["output"]["results"]["video_url"]
                return video_url, "SUCCEEDED"
            elif task_status == "PENDING" or task_status == "RUNNING":
                #  任务还在进行中，等待10秒再查询
                time.sleep(10)  
            else:
                # 任务失败，抛出异常
                error_msg = result.get("output", {}).get("message", "Unknown error")
                code_msg = result.get("output", {}).get("code", "Unknown code")
                print(f"\n\nTask failed: {error_msg} Code: {code_msg} TaskId: {task_id}\n\n")
                return None, f"Task failed: {error_msg} Code: {code_msg} TaskId: {task_id}"
                # raise Exception(f"Task failed: {error_msg} TaskId: {task_id}")

def start_app():
    import argparse
    parser = argparse.ArgumentParser(description="Wan2.2-Animate 视频生成工具")
    args = parser.parse_args()
    
    # API地址
    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis/"

    get_url = f"https://dashscope.aliyuncs.com/api/v1/tasks/"

    app = WanAnimateApp(url=url, get_url=get_url)

    #创建Gradio界面
    # +-----------------------------------------+
    # |         标题和介绍HTML                   |
    # +-------------------+---------------------+
    # | 输入区域          | 输出区域             |
    # | +--------------+  | +-----------------+ |
    # | | 上传图片     |  | | 显示生成的视频  | |
    # | | 上传视频     |  | | 显示状态信息    | |
    # | | 选择模式     |  | +-----------------+ |
    # | | 选择质量     |  |                     |
    # | | [生成按钮]   |  |                     |
    # | +--------------+  |                     |
    # +-------------------+---------------------+
    
    with gr.Blocks(title="Wan2.2-Animate 视频生成") as demo:
        gr.HTML("""
            
            <div style="padding: 2rem; text-align: center; max-width: 1200px; margin: 0 auto; font-family: Arial, sans-serif;">
                <h1 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem; color: #333;">
                    Wan2.2-Animate: Unified Character Animation and Replacement with Holistic Replication
                </h1>
                
                <h3 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem; color: #333;">
                    Wan2.2-Animate: 统一的角色动画和视频人物替换模型
                </h3>
                <div style="font-size: 1.25rem; margin-bottom: 1.5rem; color: #555;">
                    Tongyi Lab, Alibaba
                </div>
                <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; margin-bottom: 1rem;">
                    <!-- 第一行按钮 -->
                    <a href="https://arxiv.org/abs/2509.14055" target="_blank"
                    style="display: inline-flex; align-items: center; padding: 0.5rem 1rem; background-color: #f0f0f0; /* 浅灰色背景 */ color: #333; /* 深色文字 */ text-decoration: none; border-radius: 9999px; font-weight: 500; transition: background-color 0.3s;">
                        <span style="margin-right: 0.5rem;">📄</span> <!-- 使用文档图标 -->
                        <span>Paper</span>
                    </a>
                    <a href="https://github.com/Wan-Video/Wan2.2" target="_blank"
                    style="display: inline-flex; align-items: center; padding: 0.5rem 1rem; background-color: #f0f0f0; color: #333; text-decoration: none; border-radius: 9999px; font-weight: 500; transition: background-color 0.3s;">
                        <span style="margin-right: 0.5rem;">💻</span> <!-- 使用电脑图标 -->
                        <span>GitHub</span>
                    </a>
                    <a href="https://huggingface.co/Wan-AI/Wan2.2-Animate-14B" target="_blank"
                    style="display: inline-flex; align-items: center; padding: 0.5rem 1rem; background-color: #f0f0f0; color: #333; text-decoration: none; border-radius: 9999px; font-weight: 500; transition: background-color 0.3s;">
                        <span style="margin-right: 0.5rem;">🤗</span>
                        <span>HF Model</span>
                    </a>
                    <a href="https://www.modelscope.cn/models/Wan-AI/Wan2.2-Animate-14B" target="_blank"
                    style="display: inline-flex; align-items: center; padding: 0.5rem 1rem; background-color: #f0f0f0; color: #333; text-decoration: none; border-radius: 9999px; font-weight: 500; transition: background-color 0.3s;">
                        <span style="margin-right: 0.5rem;">🤖</span>
                        <span>MS Model</span>
                    </a>
                </div>
                <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem;">
                    <!-- 第二行按钮 -->
                    <a href="https://huggingface.co/spaces/Wan-AI/Wan2.2-Animate" target="_blank"
                    style="display: inline-flex; align-items: center; padding: 0.5rem 1rem; background-color: #f0f0f0; color: #333; text-decoration: none; border-radius: 9999px; font-weight: 500; transition: background-color 0.3s;">
                        <span style="margin-right: 0.5rem;">🤗</span>
                        <span>HF Space</span>
                    </a>
                    <a href="https://www.modelscope.cn/studios/Wan-AI/Wan2.2-Animate" target="_blank"
                    style="display: inline-flex; align-items: center; padding: 0.5rem 1rem; background-color: #f0f0f0; color: #333; text-decoration: none; border-radius: 9999px; font-weight: 500; transition: background-color 0.3s;">
                        <span style="margin-right: 0.5rem;">🤖</span>
                        <span>MS Studio</span>
                    </a>
                </div>
            </div>
            
            """)
        
        gr.HTML("""
                <details>
                    <summary>‼️Usage (使用说明)</summary>
                    
                    Wan-Animate supports two mode:
                    <ul>
                        <li>Move Mode: animate the  character in input image with movements from the input video</li>
                        <li>Mix Mode: replace the character in input video with the character in input image</li>
                    </ul>
                    
                    Wan-Animate 支持两种模式:
                    <ul>
                        <li>Move模式: 用输入视频中提取的动作，驱动输入图片中的角色</li>
                        <li>Mix模式: 用输入图片中的角色，替换输入视频中的角色</li>
                    </ul>
                    Currently, the following restrictions apply to inputs:
                    <ul> <li>Video file size: Less than 200MB</li> 
                    <li>Video resolution: The shorter side must be greater than 200, and the longer side must be less than 2048</li> 
                    <li>Video duration: 2s to 30s</li> 
                    <li>Video aspect ratio: 1:3 to 3:1</li> 
                    <li>Video formats: mp4, avi, mov</li> 
                    <li>Image file size: Less than 5MB</li> 
                    <li>Image resolution: The shorter side must be greater than 200, and the longer side must be less than 4096</li> 
                    <li>Image formats: jpg, png, jpeg, webp, bmp</li> </ul>
                    
                    当前，对于输入有以下的限制 
                    <ul>
                        <li>视频文件大小: 小于 200MB</li>
                        <li>视频分辨率： 最小边大于 200, 最大边小于2048</li>
                        <li>视频时长: 2s ~ 30s </li> 
                        <li>视频比例：1:3 ~ 3:1 </li>
                        <li>视频格式: mp4, avi, mov </li> 
                        <li>图片文件大小: 小于5MB </li>
                        <li>图片分辨率：最小边大于200，最大边小于4096 </li>
                        <li>图片格式: jpg, png, jpeg, webp, bmp </li> 
                    </ul>     
                    
                    <p> Currently, the inference quality has two variants. You can use our open-source code for more flexible configuration. </p>
                    
                    <p>当前，推理质量有两个变种。 您可以使用我们的开源代码，来进行更灵活的设置。</p>
                    
                    <ul>
                        <li> wan-pro: 25fps, 720p </li> 
                        <li> wan-std: 15fps, 720p  </li>
                    </ul>     
                              
                </details>                
                """)

        with gr.Row():              # 创建输入矩阵
            with gr.Column():    
                ref_img = gr.Image(
                    label="Reference Image(参考图像)",
                    type="filepath",        # 返回文件路径  
                    sources=["upload"],     #  只允许上传文件
                )
                
                video = gr.Video(
                    label="Template Video(模版视频)",
                    sources=["upload"],     #  只允许上传文件
                )
                
                with gr.Row():
                    model_id = gr.Dropdown(
                        label="Mode(模式)",
                        choices=["wan2.2-animate-move", "wan2.2-animate-mix"],
                        value="wan2.2-animate-move",    # 默认值
                        info=""
                    )

                    model = gr.Dropdown(
                        label="推理质量(Inference Quality)",
                        choices=["wan-pro", "wan-std"],
                        value="wan-pro",
                    )

                run_button = gr.Button("Generate Video(生成视频)")

            with gr.Column():                   # 创建输出矩阵
                output_video = gr.Video(label="Output Video(输出视频)")
                output_status = gr.Textbox(label="Status(状态)")
        
        run_button.click(                       # 绑定按钮点击事件
            fn=app.predict,                     # 点击时调用的函数
            inputs=[                            # 输入参数
                ref_img,
                video,
                model_id,
                model,
            ],
            outputs=[output_video, output_status],      #输出结果
        )

        example_data = [
            ['./examples/mov/1/1.jpeg', './examples/mov/1/1.mp4', 'wan2.2-animate-move', 'wan-pro'],
            ['./examples/mov/2/2.jpeg', './examples/mov/2/2.mp4', 'wan2.2-animate-move', 'wan-pro'],
            ['./examples/mix/1/1.jpeg', './examples/mix/1/1.mp4', 'wan2.2-animate-mix', 'wan-pro'],
            ['./examples/mix/2/2.jpeg', './examples/mix/2/2.mp4', 'wan2.2-animate-mix', 'wan-pro']
        ]

        if example_data:
            gr.Examples(
                examples=example_data,
                inputs=[ref_img, video, model_id, model],
                outputs=[output_video, output_status],
                fn=app.predict,
                cache_examples="lazy",
            )
    
    demo.queue(default_concurrency_limit=100)
    
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860
    )


if __name__ == "__main__":
    start_app()