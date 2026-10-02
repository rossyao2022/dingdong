"""Package committed runtime source only, without credentials or Commander."""
import hashlib
import io
import json
import subprocess
import tarfile
from pathlib import Path

version = "0.3.29"
commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
branch = subprocess.check_output(["git", "branch", "--show-current"], text=True).strip()
assert subprocess.check_output(["git", "show", "HEAD:VERSION"], text=True).strip() == version
archive = subprocess.check_output(
    ["git", "archive", "HEAD", "VERSION", ".dockerignore", "backend", "frontend", "deploy"]
)
out = Path("dist")
out.mkdir(exist_ok=True)
package = out / f"dingdong-v{version}.tar.gz"
count = 0
with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as source:
    with tarfile.open(package, mode="w:gz") as target:
        for member in source:
            name = member.name
            if "/docs/" in name or name.startswith(
                ("deploy/evidence/", "deploy/remote-desktop-commander/")
            ):
                continue
            if not member.isfile():
                continue
            basename = Path(name).name
            if (
                basename == ".env"
                or (basename.startswith(".env.") and basename != ".env.example")
                or basename.endswith((".pem", ".key"))
                or basename.startswith(("id_rsa", "id_ed25519"))
            ):
                raise ValueError("credential-like committed file: " + name)
            target.addfile(member, source.extractfile(member))
            count += 1
        marker = json.dumps(
            {"version": version, "branch": branch, "commit": commit}, indent=2
        ).encode() + b"\n"
        info = tarfile.TarInfo("RELEASE.json")
        info.size, info.mode = len(marker), 0o644
        target.addfile(info, io.BytesIO(marker))
sha = hashlib.sha256(package.read_bytes()).hexdigest()
(out / f"dingdong-v{version}.sha256").write_text(f"{sha}  {package.name}\n")
evidence = {
    "version": version,
    "source_commit": commit,
    "sha256": sha,
    "committed_runtime_files": count,
    "commander_files_excluded": True,
    "local_auth_checks": "backend40/frontend149/static/document gates",
    "production_functional_tests": "user_manual_acceptance",
}
Path(f"deploy/evidence/v{version}/package.json").write_text(
    json.dumps(evidence, indent=2) + "\n"
)
print(json.dumps(evidence, indent=2))
