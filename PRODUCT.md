# RuiC-TextPV 文字PV

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

歌词 PV 创作者，也包括第一次打开工具、希望直接生成成片的其他用户。

## Product Purpose

输入歌词与可选音乐，在浏览器内自动编排文字 PV，预览后导出 MP4 或 PNG。首次使用应能直接看懂如何成片，成片的文字运动和节奏需要有冲击力。

## Operating Context

用户编辑歌词、载入本地音乐、预览镜头，必要时逐句调整时间、版式和演出，然后导出或保存工程。浏览器内处理歌词和音乐。

## Capabilities and Constraints

- 保留歌词语法、节拍分析和打点、逐句覆盖、随机种子、历史方案、格式设置、导出和工程存取。
- 现有项目是无框架静态 HTML、CSS、JavaScript，`build.py` 生成单文件应用。
- 文字运动与节奏感是首要质量目标，具体版式与代码由本项目独立实现。

## Brand Commitments

产品名为「RuiC-TextPV 文字PV」。用户明确要求原创视觉与独立实现，并允许重新设计现有界面组件。

## Evidence on Hand

现有源码与示例歌词均在当前项目目录中。

## Product Principles

- 首次打开就呈现可理解的歌词运动预览。
- 默认编排优先保证整体节奏与清晰可读，再提供丰富的手动控制。
- 对外使用时，核心操作应比高级设置更容易找到。
