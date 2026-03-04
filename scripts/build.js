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
    const musicDir = path.join(buildDir, "music");
    const lyFiles = (await fs.readdir(musicDir)).filter(f => f.endsWith(".ly"));
    for (const file of lyFiles) {
        const baseName = path.basename(file, ".ly");
        console.log(`Compiling ${file}...`);
        await execa("lilypond", ["-o", `music/${baseName}`, `music/${file}`], { cwd: buildDir, stdio: "inherit" });
    }

    // Generate songs.tex from JSON
    console.log("Generating songs.tex...");
    const songsDir = path.resolve("db/json_songs");
    const jsonFiles = (await fs.readdir(songsDir)).filter(f => f.endsWith(".json"));
    let songsTex = "";

    for (const file of jsonFiles) {
        const songData = await fs.readJson(path.join(songsDir, file));
        songsTex += `\\section{${songData.name}}\n`;
        songsTex += `\\index{${songData.name}}\n`;
        if (songData.category) {
            songsTex += `\\index{${songData.category}!${songData.name}}\n`;
        }
        songsTex += "\n";
        
        for (const line of songData.lyrics) {
            if (line.space) {
                songsTex += "\\medskip\n\n";
            }
            let lyricLine = line.lyric_line.replace(/[&_%$#_{}~^\\]/g, "\\$&");
            if (line.chorus) {
                lyricLine = `\\textit{${lyricLine}}`;
            }
            songsTex += lyricLine + "\\\\\n";
        }
        songsTex += "\\newpage\n\n";
    }
    await fs.writeFile(path.join(buildDir, "songs.tex"), songsTex);

    // Compile LaTeX
    console.log("Compiling LaTeX (pass 1)...");
    const latexPath = process.env.LATEX_PATH || "xelatex";
    const mainFile = "pesni.tex";
    await execa(latexPath, ["-interaction=nonstopmode", mainFile], { cwd: buildDir, stdio: "inherit" });
    console.log("Compiling Index...");
    await execa("makeindex", [mainFile.replace(".tex", ".idx")], { cwd: buildDir, stdio: "inherit" });
    console.log("Compiling LaTeX (pass 2)...");
    await execa(latexPath, ["-interaction=nonstopmode", mainFile], { cwd: buildDir, stdio: "inherit" }); // run twice for TOC etc.
    console.log("Compiling LaTeX (pass 3)...");
    await execa(latexPath, ["-interaction=nonstopmode", mainFile], { cwd: buildDir, stdio: "inherit" });

    console.log("PDF generated in build/");
    
    // Create index.html redirecting to the PDF
    const indexContent = `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="refresh" content="0; url=pesni.pdf" />
    <title>Redirecting to PDF...</title>
  </head>
  <body>
    <p>If you are not redirected, <a href="pesni.pdf">click here to view the PDF</a>.</p>
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