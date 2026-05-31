# Snapshot file
# Unset all aliases to avoid conflicts with functions
unalias -a 2>/dev/null || true
shopt -s expand_aliases
# Check for rg availability
if ! (unalias rg 2>/dev/null; command -v rg) >/dev/null 2>&1; then
  function rg {
  local _cc_bin="${CLAUDE_CODE_EXECPATH:-}"
  [[ -x $_cc_bin ]] || _cc_bin=/c/Users/13751/.local/bin/claude.exe
  if [[ ! -x $_cc_bin ]]; then command rg "$@"; return; fi
  if [[ -n $ZSH_VERSION ]]; then
    ARGV0=rg "$_cc_bin" "$@"
  elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    ARGV0=rg "$_cc_bin" "$@"
  elif [[ $BASHPID != $$ ]]; then
    exec -a rg "$_cc_bin" "$@"
  else
    (exec -a rg "$_cc_bin" "$@")
  fi
}
fi
export PATH='/c/Users/13751/bin:/mingw64/bin:/usr/local/bin:/usr/bin:/bin:/mingw64/bin:/usr/bin:/c/Users/13751/bin:/c/Windows/system32:/c/Windows:/c/Windows/System32/Wbem:/c/Windows/System32/WindowsPowerShell/v1.0:/c/Windows/System32/OpenSSH:/c/Program Files/dotnet:/c/Program Files/wooting-analog-sdk:/c/nodejs:/cmd:/c/Users/13751/AppData/Local/hermes/hermes-agent/venv/Scripts:/c/Users/13751/.local/bin:/c/Users/13751/AppData/Local/Programs/Python/Python313/Scripts:/c/Users/13751/AppData/Local/Programs/Python/Python313:/c/Users/13751/AppData/Local/Programs/Python/Launcher:/c/Users/13751/AppData/Local/Microsoft/WindowsApps:/c/Users/13751/AppData/Local/Programs/Ollama:/c/Users/13751/AppData/Local/Programs/Microsoft VS Code/bin:/usr/bin/vendor_perl:/usr/bin/core_perl:/c/Users/13751/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/bin:/c/Users/13751/.claude/plugins/cache/ai-research-skills/academic-writing-skills/0.1.0/bin:/c/Users/13751/.claude/plugins/cache/ai-research-skills/research-workspace/0.1.0/bin'
