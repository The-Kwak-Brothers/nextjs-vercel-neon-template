{
  description = "Next Neon CI Template — pinned Node/sops/age/vercel; Docker via host daemon";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            nodePackages.npm
            sops
            age
            nodePackages.vercel
            actionlint
            shellcheck
            uv
            # docker CLI optional — prefer host docker on PATH for daemon socket.
            # See docs/nix-ci.md: do not confuse with pkgs.dockerTools.
            git
            python3
            jq
            yq-go
            osv-scanner
          ];

          shellHook = ''
            export NEXT_TELEMETRY_DISABLED=1
            if ! command -v docker >/dev/null 2>&1; then
              echo "note: docker not on PATH — host Docker daemon required for image builds (see docs/nix-ci.md)"
            fi
          '';
        };
      });
}
