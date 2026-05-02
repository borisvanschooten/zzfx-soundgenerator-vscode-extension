/* Original prompt (gpt5.4):
Write code for a VSCode plugin (extension.js) in plain Javascript that allows you to edit parts of a JSON file with a particular structure.  It detects the JSON by the presence of a top-level property "zzfx-sound-generator". The JSON looks like this:

{

  "zzfx-sound-generator": "1.0", // this field indicates the format we are looking for
  "sounds": [
    {
     "name": "<sound name>",
     "type": "<type of sound>",
     "seed": "<positive integer random seed>",
    },
    { ... }
  ]
}

When this JSON format is detected, codelens buttons appear below each sound structure, with which you can change the type and seed, and play the sound via the global function playZzFXSound(type,seed).  Type can be changed from a dropdown with the following options: "Random","Pickup","Powerup","Jump","Shoot","Blip","Hit","Explo". Seed can be changed with a "Ranomize Seed" button that inserts a new random 8-digit integer.
*/

const vscode = require('vscode');

//const zzfx = require('./ZzFX/ZzFX')
const zzfxgen = require('./ZzFX/zzfx_generate_cjs')

var soundplayerWebview = null;

function playZzFXSound(type, seed) {
	var sound = zzfxgen.buildPresetSound(seed,type)
    /*const panel = vscode.window.createWebviewPanel(
        'soundPlayer',
        'Sound Player',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );*/

    //panel.webview.html = getWebviewHtml();

    soundplayerWebview.postMessage({
        command: 'playSamples',
        sampleRate: 44100,
        samples: sound.samples,
    });

}

class MyWebviewViewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView, context, token) {
        webviewView.webview.options = {
            enableScripts: true
        };
        soundplayerWebview = webviewView.webview;
        webviewView.webview.html = getWebviewHtml();
    }
}

function getWebviewHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sound Player</title>
</head>
<body>
  ZzFX sounds will play here. Press 
  <button onclick='playButtonPressed=true;playSamples();'>Play</button> first to allow the player to play sounds, or to replay the last sound.
  <div id='log'><br></div>
  <script>
    var samples = null;
    var sampleRate = null;
    var playButtonPressed = false;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    window.addEventListener('message', async (event) => {
      const message = event.data;
      if (message.command === 'playSamples') {
        samples = message.samples;
        sampleRate = message.sampleRate;
        playSamples()
      }
    });
    async function playSamples() {
        if (!samples) return;
        const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
        const channelData = buffer.getChannelData(0);

        for (let i = 0; i < samples.length; i++) {
          channelData[i] = samples[i];
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);

        if (audioContext.state === 'suspended') {
            if (!playButtonPressed) {
               document.getElementById("log").innerHTML += "Press Play button once to enable audio in webview.<br>";
                }
            await audioContext.resume();
        }

        try {
          source.start();
        } catch (e) { console.log(e);}
    }
  </script>
