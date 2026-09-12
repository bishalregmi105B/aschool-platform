#!/usr/bin/env node
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const postcss = require("postcss");
const plugins = [
  require("cssnano"),
  require("autoprefixer"),
  require("postcss-import"),
  require("postcss-nested"),
  require("postcss-calc"),
  require("postcss-base64")({
    root: process.cwd() + "/gui",
    extensions: [".png", ".svg", ".gif"],
  }),
];

const { version } = require("./package.json");

/**
 * Build primary CSS files
 */
async function buildCSS({ usePrefix, useInlineVars } = {}) {
  const input = `/*! 11.css v${version} - Windows 11 Fluent Design System */\n` + fs.readFileSync("gui/index.scss");

  let targetFile = "dist/11.css";
  let parser = postcss(plugins);

  if (usePrefix) {
    targetFile = "dist/11.scoped.css";
    parser = postcss([
      ...plugins,
      require("postcss-prefix-selector")({
        prefix: ".win11",
        transform: (prefix, selector, prefixed) => {
          if ("body" === selector) return selector + prefix;
          if (":root" === selector) return prefix;
          // Theme markers live on the same element as the .win11 scope root,
          // so they must compose (`.win11[data-theme=dark]`), not descend.
          const themeAttr = /^\[data-theme=(?:"|')?(dark|light)(?:"|')?\]/;
          if (themeAttr.test(selector)) {
            return prefix + selector.replace(themeAttr, "[data-theme=$1]");
          }
          if (selector === ".dark" || selector === "body.dark") return prefix + ".dark";
          return prefixed;
        },
      }),
    ]);
  }
  if (useInlineVars) {
    targetFile = "dist/11.inline.css";
    parser = postcss([...plugins, require("postcss-css-variables")]);
  }

  const result = await parser.process(input, {
    from: "gui/index.scss",
    to: targetFile,
    map: { inline: false },
  });

  mkdirp.sync("dist");
  fs.writeFileSync(targetFile, result.css);
  fs.writeFileSync(targetFile + ".map", result.map.toString());

  // Also write aliases for Windows 11 & AOS styling
  if (!usePrefix && !useInlineVars) {
    fs.writeFileSync("dist/win11.css", result.css);
    fs.writeFileSync("dist/win11.css.map", result.map.toString());
  }
  if (usePrefix) {
    fs.writeFileSync("dist/11.scoped.css", result.css);
  }
  if (useInlineVars) {
    fs.writeFileSync("dist/11.inline.css", result.css);
  }
}

function buildComponents() {
  fs.readdir("gui", async (err, files) => {
    if (err) return;
    const targetFolder = "dist/gui";
    const variablesFile = "_variables.scss";

    const fileResults = files
      .filter((file) => file.startsWith("_") && file !== variablesFile)
      .map((file) => ({
        name: file.slice(1),
        content: fs.readFileSync("gui/" + variablesFile) + "\n" + fs.readFileSync("gui/" + file),
      }));

    const parsedResults = fileResults.map(async (file) => {
      const target = targetFolder + "/" + file.name.replace("scss", "css");
      const parser = postcss([...plugins, require("postcss-css-variables")]);
      return {
        target,
        parsed: await parser.process(file.content, {
          from: "gui/" + file.name,
          to: target,
          map: { inline: false },
        }),
      };
    });

    mkdirp.sync(targetFolder);
    const results = await Promise.all(parsedResults);
    results.forEach((result) => fs.writeFile(result.target, result.parsed.css, () => {}));
  });
}

function buildDocs() {
  if (!fs.existsSync(path.join(__dirname, "docs"))) return;
  const dedent = require("dedent");
  const ejs = require("ejs");
  const glob = require("glob");
  const hljs = require("highlight.js");
  let id = 0;
  function getNewId() {
    return ++id;
  }
  function getCurrentId() {
    return id;
  }

  const template = fs.readFileSync("docs/index.html.ejs", "utf-8");
  const meta = {
    title: "11.css",
    description: "A design system for building faithful recreations of the Windows 11 Fluent UI.",
    image: "https://raw.githubusercontent.com/khang-nd/7.css/main/docs/window.png",
  };

  function example(code) {
    const magicBrackets = /\[\[(.*)\]\]/g;
    const dedented = dedent(code);
    const inline = dedented.replace(magicBrackets, "$1");
    const escaped = hljs.highlight("html", dedented.replace(magicBrackets, ""));

    return `<div class="example">
      <div class="raw">${inline}</div>
      <details class="code">
        <summary>Show code</summary>
        <pre><code>${escaped.value}</code></pre>
        <button class="copy">Copy Code</button>
      </details>
    </div>`;
  }

  glob("docs/*", { ignore: ["docs/components", "docs/sections", "docs/*.ejs"] }, (err, files) => {
    if (!err) {
      files.forEach((srcFile) => fs.copyFileSync(srcFile, path.join("dist", path.basename(srcFile))));
    }
  });

  try {
    fs.writeFileSync(
      path.join(__dirname, "/dist/index.html"),
      ejs.render(
        template,
        {
          getNewId,
          getCurrentId,
          meta,
          example,
        },
        { views: [path.resolve(__dirname, "./docs")] }
      )
    );
  } catch (e) {
    console.log("Docs template note:", e.message);
  }
}

async function build(mode) {
  try {
    console.log("Building 11.css Windows 11 Fluent Design System...");
    await buildCSS();
    buildDocs();

    if (mode === "production") {
      await buildCSS({ usePrefix: true });
      await buildCSS({ useInlineVars: true });
      buildComponents();
    }
    console.log("✓ 11.css build complete!");
  } catch (err) {
    console.error("Build failed:", err);
  }
}

module.exports = build;

build("production");
