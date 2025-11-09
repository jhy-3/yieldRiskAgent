#!/bin/bash

echo "🔧 彻底清理所有 Hardhat 相关进程和端口"
echo "=" 

# 1. 关闭所有 hardhat 进程
echo "1️⃣  关闭 hardhat 进程..."
pkill -9 -f "hardhat node" 2>/dev/null && echo "   ✅ 已关闭" || echo "   ℹ️  未找到 hardhat 进程"

# 2. 关闭占用 8545 端口的进程
echo ""
echo "2️⃣  释放 8545 端口..."
PID_8545=$(lsof -ti :8545 2>/dev/null)
if [ ! -z "$PID_8545" ]; then
    kill -9 $PID_8545 2>/dev/null && echo "   ✅ 已关闭进程: $PID_8545" || sudo kill -9 $PID_8545 && echo "   ✅ 已关闭进程: $PID_8545 (需要 sudo)"
else
    echo "   ℹ️  8545 端口未被占用"
fi

# 3. 关闭占用 8546 端口的进程
echo ""
echo "3️⃣  释放 8546 端口..."
PID_8546=$(lsof -ti :8546 2>/dev/null)
if [ ! -z "$PID_8546" ]; then
    kill -9 $PID_8546 2>/dev/null && echo "   ✅ 已关闭进程: $PID_8546" || sudo kill -9 $PID_8546 && echo "   ✅ 已关闭进程: $PID_8546 (需要 sudo)"
else
    echo "   ℹ️  8546 端口未被占用"
fi

# 4. 检查常用端口范围 8545-8550
echo ""
echo "4️⃣  检查其他可能被占用的端口..."
for port in 8547 8548 8549 8550; do
    PID=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        kill -9 $PID 2>/dev/null && echo "   ✅ 已关闭端口 $port (进程: $PID)"
    fi
done

# 5. 验证端口状态
echo ""
echo "5️⃣  验证端口状态..."
echo ""
for port in 8545 8546 8547; do
    if lsof -i :$port > /dev/null 2>&1; then
        echo "   ❌ 端口 $port 仍被占用"
        lsof -i :$port
    else
        echo "   ✅ 端口 $port 可用"
    fi
done

echo ""
echo "="
echo "✅ 清理完成！现在可以运行: npm run node"
echo ""