</body>
</html>`;
}



const SOUND_TYPES = [
    'Random',
    'Pickup',
    'Powerup',
    'Jump',
    'Shoot',
    'Blip',
    'Hit',
    'Explo'
];

function activate(context) {
    const provider = new ZzfxSoundCodeLensProvider();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'zzfxSoundGeneratorWebView',
            new MyWebviewViewProvider(context.extensionUri)
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            [
                { language: 'json', scheme: 'file' },
                { language: 'jsonc', scheme: 'file' }
            ],
            provider
        )
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(function () {
            provider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(function () {
            provider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(function () {
            provider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('zzfxSoundGenerator.changeType', async function (uriString, soundIndex) {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const document = editor.document;
            if (document.uri.toString() !== uriString) {
                return;
            }

            const parsed = parseZzfxDocument(document);
            if (!parsed || !parsed.isTarget || !parsed.sounds[soundIndex]) {
                vscode.window.showWarningMessage('Could not find the selected sound entry.');
                return;
            }

            const picked = await vscode.window.showQuickPick(SOUND_TYPES, {
                placeHolder: 'Select a sound type'
            });

            if (!picked) {
                return;
            }

            const sound = parsed.sounds[soundIndex];
            const edit = new vscode.WorkspaceEdit();

            if (sound.typeRange) {
                edit.replace(document.uri, sound.typeRange, JSON.stringify(picked));
            } else {
                const insertPos = findInsertionPositionForProperty(document, sound.objectRange, 'seed') || sound.objectRange.end.translate(0, -1);
                const insertText = buildPropertyInsertText(document, insertPos, 'type', picked, sound);
                edit.insert(document.uri, insertPos, insertText);
            }

            await vscode.workspace.applyEdit(edit);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('zzfxSoundGenerator.randomizeSeed', async function (uriString, soundIndex) {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const document = editor.document;
            if (document.uri.toString() !== uriString) {
                return;
            }

            const parsed = parseZzfxDocument(document);
            if (!parsed || !parsed.isTarget || !parsed.sounds[soundIndex]) {
                vscode.window.showWarningMessage('Could not find the selected sound entry.');
                return;
            }

            const sound = parsed.sounds[soundIndex];
            const newSeed = generateRandomInteger();
            const edit = new vscode.WorkspaceEdit();

            if (sound.seedRange) {
                edit.replace(document.uri, sound.seedRange, JSON.stringify(newSeed));
            } else {
                const insertPos = sound.objectRange.end.translate(0, -1);
                const insertText = buildPropertyInsertText(document, insertPos, 'seed', String(newSeed), sound);
                edit.insert(document.uri, insertPos, insertText);
            }

            await vscode.workspace.applyEdit(edit);

            const type = typeof sound.typeValue === 'string' && sound.typeValue.length > 0 ? sound.typeValue : 'Random';
            console.log(`######### ${type} ${newSeed}`)
            playZzFXSound(type, newSeed);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('zzfxSoundGenerator.playSound', async function (uriString, soundIndex) {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const document = editor.document;
            if (document.uri.toString() !== uriString) {
                return;
            }

            const parsed = parseZzfxDocument(document);
            if (!parsed || !parsed.isTarget || !parsed.sounds[soundIndex]) {
                vscode.window.showWarningMessage('Could not find the selected sound entry.');
                return;
            }

            const sound = parsed.sounds[soundIndex];
            const type = typeof sound.typeValue === 'string' && sound.typeValue.length > 0 ? sound.typeValue : 'Random';
            const seed = normalizeSeedValue(sound.seedValue);

            // use this to open webview debug console
            /*try {
                const result = await vscode.commands.executeCommand(
                    'workbench.action.webview.openDeveloperTools'
                );
                void result;
            } catch (e) {
            }*/

            playZzFXSound(type, seed);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('zzfxSoundGenerator.addNewSound', async function (uriString) {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const document = editor.document;
            if (document.uri.toString() !== uriString) {
                return;
            }

            const parsed = parseZzfxDocument(document);
            if (!parsed || !parsed.isTarget || !parsed.sounds[parsed.sounds.length-1]) {
                vscode.window.showWarningMessage('Could not find the selected sound entry.');
                return;
            }

            const lastSound = parsed.sounds[parsed.sounds.length-1];
            const insertPos = new vscode.Range(lastSound.objectRange.end,lastSound.objectRange.end)
            const edit = new vscode.WorkspaceEdit();

            edit.replace(document.uri, insertPos, `,\n\n    {"name": "", "type": "Random", "seed": 1}`);

            await vscode.workspace.applyEdit(edit);
        })
    );

}

function deactivate() {
    // do we need to do this?
    //if (disposables) {
	//	disposables.forEach(item => item.dispose());
	//}
	//disposables = [];
}

class ZzfxSoundCodeLensProvider {
    constructor() {
        this._onDidChangeCodeLenses = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    }

