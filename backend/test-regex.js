const text = `
Here is the JSON:
\`\`\`json
[
  { "a": 1 }
]
\`\`\`
`;
const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
if (jsonMatch) {
    console.log(jsonMatch[0]);
} else {
    console.log("No match");
}
