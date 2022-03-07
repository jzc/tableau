const katex = require("katex");

module.exports =
  (content) => content.replaceAll(/\$(.*?)\$/gs, (_, tex) =>
    katex.renderToString(tex, {
      output: "html",
      trust: true,
      strict: "ignore",
    }));
      
