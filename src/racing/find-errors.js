const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];

let globalFailures = [];

for (let i = 0; i < scripts.length; i++) {
  const js = scripts[i].replace(/<script>/, '').replace(/<\/script>/, '');
  try {
    new Function(js);
  } catch (e) {
    const lines = js.split('\n');
    // Find error line
    let errorLine = -1;
    for (let j = 0; j < lines.length; j++) {
      const chunk = lines.slice(0, j + 1).join('\n');
      try {
        new Function(chunk);
      } catch (e2) {
        // Check if this is just an unclosed construct or a real error
        // Try adding a closing brace/paren to see if it's just incomplete
        if (e2.message.includes('end of input') || e2.message.includes('Unexpected end')) {
          continue;
        }
        errorLine = j + 1;
        globalFailures.push({
          scriptIdx: i,
          line: errorLine,
          content: lines[j].substring(0, 100),
          error: e2.message.substring(0, 100),
          isFatal: true
        });
        break;
      }
    }
    if (errorLine < 0) {
      // Maybe the whole script fails but we couldn't pinpoint a line
      // This is likely an unclosed construct at the end
      globalFailures.push({
        scriptIdx: i,
        line: lines.length,
        content: '(end of script)',
        error: e.message.substring(0, 100),
        isFatal: false
      });
    }
  }
}

console.log('Errors found: ' + globalFailures.length);
globalFailures.forEach(f => {
  const label = f.isFatal ? 'FATAL' : 'UNCLOSED';
  console.log('Script#' + f.scriptIdx + ' L' + f.line + ' [' + label + '] ' + f.error);
  console.log('  ' + f.content);
});
