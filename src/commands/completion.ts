/**
 * @fileoverview Shell completion scripts for bash and zsh.
 * Provides tab-completion for commands and options.
 */

import { colors, output } from '../core/output.js';

/**
 * All available commands
 */
const COMMANDS = [
  'init',
  'extract',
  'find-missing',
  'sync',
  'translate',
  'update',
  'watch',
  'diff',
  'stats',
  'clean',
  'sort',
  'validate',
  'completion',
];

/**
 * Options per command
 */
const COMMAND_OPTIONS: Record<string, string[]> = {
  extract: [
    '--mode',
    '--dry-run',
    '--file',
    '--include',
    '--locales-path',
    '--category',
    '--source-pattern',
    '--auto-getters',
  ],
  'find-missing': ['--include', '--locales-path', '--source-language'],
  sync: ['--locales-path', '--languages'],
  translate: ['--locales-path', '--from', '--to', '--batch-size', '--concurrency'],
  update: ['--locales-path', '--source', '--target', '--batch-size', '--concurrency'],
  watch: ['--include', '--locales-path', '--category', '--source-pattern', '--debounce'],
  diff: ['--locales-path', '--source', '--target', '--detailed'],
  stats: ['--locales-path', '--languages', '--show-namespaces', '--show-untranslated'],
  clean: ['--locales-path', '--include', '--languages', '--dry-run'],
  sort: ['--locales-path', '--languages', '--check'],
  validate: ['--locales-path', '--languages', '--source', '--strict'],
  completion: ['--shell'],
};

/**
 * Generate Bash completion script
 */
function generateBashCompletion(): string {
  return `# Bash completion for i18next-toolkit
# Add to ~/.bashrc or ~/.bash_profile:
# eval "$(i18next-toolkit completion --shell bash)"

_i18next_toolkit_completions() {
    local cur prev commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    # Available commands
    commands="${COMMANDS.join(' ')}"

    # If completing a command
    if [[ \${COMP_CWORD} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
        return 0
    fi

    # Command-specific options
    case "\${COMP_WORDS[1]}" in
${Object.entries(COMMAND_OPTIONS)
  .map(([cmd, opts]) => `        ${cmd})\n            COMPREPLY=( $(compgen -W "${opts.join(' ')}" -- "\${cur}") )\n            ;;`)
  .join('\n')}
        *)
            ;;
    esac

    return 0
}

complete -F _i18next_toolkit_completions i18next-toolkit
`;
}

/**
 * Generate Zsh completion script
 */
function generateZshCompletion(): string {
  return `#compdef i18next-toolkit
# Zsh completion for i18next-toolkit
# Add to ~/.zshrc:
# eval "$(i18next-toolkit completion --shell zsh)"

_i18next_toolkit() {
    local -a commands
    commands=(
${COMMANDS.map(cmd => `        '${cmd}:${getCommandDescription(cmd)}'`).join('\n')}
    )

    _arguments -C \\
        '1: :->command' \\
        '*: :->args'

    case $state in
        command)
            _describe 'command' commands
            ;;
        args)
            case $words[2] in
${Object.entries(COMMAND_OPTIONS)
  .map(
    ([cmd, opts]) =>
      `                ${cmd})\n                    _arguments ${opts.map(o => `'${o}[${getOptionDescription(o)}]'`).join(' ')}\n                    ;;`
  )
  .join('\n')}
            esac
            ;;
    esac
}

_i18next_toolkit "$@"
`;
}

/**
 * Generate Fish completion script
 */
function generateFishCompletion(): string {
  return `# Fish completion for i18next-toolkit
# Add to ~/.config/fish/completions/i18next-toolkit.fish

# Commands
${COMMANDS.map(cmd => `complete -c i18next-toolkit -n "__fish_use_subcommand" -a "${cmd}" -d "${getCommandDescription(cmd)}"`).join('\n')}

# Options per command
${Object.entries(COMMAND_OPTIONS)
  .flatMap(([cmd, opts]) =>
    opts.map(opt => `complete -c i18next-toolkit -n "__fish_seen_subcommand_from ${cmd}" -l "${opt.slice(2)}" -d "${getOptionDescription(opt)}"`)
  )
  .join('\n')}
`;
}

