#!/bin/bash
# Script de instalação da extensão Cappy para macOS/Linux
# Este script compila, empacota e instala a extensão no VS Code

set -e  # Encerra em caso de erro

echo "=================================="
echo "Cappy Framework - Instalação"
echo "=================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Verifica se o Node.js está instalado
echo -e "${YELLOW}Verificando Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERRO: Node.js não está instalado!${NC}"
    echo -e "${RED}Por favor, instale o Node.js em https://nodejs.org${NC}"
    exit 1
fi

# Verifica se o VS Code está instalado
echo -e "${YELLOW}Verificando VS Code...${NC}"
if ! command -v code &> /dev/null; then
    echo -e "${RED}ERRO: VS Code não está instalado ou não está no PATH!${NC}"
    echo -e "${RED}Por favor, instale o VS Code em https://code.visualstudio.com${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dependências OK${NC}"
echo ""

# Clean previous build artifacts
echo -e "${YELLOW}Limpando artefatos anteriores (out/, dist/)...${NC}"
rm -rf out dist || true

# Build UI and extension
echo -e "${YELLOW}Compilando (tsc + vite)...${NC}"
npm run build
echo -e "${YELLOW}Compilando entrada da extensão...${NC}"
npm run compile-extension
echo -e "${GREEN}✓ Compilação concluída${NC}"
echo ""

# Detecta o sistema operacional
OS="$(uname -s)"
case "${OS}" in
    Darwin*)
        PLATFORM="darwin"
        echo -e "${YELLOW}Detectado: macOS${NC}"
        ;;
    Linux*)
        PLATFORM="linux"
        echo -e "${YELLOW}Detectado: Linux${NC}"
        ;;
    *)
        echo -e "${RED}Sistema operacional não suportado: ${OS}${NC}"
        exit 1
        ;;
esac

# Package para a plataforma detectada
echo -e "${YELLOW}Empacotando extensão para ${PLATFORM}...${NC}"
npm run package:${PLATFORM}
echo -e "${GREEN}✓ Empacotamento concluído${NC}"
echo ""

# Encontra o arquivo .vsix gerado (considera arquitetura no macOS)
ARCH="$(uname -m)"
VSIX_GLOB=""
if [ "$PLATFORM" = "darwin" ]; then
    # Mapear arquitetura para sufixo do pacote
    if [ "$ARCH" = "arm64" ]; then
        VSIX_GLOB="cappy-*-darwin-arm64.vsix"
    else
        VSIX_GLOB="cappy-*-darwin-x64.vsix"
    fi
elif [ "$PLATFORM" = "linux" ]; then
    VSIX_GLOB="cappy-*-linux.vsix"
else
    VSIX_GLOB="cappy-*.vsix"
fi

# Pegar o arquivo mais recente pelo timestamp
VSIX_FILE=$(ls -t ${VSIX_GLOB} 2>/dev/null | head -n 1)

if [ -z "$VSIX_FILE" ]; then
        echo -e "${RED}ERRO: Arquivo .vsix não encontrado!${NC}"
        echo -e "${YELLOW}Dica:${NC} Verifique os arquivos gerados com: ls -l cappy-*.vsix"
        exit 1
fi

# Instala a extensão
echo -e "${YELLOW}Instalando extensão ${VSIX_FILE}...${NC}"
code --install-extension "$VSIX_FILE" --force

echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}✓ Instalação concluída com sucesso!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo -e "${CYAN}Reinicie o VS Code para ativar a extensão.${NC}"
