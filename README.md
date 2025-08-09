# Shogi MCP Server

将棋AIエンジンのHTTP APIブリッジおよびMCP（Model Context Protocol）サーバー実装です。

## 概要

このプロジェクトは、ネイティブの将棋エンジンバイナリをラップし、以下の2つのインターフェースを提供します：

- **HTTP API Bridge**: HTTPエンドポイント経由での将棋局面解析
- **MCP Server**: AIエージェント統合のためのModel Context Protocolサーバー

## 必要要件

- Node.js 18.0.0以上
- USIプロトコル対応の将棋エンジン
- 評価関数ファイル（nn.bin）

## インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd shogi-mcp

# 依存関係のインストール
npm install
```

## セットアップ

1. 将棋エンジンバイナリを `engine/engine` に配置
2. 評価関数ファイルを `eval/nn.bin` に配置

## 使用方法

### ブリッジサーバーの起動

```bash
npm run start:bridge
```

デフォルトでポート8787で起動します。

#### APIエンドポイント

**GET /health**
- ヘルスチェック用エンドポイント

**GET /analyze**
- 局面解析エンドポイント

パラメータ：
- `sfen` (必須): SFEN形式の局面
- `depth`: 探索深さ（デフォルト: 30、最大: 30）
- `multipv`: 候補手の数（デフォルト: 10、最大: 10）
- `threads`: 使用スレッド数（デフォルト: 1、最大: 8）
- `forceMove`: 指定した手を指した後の局面を解析

例：
```bash
curl "http://localhost:8787/analyze?sfen=lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL%20b%20-%201&depth=20&multipv=5"
```

### MCPサーバーの起動

```bash
npm run start:mcp
```

MCPサーバーはstdio経由で通信し、以下のツールを提供します：

- `ping`: 疎通確認
- `analyze`: 局面の完全解析（MultiPV）
- `eval_at`: 特定の手を指した後の局面評価

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|--------------|
| `ENGINE_PATH` | 将棋エンジンのパス | `./engine/engine` |
| `PORT` | ブリッジサーバーのポート | `8787` |
| `REST_BASE` | MCPサーバーが使用するブリッジAPIのベースURL | `http://localhost:8787` |
| `DEBUG` | エンジン通信のデバッグログを有効化（"1"で有効） | - |
| `EVAL_FILE` | 評価関数ファイルのパス | - |
| `EVAL_DIR` | 評価関数ディレクトリのパス | - |

## プロジェクト構成

```
shogi-mcp/
├── src/
│   ├── core/
│   │   └── engine.js         # USIプロトコルエンジンラッパー
│   └── servers/
│       ├── bridge-server.js  # Express HTTP APIブリッジサーバー
│       └── mcp-server.mjs    # MCPサーバー実装
├── engine/
│   └── engine                # 将棋エンジンバイナリ
├── eval/
│   └── nn.bin               # 評価関数(NNUEで実装)
├── package.json
└── README.md        
```

## 開発

### テスト

ブリッジAPIのテスト例：

```bash
# ヘルスチェック
curl http://localhost:8787/health

# 初期局面の解析
curl "http://localhost:8787/analyze?sfen=startpos&depth=15&multipv=3"
```

## トラブルシューティング

### 評価関数が読み込めない場合

環境変数で明示的にパスを指定してください：

```bash
EVAL_FILE=./eval/nn.bin EVAL_DIR=./eval npm run start:bridge
```

### エンジンが起動しない場合

1. エンジンバイナリの実行権限を確認
```bash
chmod +x engine/engine
```

2. エンジンパスを環境変数で指定
```bash
ENGINE_PATH=/path/to/engine npm run start:bridge
```

## ライセンス

MIT