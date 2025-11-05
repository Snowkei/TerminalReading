#!/bin/bash

# 终端阅读工具 - 发布脚本
# 此脚本用于构建、测试并发布txread到npm库

echo "=========================================="
echo "终端阅读工具 - 发布脚本"
echo "=========================================="

# 检查是否已登录npm
echo "检查npm登录状态..."
npm whoami
if [ $? -ne 0 ]; then
    echo "请先登录npm: npm login"
    exit 1
fi

# 获取当前用户名
CURRENT_USER=$(npm whoami)
echo "当前登录用户: $CURRENT_USER"

# 检查包是否存在
echo "检查包状态..."
npm view txread > /dev/null 2>&1
if [ $? -eq 0 ]; then
    # 包存在，检查权限
    echo "包已存在，检查发布权限..."
    OWNERS=$(npm owner ls txread)
    echo "当前包所有者:"
    echo "$OWNERS"
    
    # 检查当前用户是否在所有者列表中
    if echo "$OWNERS" | grep -q "$CURRENT_USER"; then
        echo "✓ 用户 $CURRENT_USER 有发布权限"
    else
        echo "✗ 用户 $CURRENT_USER 没有发布权限"
        echo "请联系包的所有者添加权限或使用有权限的账户"
        exit 1
    fi
else
    echo "包不存在，将创建新包"
fi

# 清理之前的构建
echo "清理之前的构建..."
npm run clean

# 运行测试
echo "运行测试..."
npm test

# 构建项目
echo "构建项目..."
npm run build

# 检查构建结果
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
    echo "构建失败！"
    exit 1
fi

# 设置执行权限
echo "设置执行权限..."
chmod +x dist/index.js

# 检查package.json版本号
echo "当前版本: $(node -p "require('./package.json').version")"
read -p "是否要发布此版本? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "发布已取消"
    exit 0
fi

# 发布到npm
echo "发布到npm..."
npm publish

if [ $? -eq 0 ]; then
    echo "=========================================="
    echo "发布成功！"
    echo "=========================================="
    echo "用户可以通过以下命令安装:"
    echo "npm install -g txread"
    echo ""
    echo "使用方法:"
    echo "txread --help"
    echo ""
    echo "包权限设置:"
    npm owner ls txread
    echo "=========================================="
else
    echo "发布失败！"
    exit 1
fi