/**
 * Get command description for completions
 */
function getCommandDescription(cmd: string): string {
  const descriptions: Record<string, string> = {
    init: 'Create configuration file',
    extract: 'Extract strings from code',
    'find-missing': 'Find missing translation keys',
    sync: 'Sync locale structure',
    translate: 'Auto-translate empty strings',
    update: 'Sync and translate',
    watch: 'Watch for file changes',
    diff: 'Show differences between languages',
    stats: 'Show translation statistics',
    clean: 'Remove unused keys',
    sort: 'Sort keys alphabetically',
    validate: 'Validate translation files',
    completion: 'Generate shell completion',
  };
  return descriptions[cmd] || cmd;
}

/**
 * Get option description for completions
 */
function getOptionDescription(opt: string): string {
  const descriptions: Record<string, string> = {
    '--mode': 'Mode: report, extract, validate',
    '--dry-run': 'Do not save changes',
    '--file': 'Process single file',
    '--include': 'Glob pattern for files',
    '--locales-path': 'Path to locales directory',
    '--category': 'Key prefix category',
    '--source-pattern': 'Regex for source strings',
    '--auto-getters': 'Use getters for constants',
    '--source-language': 'Source language code',
    '--languages': 'Comma-separated languages',
    '--from': 'Source language',
    '--to': 'Target languages',
    '--source': 'Source language',
    '--target': 'Target languages',
    '--batch-size': 'Texts per batch',
    '--concurrency': 'Parallel requests',
    '--debounce': 'Debounce delay (ms)',
    '--detailed': 'Show detailed output',
    '--show-namespaces': 'Show namespace breakdown',
    '--show-untranslated': 'Show untranslated keys',
    '--check': 'Check only, no changes',
    '--strict': 'Treat warnings as errors',
    '--shell': 'Shell type: bash, zsh, fish',
  };
  return descriptions[opt] || opt;
}

/**
 * Options for completion command
 */
export interface CompletionOptions {
  /** Shell type: bash, zsh, or fish */
  shell?: 'bash' | 'zsh' | 'fish';
  /** Silent mode */
  silent?: boolean;
}

/**
 * Generate and output shell completion script.
 *
 * @param options - Completion options
 *
 * @example
 * ```bash
 * # Bash
 * eval "$(i18next-toolkit completion --shell bash)"
 *
 * # Zsh
 * eval "$(i18next-toolkit completion --shell zsh)"
 *
 * # Fish
 * i18next-toolkit completion --shell fish > ~/.config/fish/completions/i18next-toolkit.fish
 * ```
 */
export async function completion(options: CompletionOptions = {}): Promise<void> {
  const shell = options.shell || detectShell();

  if (!shell) {
    if (!options.silent) {
      output.header('Shell Completion');
      console.log('');
      console.log('Generate completion scripts for your shell:');
      console.log('');
      console.log(colors.bold('Bash:'));
      console.log(colors.dim('  Add to ~/.bashrc:'));
      console.log(`  ${colors.info('eval "$(i18next-toolkit completion --shell bash)"')}`);
      console.log('');
      console.log(colors.bold('Zsh:'));
      console.log(colors.dim('  Add to ~/.zshrc:'));
      console.log(`  ${colors.info('eval "$(i18next-toolkit completion --shell zsh)"')}`);
      console.log('');
      console.log(colors.bold('Fish:'));
      console.log(colors.dim('  Run:'));
      console.log(`  ${colors.info('i18next-toolkit completion --shell fish > ~/.config/fish/completions/i18next-toolkit.fish')}`);
    }
    return;
  }

  switch (shell) {
    case 'bash':
      console.log(generateBashCompletion());
      break;
    case 'zsh':
      console.log(generateZshCompletion());
      break;
    case 'fish':
      console.log(generateFishCompletion());
      break;
  }
}

/**
 * Try to detect current shell
 */
function detectShell(): 'bash' | 'zsh' | 'fish' | null {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';
  return null;
}
