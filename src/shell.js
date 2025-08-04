import { exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Executa um comando shell de forma segura e não interativa.
 * @param {string} command - O comando a ser executado.
 * @param {string} cwd - O diretório de trabalho atual.
 * @returns {Promise<{success: boolean, output: string, error: string | null}>}
 */
async function executeCommand(command, cwd) {
  try {
    console.log(`\n🔄 Executing: ${command} in ${cwd}`);
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 segundos
      cwd,
    });

    if (stderr && !stdout) {
      console.log(`⚠️  Warning/Error:\n${stderr}`);
      return { success: false, output: null, error: stderr };
    }

    console.log(`✅ Output:\n${stdout}`);
    return { success: true, output: stdout, error: stderr || null };

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, output: null, error: error.message };
  }
}

/**
 * Executa um comando shell que pode exigir interação.
 * A interação será tratada pelo WebSocket no futuro.
 * @param {string} command - O comando a ser executado.
 * @param {string} cwd - O diretório de trabalho atual.
 * @param {function(string): void} onData - Callback para enviar dados de stdout.
 * @param {function(string): void} onError - Callback para enviar dados de stderr.
 * @returns {Promise<{success: boolean, exitCode: number}>}
 */
async function executeInteractiveCommand(command, cwd, onData, onError) {
  return new Promise((resolve) => {
    console.log(`\n🔄 Executing interactive: ${command} in ${cwd}`);
    const process = spawn("bash", ["-c", command], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
    });

    process.stdout.on("data", (data) => {
      const text = data.toString();
      onData(text);
    });

    process.stderr.on("data", (data) => {
      const text = data.toString();
      onError(text);
    });

    process.on("close", (code) => {
      console.log(`✅ Interactive command finished with code: ${code}`);
      resolve({ success: code === 0, exitCode: code });
    });

    // Timeout de 2 minutos para comandos interativos
    setTimeout(() => {
      process.kill();
      onError("Timeout - o comando interativo demorou mais de 2 minutos.");
      resolve({ success: false, exitCode: -1 });
    }, 120000);
  });
}

export { executeCommand, executeInteractiveCommand };
