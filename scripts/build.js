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
    
    const songsByCategory = {};
    for (const file of jsonFiles) {
        const songData = await fs.readJson(path.join(songsDir, file));
        const category = songData.category || "Разные Песни";
        if (!songsByCategory[category]) {
            songsByCategory[category] = [];
        }
        songsByCategory[category].push(songData);
    }

    // Sort categories
    const categories = Object.keys(songsByCategory).sort();

    let songsTex = "";
    for (const category of categories) {
        songsTex += `\\cleardoublepage\n`;
        songsTex += `\\thispagestyle{empty}\n`;
        songsTex += `\\vspace*{\\fill}\n`;
        songsTex += `{\\centering\\huge\\bfseries ${category}\\par}\n`;
        songsTex += `\\vspace*{\\fill}\n`;
        songsTex += `\\addcontentsline{toc}{chapter}{${category}}\n`;
        songsTex += `\\newpage\n`;
        
        // Sort songs in category for content
        const categorySongs = songsByCategory[category].sort((a, b) => a.name.localeCompare(b.name));

        for (const songData of categorySongs) {
            songsTex += `\\section{${songData.name}}\n`;
            songsTex += `\\label{song:${songData.name.replace(/\s+/g, '_')}}\n`;
            if (songData.performing_artist) {
                songsTex += `\\index[artists]{${songData.performing_artist}@\\textbf{${songData.performing_artist}}!${songData.name}}\n`;
            }
            songsTex += "\n";
            
            let inVerse = false;
            for (let i = 0; i < songData.lyrics.length; i++) {
                const line = songData.lyrics[i];
                const nextLine = songData.lyrics[i + 1];
    
                if (line.space || i === 0) {
                    if (inVerse) {
                        songsTex += "\\end{minipage}\\par\\medskip\\nobreak\n\n";
                    }
                    if (line.space) {
                        songsTex += "\\medskip\n\n";
                    }
                    songsTex += "\\begin{minipage}{\\linewidth}\n";
                    inVerse = true;
                }
                
                let lyricLine = line.lyric_line.replace(/[&_%$#_{}~^\\]/g, "\\$&");
                if (line.x_repeat) {
                    lyricLine = `\\textbf{${lyricLine}}`;
                }
                if (line.chorus) {
                    lyricLine = `\\hspace*{1.5em}${lyricLine}`;
                }
                
                // If the next line doesn't have "space: true", it's part of the same verse.
                // We use \\* to prevent page break.
                if (nextLine && !nextLine.space) {
                    songsTex += lyricLine + "\\\\*\n";
                } else {
                    songsTex += lyricLine + "\\\\\n";
                }
            }
            if (inVerse) {
                songsTex += "\\end{minipage}\n\n";
            }
            songsTex += "\\vspace{\\fill}\\newpage\n\n";
        }
    }
    await fs.writeFile(path.join(buildDir, "songs.tex"), songsTex);

    // Compile LaTeX
    console.log("Compiling LaTeX...");
    const latexPath = process.env.LATEX_PATH || "xelatex";
    const mainFile = "pesni.tex";
    
    // We run xelatex three times to ensure TOC, Labels, and Index are correct.
    for (let i = 1; i <= 3; i++) {
        console.log(`Compiling LaTeX (pass ${i})...`);
        await execa(latexPath, ["-interaction=batchmode", "-shell-escape", mainFile], { cwd: buildDir, stdio: "inherit" });
    }

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