const fs = require('fs');
const path = require('path');

const unzippedDir = 'C:\\Users\\KIM TAE MIN\\.gemini\\antigravity\\brain\\4ab4cc13-eb77-4970-8e77-ea30bd76bf22\\scratch\\unzipped';
const sharedStringsPath = path.join(unzippedDir, 'xl', 'sharedStrings.xml');
const sheet1Path = path.join(unzippedDir, 'xl', 'worksheets', 'sheet1.xml');

function parseSharedStrings() {
  if (!fs.existsSync(sharedStringsPath)) return [];
  const content = fs.readFileSync(sharedStringsPath, 'utf8');
  // Exact parsing for <si> elements
  const siMatches = content.match(/<si>([\s\S]*?)<\/si>/g) || [];
  return siMatches.map(si => {
    // A single <si> can have multiple <t> tags if styled (rPr). Let's extract and join them.
    const tMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
    const val = tMatches.map(t => t.replace(/<t[^>]*>([\s\S]*?)<\/t>/, '$1')).join('');
    return val
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  });
}

function parseSheet1(sharedStrings) {
  if (!fs.existsSync(sheet1Path)) return [];
  const content = fs.readFileSync(sheet1Path, 'utf8');
  const rowMatches = content.match(/<row[^>]*>([\s\S]*?)<\/row>/g) || [];
  
  const rows = [];
  rowMatches.forEach(rowXml => {
    const rowNumMatch = rowXml.match(/r="(\d+)"/);
    if (!rowNumMatch) return;
    const rIdx = parseInt(rowNumMatch[1]);
    
    const cellMatches = rowXml.match(/<c[^>]*>([\s\S]*?)<\/c>|<c[^>]*\/>/g) || [];
    const rowData = {};
    
    cellMatches.forEach(cellXml => {
      const refMatch = cellXml.match(/r="([A-Z]+)(\d+)"/);
      if (!refMatch) return;
      const colLetter = refMatch[1];
      
      const typeMatch = cellXml.match(/t="([^"]+)"/);
      const isString = typeMatch && typeMatch[1] === 's';
      
      const valMatch = cellXml.match(/<v>([^<]+)<\/v>/);
      let value = '';
      if (valMatch) {
        const valStr = valMatch[1];
        if (isString) {
          const sIdx = parseInt(valStr);
          value = sharedStrings[sIdx] || '';
        } else {
          value = parseFloat(valStr);
          if (isNaN(value)) {
            value = valStr;
          }
        }
      } else {
        // inlineStr check (just in case)
        const isMatch = cellXml.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
        if (isMatch) {
          value = isMatch[1];
        }
      }
      rowData[colLetter] = value;
    });
    rows.push({ rIdx, cells: rowData });
  });
  
  return rows;
}

const strings = parseSharedStrings();
const data = parseSheet1(strings);

console.log(`Parsed ${data.length} rows.`);

// Let's print out the column headers and first 85 rows formatted
data.forEach(row => {
  const c = row.cells;
  // Format cells
  let parts = [];
  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  cols.forEach(col => {
    if (c[col] !== undefined && c[col] !== '') {
      parts.push(`${col}: ${c[col]}`);
    }
  });
  console.log(`Row ${String(row.rIdx).padStart(2)} | ` + parts.join(' | '));
});