    refresh() {
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(document) {
        const parsed = parseZzfxDocument(document);
        if (!parsed || !parsed.isTarget) {
            return [];
        }

        const lenses = [];

        for (let i = 0; i < parsed.sounds.length; i++) {
            const sound = parsed.sounds[i];
            const lineBelowObject = Math.min(sound.objectRange.end.line + 1, document.lineCount - 1);
            const lensRange = new vscode.Range(
                new vscode.Position(lineBelowObject, 0),
                new vscode.Position(lineBelowObject, 0)
            );

            lenses.push(
                new vscode.CodeLens(lensRange, {
                    title: `Type: ${sound.typeValue || 'Random'} ▼`,
                    command: 'zzfxSoundGenerator.changeType',
                    arguments: [document.uri.toString(), i]
                })
            );

            lenses.push(
                new vscode.CodeLens(lensRange, {
                    title: 'Randomize Seed',
                    command: 'zzfxSoundGenerator.randomizeSeed',
                    arguments: [document.uri.toString(), i]
                })
            );

            lenses.push(
                new vscode.CodeLens(lensRange, {
                    title: `Play (${sound.typeValue || 'Random'}, ${normalizeSeedValue(sound.seedValue)})`,
                    command: 'zzfxSoundGenerator.playSound',
                    arguments: [document.uri.toString(), i]
                })
            );
        }

        const lineBelowArray = Math.min(parsed.sounds[parsed.sounds.length-1].objectRange.end.line + 2, document.lineCount - 1);
        const addNewLensRange = new vscode.Range(
                new vscode.Position(lineBelowArray, 0),
                new vscode.Position(lineBelowArray, 0)
            );
        lenses.push(
            new vscode.CodeLens(addNewLensRange, {
                title: `Add new sound`,
                command: 'zzfxSoundGenerator.addNewSound',
                arguments: [document.uri.toString()]
            })
        );

        return lenses;
    }
}

function parseZzfxDocument(document) {
    const text = document.getText();
    if (!/"zzfx-sound-generator"\s*:/.test(text)) {
        return null;
    }

    let root;
    try {
        root = JSON.parse(text);
    } catch (e) {
        return null;
    }

    if (!root || typeof root !== 'object') {
        return null;
    }

    if (!Object.prototype.hasOwnProperty.call(root, 'zzfx-sound-generator')) {
        return null;
    }

    if (!Array.isArray(root.sounds)) {
        return {
            isTarget: true,
            sounds: []
        };
    }

    const soundsArrayRange = findSoundsArrayRange(document);
    const soundObjectRanges = soundsArrayRange ? findTopLevelObjectsInArray(document, soundsArrayRange) : [];

    const sounds = [];

    for (let i = 0; i < root.sounds.length; i++) {
        const soundObj = root.sounds[i];
        const objectRange = soundObjectRanges[i];
        if (!soundObj || typeof soundObj !== 'object' || !objectRange) {
            continue;
        }

        const typeRange = findPropertyValueRange(document, objectRange, 'type');
        const seedRange = findPropertyValueRange(document, objectRange, 'seed');

        sounds.push({
            index: i,
            objectRange: objectRange,
            typeRange: typeRange,
            seedRange: seedRange,
            typeValue: soundObj.type,
            seedValue: soundObj.seed
        });
    }

    return {
        isTarget: true,
        sounds: sounds
    };
}

function findSoundsArrayRange(document) {
    const text = document.getText();
    const keyRegex = /"sounds"\s*:/g;
    const match = keyRegex.exec(text);
    if (!match) {
        return null;
    }

    let pos = match.index + match[0].length;
    while (pos < text.length && /\s/.test(text[pos])) {
        pos++;
    }

    if (text[pos] !== '[') {
        return null;
    }

    const startOffset = pos;
    const endOffset = findMatchingBracket(text, startOffset, '[', ']');
    if (endOffset < 0) {
        return null;
    }

    return new vscode.Range(
        document.positionAt(startOffset),
        document.positionAt(endOffset + 1)
    );
}

function findTopLevelObjectsInArray(document, arrayRange) {
    const text = document.getText();
    const start = document.offsetAt(arrayRange.start);
    const end = document.offsetAt(arrayRange.end);
    const result = [];

    let depthCurly = 0;
    let depthSquare = 0;
    let inString = false;
    let escaped = false;
    let objectStart = -1;

    for (let i = start; i < end; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === '[') {
            depthSquare++;
            continue;
        }

        if (ch === ']') {
            depthSquare--;
            continue;
        }

        if (ch === '{') {
            depthCurly++;
            if (depthSquare === 1 && depthCurly === 1) {
                objectStart = i;
            }
            continue;
        }

        if (ch === '}') {
            if (depthSquare === 1 && depthCurly === 1 && objectStart >= 0) {
                result.push(
                    new vscode.Range(
                        document.positionAt(objectStart),
                        document.positionAt(i + 1)
                    )
                );
                objectStart = -1;
            }
            depthCurly--;
        }
    }

    return result;
}

