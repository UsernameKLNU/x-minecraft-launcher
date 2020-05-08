const fs = require('fs');
const core = require('@actions/core');

async function main(output) {
    const { version } = JSON.parse(fs.readFileSync(`package.json`).toString());
    const changelog = fs.readFileSync('CHANGELOG.md').toString();
    const changelogLines = changelog.split('\n')

    const start = changelogLines.findIndex(l => l.startsWith(`## [${version}]`));

    let body = 'Manual Release';
    if (start !== -1) {
        const end = changelogLines.slice(start + 1).findIndex(l => l.startsWith('## '))
        body = changelogLines.slice(start, end).join('\n') + '\n';
    }

    console.log(body);

    output('release', `v${version}`);
    output('body', body);
    output('tag', `v${version}`);
    output('prerelease', true);
    output('draft', false);
}

main(core ? core.setOutput : (k, v) => {
    console.log(k)
    console.log(v)
});
