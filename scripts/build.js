const { execa } = require("execa");
const fs = require("fs-extra");
const path = require("path");

async function build() {
    const buildDir = path.resolve("build");
    const srcDir = path.resolve("src");

    await fs.emptyDir(buildDir);
    await fs.copy(srcDir, buildDir);

    // Compile LilyPond files
    await execa("lilypond", ["music/example.ly"], { cwd: buildDir });

    // Compile LaTeX
    const pdflatexPath = process.env.PDFLATEX_PATH || "pdflatex";
    await execa(pdflatexPath, ["main.tex"], { cwd: buildDir });
    await execa(pdflatexPath, ["main.tex"], { cwd: buildDir }); // run twice for TOC etc.

    console.log("PDF generated in build/");
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});