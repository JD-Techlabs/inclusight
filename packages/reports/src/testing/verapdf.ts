import { execFile } from "node:child_process";
import { basename, dirname } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Pinned veraPDF image used when no local veraPDF is installed (tests and CI only). */
export const VERAPDF_IMAGE = "verapdf/cli:v1.30.3";

type Runner = { kind: "bin"; bin: string } | { kind: "docker" };

/** VERAPDF_BIN (a local veraPDF CLI) if set, else Docker if it is running, else null. */
export async function findVeraPdf(): Promise<Runner | null> {
  if (process.env.VERAPDF_BIN) return { kind: "bin", bin: process.env.VERAPDF_BIN };
  try {
    await run("docker", ["image", "inspect", VERAPDF_IMAGE], { timeout: 20_000 });
    return { kind: "docker" };
  } catch {
    try {
      await run("docker", ["pull", VERAPDF_IMAGE], { timeout: 300_000 });
      return { kind: "docker" };
    } catch {
      return null;
    }
  }
}

export type PdfUaResult = { file: string; compliant: boolean; failures: string[] };

type VeraJob = {
  itemDetails: { name: string };
  validationResult: Array<{
    compliant: boolean;
    details: {
      ruleSummaries: Array<{
        clause: string;
        testNumber: number;
        description: string;
        failedChecks: number;
      }>;
    };
  }>;
};

/** Validates PDFs (all in one directory) against PDF/UA-1. */
export async function validatePdfUa(runner: Runner, files: string[]): Promise<PdfUaResult[]> {
  const dir = dirname(files[0]!);
  const args = ["--flavour", "ua1", "--format", "json"];
  const { stdout } =
    runner.kind === "bin"
      ? await run(runner.bin, [...args, ...files], { maxBuffer: 64 * 1024 * 1024 }).catch((e) => e)
      : await run(
          "docker",
          [
            "run",
            "--rm",
            "-v",
            `${dir}:/data`,
            VERAPDF_IMAGE,
            ...args,
            ...files.map((f) => `/data/${basename(f)}`),
          ],
          { maxBuffer: 64 * 1024 * 1024, timeout: 300_000 },
        ).catch((e) => e); // veraPDF exits non-zero when a file is not compliant
  const jobs = (JSON.parse(String(stdout)) as { report: { jobs: VeraJob[] } }).report.jobs;
  return jobs.map((job) => {
    const result = job.validationResult[0]!;
    return {
      file: basename(job.itemDetails.name),
      compliant: result.compliant,
      failures: result.details.ruleSummaries
        .filter((r) => r.failedChecks > 0)
        .map((r) => `${r.clause}-${r.testNumber} (${r.failedChecks}×): ${r.description}`),
    };
  });
}