function findPropertyValueRange(document, objectRange, propertyName) {
    const text = document.getText();
    const start = document.offsetAt(objectRange.start);
    const end = document.offsetAt(objectRange.end);
    const objectText = text.slice(start, end);

    const regex = new RegExp('"' + escapeRegExp(propertyName) + '"\\s*:\\s*', 'g');
    const match = regex.exec(objectText);
    if (!match) {
        return null;
    }

    const valueStartInObject = match.index + match[0].length;
    const absoluteValueStart = start + valueStartInObject;
    const absoluteValueEnd = findJsonValueEnd(text, absoluteValueStart, end);
    if (absoluteValueEnd < 0) {
        return null;
    }

    return new vscode.Range(
        document.positionAt(absoluteValueStart),
        document.positionAt(absoluteValueEnd)
    );
}

function findJsonValueEnd(text, valueStart, limit) {
    let i = valueStart;
    while (i < limit && /\s/.test(text[i])) {
        i++;
    }

    if (i >= limit) {
        return -1;
    }

    const first = text[i];

    // string
    if (first === '"') {
        i++;
        let escaped = false;
        while (i < limit) {
            const ch = text[i];
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                return i + 1;
            }
            i++;
        }
        return -1;
    }
    // integer
    if (/\d/.test(first)) {
        i++;
        while (i < limit) {
            const ch = text[i];
            if (! /\d/.test(ch)) {
                return i;
            }
            i++;
        }
        return -1;
    }

    if (first === '{') {
        const end = findMatchingBracket(text, i, '{', '}');
        return end >= 0 ? end + 1 : -1;
    }

    if (first === '[') {
        const end = findMatchingBracket(text, i, '[', ']');
        return end >= 0 ? end + 1 : -1;
    }

    while (i < limit && !/[,\}\]]/.test(text[i])) {
        i++;
    }

    return i;
}

function findMatchingBracket(text, startIndex, openChar, closeChar) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === openChar) {
            depth++;
            continue;
        }

        if (ch === closeChar) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }

    return -1;
}

function findInsertionPositionForProperty(document, objectRange, beforePropertyName) {
    const text = document.getText();
    const start = document.offsetAt(objectRange.start);
    const end = document.offsetAt(objectRange.end);
    const objectText = text.slice(start, end);

    const regex = new RegExp('"' + escapeRegExp(beforePropertyName) + '"\\s*:', 'g');
    const match = regex.exec(objectText);
    if (!match) {
        return null;
    }

    return document.positionAt(start + match.index);
}

function buildPropertyInsertText(document, insertPos, propertyName, propertyValue, sound) {
    const line = document.lineAt(insertPos.line).text;
    const indentationMatch = line.match(/^(\s*)/);
    const lineIndent = indentationMatch ? indentationMatch[1] : '';
    const propertyIndent = lineIndent;
    const objectStartLine = sound.objectRange.start.line;
    const objectLine = document.lineAt(objectStartLine).text;
    const objectIndentMatch = objectLine.match(/^(\s*)/);
    const objectIndent = objectIndentMatch ? objectIndentMatch[1] : '';
    const preferredIndent = propertyIndent.length > objectIndent.length ? propertyIndent : objectIndent + '  ';
    const insertOffset = document.offsetAt(insertPos);
    const fullText = document.getText();
    const prevNonWs = findPreviousNonWhitespace(fullText, insertOffset - 1);

    if (prevNonWs === '{') {
        return '\n' + preferredIndent + JSON.stringify(propertyName) + ': ' + JSON.stringify(propertyValue) + ',';
    }

    return preferredIndent + JSON.stringify(propertyName) + ': ' + JSON.stringify(propertyValue) + ',\n';
}

function findPreviousNonWhitespace(text, index) {
    for (let i = index; i >= 0; i--) {
        if (!/\s/.test(text[i])) {
            return text[i];
        }
    }
    return null;
}

function normalizeSeedValue(seedValue) {
    if (typeof seedValue === 'number' && Number.isFinite(seedValue)) {
        return Math.floor(Math.abs(seedValue));
    }

    if (typeof seedValue === 'string') {
        const parsed = parseInt(seedValue, 10);
        if (!Number.isNaN(parsed)) {
            return Math.floor(Math.abs(parsed));
        }
    }

    return generateRandomInteger();
}

function generateRandomInteger() {
    return Math.floor(1000000 + Math.random() * 90000000);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    activate: activate,
    deactivate: deactivate
};

