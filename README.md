# 🎬 Multi-Noise LoRA Optimization for Wan2.2-Animate

> **Improving 2D Animated Character Fidelity and Long-Range Motion Consistency in Wan-Animate**

---

## 📌 Project Overview

**Wan-Animate** is currently one of the strongest open-source unified character animation and replacement frameworks.  
However, through extensive experimentation, we identify two critical limitations that significantly affect its generalization ability:

1. **Severe facial distortion when animating 2D characters with weakened human features**
2. **Degraded motion consistency and expressiveness in long-distance (far-view) scenes**

This project proposes a **Multi-Noise-Level Dual LoRA Optimization Strategy** built upon **Wan2.2-Animate**, targeting both issues without sacrificing the original near-view high-fidelity performance.

---

## 🚨 Observed Limitations in Wan-Animate

Although Wan-Animate performs exceptionally well in **3D realistic human animation**, we observe the following problems in broader animation scenarios:

### ❌ 2D Animated Character Degradation
- The model tends to **overfit realistic human facial priors**
- Leads to **unnatural deformation of facial structures**
- Especially severe for **anime-style or stylized 2D characters**

### ❌ Long-Range Motion Quality Collapse
- Sparse motion signals in far-view scenes
- Temporal instability and inconsistent pose trajectories
- Reduced motion expressiveness and accuracy

---

## 💡 Proposed Method: Dual LoRA with Multi-Noise-Level Optimization

We introduce a **Dual LoRA Collaborative Optimization Framework** based on **noise-level specialization** in diffusion models.

### 🔹 Low-Noise LoRA: Animated Facial Detail Preservation
- Trained at **low-noise stages**
- Suppresses forced transfer of realistic human facial priors
- Preserves **2D animation style consistency**
- Improves **expression stability** during facial motion driving

### 🔹 High-Noise LoRA: Long-Range Motion Perception Enhancement
- Trained at **high-noise stages**
- Strengthens global pose awareness and motion trajectory modeling
- Improves **temporal coherence** and **far-view motion fidelity**

> The two LoRAs operate collaboratively while remaining decoupled in noise space, enabling targeted enhancement without mutual interference.

---

## 🧪 Experimental Results

Our experiments demonstrate that the proposed method:

- ✅ Significantly improves **2D animated character stability**
- ✅ Enhances **far-view motion consistency and accuracy**
- ✅ Maintains **original near-view high-fidelity performance**
- ✅ Improves overall **multi-style and multi-scale generalization**

This provides an effective solution for extending large-scale animation diffusion models to more diverse animation domains.



