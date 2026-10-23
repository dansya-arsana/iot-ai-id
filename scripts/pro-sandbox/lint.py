"""Static lint for Pro Python / MicroPython files. Reads source from stdin, prints one JSON object.
Never imports or executes the source: only ast.parse and a few name checks.
usage: python -I lint.py <python|micropython>
"""
import ast, json, sys

BANNED_CALLS = {"eval", "exec", "compile", "__import__", "open"}
BANNED_IMPORTS = {"subprocess", "socket", "ctypes", "os"}


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "python"
    src = sys.stdin.read(60000)
    diags = []

    def add(line, msg, sev="error"):
        if len(diags) < 20:
            diags.append({"line": int(line or 0), "message": msg[:400], "severity": sev})

    try:
        tree = ast.parse(src, filename="main.py")
    except SyntaxError as e:
        add(e.lineno, "SyntaxError: " + str(e.msg))
        print(json.dumps({"ok": False, "diagnostics": diags, "imports": [], "version": sys.version.split()[0]}))
        return
    imports = []
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            mods = [a.name for a in n.names]
        elif isinstance(n, ast.ImportFrom):
            mods = [n.module or ""]
        else:
            mods = []
        for m in mods:
            top = m.split(".")[0]
            imports.append(top)
            if target == "python" and top in BANNED_IMPORTS - {"os"}:
                add(n.lineno, "import " + top + " is not allowed in generated node code", "warning")
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in {"eval", "exec", "__import__"}:
            add(n.lineno, n.func.id + "() is not allowed", "error")
    defined = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
    if target == "micropython" and "machine" not in imports:
        add(1, "MicroPython node code normally imports `machine`", "warning")
    if "main" in defined and not any(isinstance(n, ast.If) for n in tree.body):
        add(1, "main() is defined but never called", "warning")
    ok = not any(d["severity"] == "error" for d in diags)
    print(json.dumps({"ok": ok, "diagnostics": diags, "imports": sorted(set(imports)), "version": sys.version.split()[0]}))


main()
