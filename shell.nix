{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  name = "order-processor-core";

  buildInputs = [
    # Runtime
    pkgs.nodejs_22       # Node.js 22 (required for node:sqlite experimental API)
    pkgs.nodePackages.pnpm  # pnpm package manager

    # Database tooling
    pkgs.sqlite          # SQLite CLI (inspect orders.db at the command line)

    # Version control & tooling
    pkgs.git

    # Optional: useful for scripts
    pkgs.python3
  ];

  shellHook = ''
    echo "Order Processor Core — dev shell"
    echo "Node: $(node --version)"
    echo "pnpm: $(pnpm --version)"
    echo ""
    echo "Quick start:"
    echo "  pnpm install"
    echo "  pnpm --filter @workspace/api-server run dev"
    echo "  pnpm --filter @workspace/order-ui    run dev"
  '';
}
