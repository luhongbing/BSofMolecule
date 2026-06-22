
const smiles = 'CCCCc1nc(Cl)c(CO)n1Cc2ccc(-c3ccccc3-c4nnnn4[K])cc2';
console.log('Testing SMILES:', smiles);
console.log('');

const atoms: any[] = [];
const bonds: any[] = [];
const tokens: any[] = [];
let i = 0;

// Tokenize function
while (i &lt; smiles.length) {
  const c = smiles[i];
  if (c === '(') {
    tokens.push({ type: 'branch_start', value: '(' });
    i++;
  } else if (c === ')') {
    tokens.push({ type: 'branch_end', value: ')' });
    i++;
  } else if (c === '-' || c === '=' || c === '#' || c === ':' || c === '/' || c === '\\') {
    tokens.push({ type: 'bond', value: c });
    i++;
  } else if (c === '.') {
    tokens.push({ type: 'dot', value: '.' });
    i++;
  } else if (c &gt;= '0' &amp;&amp; c &lt;= '9') {
    let num = '';
    while (i &lt; smiles.length &amp;&amp; smiles[i] &gt;= '0' &amp;&amp; smiles[i] &lt;= '9') {
      num += smiles[i];
      i++;
    }
    tokens.push({ type: 'ring', value: num });
  } else if (c === '[') {
    let bracketContent = '';
    i++;
    while (i &lt; smiles.length &amp;&amp; smiles[i] !== ']') {
      bracketContent += smiles[i];
      i++;
    }
    if (i &lt; smiles.length) i++;
    tokens.push({ type: 'atom', value: `[${bracketContent}]` });
  } else if (c &gt;= 'A' &amp;&amp; c &lt;= 'Z') {
    let symbol = c;
    i++;
    if (i &lt; smiles.length &amp;&amp; smiles[i] &gt;= 'a' &amp;&amp; smiles[i] &lt;= 'z') {
      symbol += smiles[i];
      i++;
    }
    tokens.push({ type: 'atom', value: symbol });
  } else if (c === 'c' || c === 'n' || c === 'o' || c === 's' || c === 'p') {
    tokens.push({ type: 'atom', value: c });
    i++;
  } else {
    i++;
  }
}

console.log('Tokens:', tokens);
console.log('');
console.log('Done.');
