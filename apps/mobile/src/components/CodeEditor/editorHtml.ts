export const EDITOR_HTML = Object.freeze(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>RenderFlow Editor</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #1e1e1e; user-select: text; -webkit-user-select: text; }
  #editor { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="editor"></div>

<!-- Monaco Editor from CDN -->
<script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.min.js"></script>
<script>
(function () {
  'use strict';

  var DEBOUNCE_MS = 300;
  var changeTimer = null;

  require.config({
    paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
  });

  require(['vs/editor/editor.main'], function () {
    initEditor();
  });

  function postToRN(type, payload) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
    }
  }

  var REMOTION_TYPES = [
    'declare module "remotion" {',
    '  export interface VideoConfig { width: number; height: number; fps: number; durationInFrames: number; id: string; }',
    '  export function useCurrentFrame(): number;',
    '  export function useVideoConfig(): VideoConfig;',
    '  export function interpolate(input: number, inputRange: readonly number[], outputRange: readonly number[], options?: any): number;',
    '  export function spring(args: any): number;',
    '  export const Easing: any;',
    '  export function Sequence(props: any): any;',
    '  export function Composition<T>(props: any): any;',
    '  export function AbsoluteFill(props: any): any;',
    '  export function Img(props: any): any;',
    '  export function Audio(props: any): any;',
    '  export function Video(props: any): any;',
    '  export function staticFile(path: string): string;',
    '  export function continueRender(handle: number): void;',
    '  export function delayRender(label?: string): number;',
    '}'
  ].join('\\n');

  var REACT_TYPES = [
    'declare namespace React { type CSSProperties = Record<string, any>; type ComponentType<P = {}> = (props: P) => any; type ReactNode = any; type FC<P = {}> = (props: P) => any; }',
    'declare namespace JSX { interface IntrinsicElements { [key: string]: any; } type Element = any; }',
    'declare const React: any;'
  ].join('\\n');

  var editor = null;
  var currentModel = null;

  function initEditor() {
    var tsDefaults = monaco.languages.typescript.typescriptDefaults;
    tsDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monaco.languages.typescript.JsxEmit.React,
      jsxFactory: 'React.createElement',
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      allowNonTsExtensions: true,
      strict: false,
      noEmit: true,
      baseUrl: '.',
    });
    tsDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });

    tsDefaults.addExtraLib(REACT_TYPES, 'inmemory://model/react.d.ts');
    tsDefaults.addExtraLib(REMOTION_TYPES, 'inmemory://model/remotion.d.ts');

    currentModel = monaco.editor.createModel('', 'typescript', monaco.Uri.parse('inmemory://model/main.tsx'));

    editor = monaco.editor.create(document.getElementById('editor'), {
      model: currentModel, language: 'typescript', theme: 'vs-dark', fontSize: 14, lineNumbers: 'on', wordWrap: 'on',
      minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, insertSpaces: true,
      renderWhitespace: 'none', bracketPairColorization: { enabled: true }, autoClosingBrackets: 'always', autoClosingQuotes: 'always',
      autoIndent: 'full', formatOnPaste: true, suggestOnTriggerCharacters: true, quickSuggestions: true,
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 }, overviewRulerLanes: 0, hideCursorInOverviewRuler: true,
      overviewRulerBorder: false, contextmenu: true, padding: { top: 8, bottom: 8 }
    });

    editor.onDidChangeModelContent(function () {
      if (changeTimer) clearTimeout(changeTimer);
      changeTimer = setTimeout(function () {
        postToRN('code-change', { code: editor.getValue() });
      }, DEBOUNCE_MS);
    });

    editor.onDidChangeCursorPosition(function (e) {
      postToRN('cursor', { line: e.position.lineNumber, column: e.position.column });
    });

    monaco.editor.onDidChangeMarkers(function (uris) {
      for (var i = 0; i < uris.length; i++) {
        if (uris[i].toString() === currentModel.uri.toString()) {
          var markers = monaco.editor.getModelMarkers({ resource: currentModel.uri });
          var errors = markers.filter(function (m) {
            return m.severity === monaco.MarkerSeverity.Error || m.severity === monaco.MarkerSeverity.Warning;
          }).map(function (m) {
            return {
              message: m.message, severity: m.severity === monaco.MarkerSeverity.Error ? 'error' : 'warning',
              startLine: m.startLineNumber, startColumn: m.startColumn, endLine: m.endLineNumber, endColumn: m.endColumn,
            };
          });
          postToRN('error', { markers: errors });
          break;
        }
      }
    });

    postToRN('ready', {});

    function handleMessage(event) {
      var data;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (_e) { return; }
      if (!data || !data.type) return;

      switch (data.type) {
        case 'set-code':
          if (data.payload && typeof data.payload.code === 'string') {
            editor.executeEdits('set-code', [{ range: editor.getModel().getFullModelRange(), text: data.payload.code }]);
            editor.setPosition({ lineNumber: 1, column: 1 });
          }
          break;
        case 'get-code':
          postToRN('code-change', { code: editor.getValue() }); break;
        case 'format':
          editor.getAction('editor.action.formatDocument').run().then(function () { postToRN('code-change', { code: editor.getValue() }); }); break;
        case 'undo': editor.trigger('host', 'undo', null); break;
        case 'redo': editor.trigger('host', 'redo', null); break;
        case 'set-theme': if (data.payload && data.payload.theme) { monaco.editor.setTheme(data.payload.theme); } break;
        case 'set-font-size': if (data.payload && typeof data.payload.size === 'number') { editor.updateOptions({ fontSize: data.payload.size }); } break;
        case 'set-word-wrap': if (data.payload && typeof data.payload.enabled === 'boolean') { editor.updateOptions({ wordWrap: data.payload.enabled ? 'on' : 'off' }); } break;
        case 'set-line-numbers': if (data.payload && typeof data.payload.enabled === 'boolean') { editor.updateOptions({ lineNumbers: data.payload.enabled ? 'on' : 'off' }); } break;
        case 'set-readonly': if (data.payload && typeof data.payload.readOnly === 'boolean') { editor.updateOptions({ readOnly: data.payload.readOnly }); } break;
        case 'reveal-line': if (data.payload && typeof data.payload.line === 'number') { editor.revealLineInCenter(data.payload.line); editor.setPosition({ lineNumber: data.payload.line, column: 1 }); } break;
      }
    }
    
    // Force focus to prevent Android keyboard bugs
    document.addEventListener('touchstart', function() {
        if (editor) editor.focus();
    }, { passive: true });
    
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  }
})();
</script>
</body>
</html>`);
