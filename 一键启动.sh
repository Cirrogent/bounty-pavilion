#!/bin/bash

# ========================================
# 赏金阁网站 - 一键启动脚本
# ========================================

set -e  # 遇到错误立即退出

echo "========================================"
echo "赏金阁网站启动脚本"
echo "========================================"
echo ""

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 项目路径
PROJECT_DIR="/var/www/bounty-pavilion"

echo -e "${YELLOW}[步骤 1/5] 检查项目目录...${NC}"
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}错误：项目目录 $PROJECT_DIR 不存在${NC}"
    echo "请先上传项目文件到 $PROJECT_DIR"
    exit 1
fi
cd $PROJECT_DIR
echo -e "${GREEN}✓ 项目目录存在${NC}"
echo ""

echo -e "${YELLOW}[步骤 2/5] 检查Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误：Node.js 未安装${NC}"
    echo "请先安装Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js 版本: $NODE_VERSION${NC}"
echo ""

echo -e "${YELLOW}[步骤 3/5] 安装依赖...${NC}"
if [ ! -d "node_modules" ]; then
    echo "正在安装npm依赖..."
    npm install
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
else
    echo -e "${GREEN}✓ 依赖已存在${NC}"
fi
echo ""

echo -e "${YELLOW}[步骤 4/5] 创建必要目录...${NC}"
mkdir -p uploads/modpacks uploads/avatars logs
echo -e "${GREEN}✓ 目录创建完成${NC}"
echo ""

echo -e "${YELLOW}[步骤 5/5] 启动应用...${NC}"

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "PM2 未安装，正在安装..."
    npm install -g pm2
fi

# 检查PM2配置是否存在
if [ ! -f "ecosystem.config.js" ]; then
    echo -e "${RED}错误：PM2配置文件不存在${NC}"
    echo "请确保 ecosystem.config.js 存在"
    exit 1
fi

# 停止旧进程（如果存在）
pm2 stop bounty-pavilion 2>/dev/null || true

# 启动应用
pm2 start ecosystem.config.js --env production

# 保存PM2配置
pm2 save

echo ""
echo "========================================"
echo -e "${GREEN}✓ 启动完成！${NC}"
echo "========================================"
echo ""
echo "应用信息："
pm2 info bounty-pavilion
echo ""
echo "查看日志："
echo "pm2 logs bounty-pavilion"
echo ""
echo "查看状态："
echo "pm2 status"
echo ""
echo "停止应用："
echo "pm2 stop bounty-pavilion"
echo ""
echo "重启应用："
echo "pm2 restart bounty-pavilion"
echo ""
echo "========================================"
