import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'node:util';

/**
 * Insert a filesystem-safe ISO datetime before the extension. All log files are written under
 * `process.cwd()/logs`. Relative `userOutput` may include subdirectories under that root
 * (e.g. `backfill/run` → `logs/backfill/run/<stem>-<iso>.txt`). Absolute paths are coerced to
 * `logs/<stem>-<iso>.ext` and a warning is printed; the original directory is not used.
 *
 * @param {string} userOutput
 * @returns {string}
 */
export function resolveDatedOutputPath(userOutput) {
    const suffix = new Date().toISOString().replaceAll(':', '-');
    const normalized = path.normalize(userOutput.trim());
    const parsed = path.parse(normalized);
    const ext = parsed.ext || '.txt';
    const stem = parsed.name || 'output';
    const logsRoot = path.join(process.cwd(), 'logs');
    const absLogsRoot = path.resolve(logsRoot);

    let targetDir;
    if (path.isAbsolute(normalized)) {
        console.warn(
            `Warning: absolute output path was coerced to the logs directory (using stem "${stem}").`
        );
        targetDir = logsRoot;
    } else {
        const subdir = parsed.dir && parsed.dir !== '.' ? parsed.dir : '';
        targetDir = subdir ? path.join(logsRoot, subdir) : logsRoot;
    }

    const absTargetDir = path.resolve(targetDir);
    const relToLogs = path.relative(absLogsRoot, absTargetDir);
    if (relToLogs.startsWith('..') || path.isAbsolute(relToLogs)) {
        throw new Error(
            'Output path must resolve under the project logs directory (do not use ".." to escape logs/).'
        );
    }

    const fileName = `${stem}-${suffix}${ext}`;
    return path.join(absTargetDir, fileName);
}

/**
 * Send each console call to the given file as well as the real console (mirrored output).
 * @param {string} filePath
 * @returns {() => Promise<void>} endConsoleFileMirror — restores console and closes the file stream.
 */
export function createConsoleFileMirror(filePath) {
    const stream = createWriteStream(filePath, { flags: 'a' });
    const names = ['log', 'error', 'warn', 'info', 'debug'];
    const originals = Object.fromEntries(names.map((n) => [n, console[n].bind(console)]));

    function writeToFileAndConsole(name, args) {
        stream.write(format(...args) + '\n');
        originals[name](...args);
    }

    for (const name of names) {
        console[name] = (...args) => writeToFileAndConsole(name, args);
    }

    return function endConsoleFileMirror() {
        return new Promise((resolve, reject) => {
            for (const name of names) {
                console[name] = originals[name];
            }
            stream.end((err) => (err ? reject(err) : resolve()));
        });
    };
}

/**
 * Create the log directory if needed, then mirror console output to a dated file under the resolved path.
 * @param {string} outputUserPath - Value of e.g. `--output` (basename or path with optional extension).
 * @returns {Promise<{ logPath: string, endConsoleFileMirror: () => Promise<void> }>}
 */
export async function openDatedConsoleFileMirror(outputUserPath) {
    const logPath = resolveDatedOutputPath(outputUserPath);
    await mkdir(path.dirname(logPath), { recursive: true });
    const endConsoleFileMirror = createConsoleFileMirror(logPath);
    return { logPath, endConsoleFileMirror };
}
