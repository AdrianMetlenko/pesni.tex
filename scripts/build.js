const { execa } = require("execa");
const fs = require("fs-extra");
const path = require("path");

async function build() {
    const buildDir = path.resolve("build");
    const srcDir = path.resolve("src");

    await fs.emptyDir(buildDir);
    await fs.copy(srcDir, buildDir);

    // Compile LilyPond files
    console.log("Compiling LilyPond files...");
    await execa("lilypond", ["-o", "music/example", "music/example.ly"], { cwd: buildDir, stdio: "inherit" });

    // Compile LaTeX
    console.log("Compiling LaTeX (pass 1)...");
    const pdflatexPath = process.env.PDFLATEX_PATH || "pdflatex";
    await execa(pdflatexPath, ["-interaction=nonstopmode", "main.tex"], { cwd: buildDir, stdio: "inherit" });
    console.log("Compiling LaTeX (pass 2)...");
    await execa(pdflatexPath, ["-interaction=nonstopmode", "main.tex"], { cwd: buildDir, stdio: "inherit" }); // run twice for TOC etc.

    console.log("PDF generated in build/");
    console.log("Cleaning up...");
    
    // Create index.html redirecting to the PDF
    const indexContent = `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="refresh" content="0; url=main.pdf" />
    <title>Redirecting to PDF...</title>
  </head>
  <body>
    <p>If you are not redirected, <a href="main.pdf">click here to view the PDF</a>.</p>
  </body>
</html>`;
    await fs.writeFile(path.join(buildDir, "index.html"), indexContent);
    console.log("index.html redirect created in build/");

    // Add .nojekyll to ensure GitHub Pages serves the files correctly
    await fs.ensureFile(path.join(buildDir, ".nojekyll"));
    console.log(".nojekyll created in build/");
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});